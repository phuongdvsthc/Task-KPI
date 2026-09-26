import crypto from 'crypto';
import {
  AI_KNOWLEDGE_ALLOWED_EXTENSIONS,
  AI_KNOWLEDGE_ALLOWED_MIME_TYPES,
  AI_KNOWLEDGE_MAX_FILE_SIZE,
  AI_KNOWLEDGE_STORAGE_BUCKET,
  AIKnowledgeDocument,
  AIKnowledgeDocumentListParams,
  AIKnowledgeDocumentListResponse,
  AIKnowledgeDocumentUpdatePayload,
  AIKnowledgeDownloadUrlResponse
} from '../../../types/aiKnowledge';
import { redactSecrets } from '../gateway';

export interface FileUploadValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFileName?: string;
  mimeType?: string;
}

export class KnowledgeDocumentService {
  /**
   * Sanitizes file name: strips path traversal, absolute paths, special control chars.
   */
  sanitizeFileName(rawName: string): string {
    if (!rawName) return 'unnamed_file';
    // Remove null bytes, path traversal slashes, directory names
    let clean = rawName.replace(/[\x00-\x1f\x7f]/g, '');
    clean = clean.replace(/\\/g, '/');
    const baseName = clean.split('/').pop() || 'document';
    // Remove any leading dots or illegal characters
    const sanitized = baseName.replace(/^\.+/, '').replace(/[^a-zA-Z0-9._\- ]/g, '_').trim();
    return sanitized || 'document';
  }

  /**
   * Validates file format, size, mime type and magic bytes signature.
   */
  validateFile(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }): FileUploadValidationResult {
    if (!file || !file.buffer || file.size === 0) {
      return { valid: false, error: 'Tệp tải lên rỗng hoặc không có nội dung.' };
    }

    if (file.size > AI_KNOWLEDGE_MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `Dung lượng tệp vượt quá giới hạn cho phép (tối đa 20 MB).`
      };
    }

    const sanitizedName = this.sanitizeFileName(file.originalname);
    const ext = (sanitizedName.split('.').pop() || '').toLowerCase();

    if (!AI_KNOWLEDGE_ALLOWED_EXTENSIONS.includes(ext as any)) {
      return {
        valid: false,
        error: `Định dạng tệp .${ext} không được hỗ trợ. Hệ thống chỉ hỗ trợ: PDF, DOCX, DOC, TXT, MD.`
      };
    }

    // MIME type check
    const normalizedMime = (file.mimetype || '').toLowerCase();
    const isMimeAllowed = AI_KNOWLEDGE_ALLOWED_MIME_TYPES.some((allowed) =>
      normalizedMime.includes(allowed)
    ) || (ext === 'md' && (normalizedMime.includes('text/') || normalizedMime === 'application/octet-stream'))
      || (ext === 'txt' && normalizedMime.includes('text/'));

    if (!isMimeAllowed) {
      return {
        valid: false,
        error: `Loại tệp (MIME: ${file.mimetype}) không khớp với định dạng tệp được phép.`
      };
    }

    // Magic bytes checking for binary files (PDF, DOCX, DOC)
    const buf = file.buffer;
    if (ext === 'pdf') {
      // PDF header must start with %PDF- (0x25 0x50 0x44 0x46 0x2D)
      if (buf.length < 5 || buf.toString('utf8', 0, 5) !== '%PDF-') {
        return { valid: false, error: 'Tệp PDF không đúng cấu trúc hợp lệ (chữ ký tệp sai).' };
      }
    } else if (ext === 'docx') {
      // DOCX is a ZIP container, starts with PK\x03\x04 (0x50 0x4B 0x03 0x04)
      if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b || buf[2] !== 0x03 || buf[3] !== 0x04) {
        return { valid: false, error: 'Tệp DOCX không đúng cấu trúc hợp lệ (chữ ký tệp sai).' };
      }
    } else if (ext === 'doc') {
      // Old OLE Compound Document: 0xD0 0xCF 0x11 0xE0
      if (buf.length < 4 || buf[0] !== 0xd0 || buf[1] !== 0xcf || buf[2] !== 0x11 || buf[3] !== 0xe0) {
        return { valid: false, error: 'Tệp DOC không đúng cấu trúc hợp lệ (chữ ký tệp sai).' };
      }
    }

    return {
      valid: true,
      sanitizedFileName: sanitizedName,
      mimeType: file.mimetype
    };
  }

  /**
   * Computes SHA-256 content hash of file buffer.
   */
  computeContentHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generates a safe server-controlled storage path.
   * Format: documents/{documentId}/{versionId}/{safeFileName}
   */
  generateStoragePath(documentId: string, versionId: string, safeFileName: string): string {
    return `documents/${documentId}/${versionId}/${safeFileName}`;
  }

  /**
   * Records an audit log in access_audit_logs table.
   */
  async recordAuditLog(
    supabaseAdmin: any,
    actorId: string,
    action: string,
    documentId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await supabaseAdmin.from('access_audit_logs').insert({
        actor_user_id: actorId,
        action_code: `ai.knowledge.${action}`,
        target_type: 'knowledge_document',
        target_id: documentId,
        after_data: metadata || null,
        created_at: new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[KnowledgeDocumentService:recordAuditLog] Audit warning:', redactSecrets(err.message));
    }
  }

  /**
   * Lists knowledge documents with pagination, filters and search.
   */
  async listDocuments(
    supabaseAdmin: any,
    params: AIKnowledgeDocumentListParams
  ): Promise<AIKnowledgeDocumentListResponse> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('ai_knowledge_documents')
      .select(
        `
        id,
        title,
        description,
        category,
        version_label,
        original_file_name,
        storage_bucket,
        storage_path,
        mime_type,
        file_size,
        content_hash,
        status,
        processing_status,
        visibility_type,
        error_message,
        effective_from,
        effective_until,
        created_by,
        updated_by,
        published_by,
        published_at,
        created_at,
        updated_at,
        creator:profiles!ai_knowledge_documents_created_by_fkey(id, full_name, email),
        updater:profiles!ai_knowledge_documents_updated_by_fkey(id, full_name, email),
        publisher:profiles!ai_knowledge_documents_published_by_fkey(id, full_name, email)
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (params.search && params.search.trim()) {
      const s = params.search.trim();
      query = query.or(`title.ilike.%${s}%,original_file_name.ilike.%${s}%`);
    }

    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    if (params.processing_status && params.processing_status !== 'all') {
      query = query.eq('processing_status', params.processing_status);
    }

    if (params.category && params.category !== 'all') {
      query = query.eq('category', params.category);
    }

    if (params.date_from) {
      query = query.gte('updated_at', params.date_from);
    }

    if (params.date_to) {
      query = query.lte('updated_at', params.date_to);
    }

    // Sorting
    const sortBy = params.sort_by || 'updated_at';
    const isAscending = params.sort_order === 'asc';
    query = query.order(sortBy, { ascending: isAscending });

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      throw new Error(`Lỗi truy vấn danh sách tài liệu: ${error.message}`);
    }

    const documents: AIKnowledgeDocument[] = (data || []).map((doc: any) => ({
      ...doc,
      creator_profile: doc.creator || null,
      updater_profile: doc.updater || null,
      publisher_profile: doc.publisher || null,
      creator: undefined,
      updater: undefined,
      publisher: undefined
    }));

    const total = count || 0;
    return {
      documents,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit) || 1
    };
  }

  /**
   * Retrieves single document detail.
   */
  async getDocumentById(supabaseAdmin: any, documentId: string): Promise<AIKnowledgeDocument | null> {
    const { data, error } = await supabaseAdmin
      .from('ai_knowledge_documents')
      .select(
        `
        id,
        title,
        description,
        category,
        version_label,
        original_file_name,
        storage_bucket,
        storage_path,
        mime_type,
        file_size,
        content_hash,
        status,
        processing_status,
        visibility_type,
        error_message,
        effective_from,
        effective_until,
        created_by,
        updated_by,
        published_by,
        published_at,
        created_at,
        updated_at,
        creator:profiles!ai_knowledge_documents_created_by_fkey(id, full_name, email),
        updater:profiles!ai_knowledge_documents_updated_by_fkey(id, full_name, email),
        publisher:profiles!ai_knowledge_documents_published_by_fkey(id, full_name, email)
      `
      )
      .eq('id', documentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Lỗi truy vấn chi tiết tài liệu: ${error.message}`);
    }

    if (!data) return null;

    // Optional chunk count query
    const { count: chunkCount } = await supabaseAdmin
      .from('ai_knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId);

    return {
      ...data,
      creator_profile: data.creator || null,
      updater_profile: data.updater || null,
      publisher_profile: data.publisher || null,
      creator: undefined,
      updater: undefined,
      publisher: undefined,
      chunk_count: chunkCount || 0
    };
  }

  /**
   * Uploads file to private storage, creates document record in DB with compensating cleanup.
   */
  async createDocument(
    supabaseAdmin: any,
    actorId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    metadata: {
      title: string;
      description?: string;
      category?: string;
      version_label?: string;
      effective_from?: string;
      effective_until?: string;
      warning_confirmed: boolean;
    }
  ): Promise<AIKnowledgeDocument> {
    if (!metadata.warning_confirmed) {
      throw new Error('Bạn cần xác nhận cảnh báo phạm vi sử dụng tài liệu trước khi tải lên.');
    }

    if (!metadata.title || !metadata.title.trim()) {
      throw new Error('Tiêu đề tài liệu không được để trống.');
    }

    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid || !validation.sanitizedFileName) {
      throw new Error(validation.error || 'Tệp không hợp lệ.');
    }

    // Compute hash
    const contentHash = this.computeContentHash(file.buffer);

    // Check duplicate content hash
    const { data: existingDoc } = await supabaseAdmin
      .from('ai_knowledge_documents')
      .select('id, title, version_label, status')
      .eq('content_hash', contentHash)
      .maybeSingle();

    if (existingDoc) {
      throw new Error(
        `Tệp này đã tồn tại trong kho tài liệu với tiêu đề "${existingDoc.title}" (${existingDoc.version_label}).`
      );
    }

    // Effective dates validation
    const effFrom = metadata.effective_from ? new Date(metadata.effective_from).toISOString() : new Date().toISOString();
    let effUntil: string | null = null;
    if (metadata.effective_until) {
      effUntil = new Date(metadata.effective_until).toISOString();
      if (new Date(effUntil) < new Date(effFrom)) {
        throw new Error('Ngày hết hiệu lực không thể trước ngày bắt đầu hiệu lực.');
      }
    }

    // Safe document ID & Version ID
    const documentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const storagePath = this.generateStoragePath(documentId, versionId, validation.sanitizedFileName);

    // 1. Upload to Supabase Private Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from(AI_KNOWLEDGE_STORAGE_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: validation.mimeType || 'application/octet-stream',
        upsert: false
      });

    if (storageError) {
      throw new Error(`Lỗi tải tệp lên Storage: ${storageError.message}`);
    }

    // 2. Insert into PostgreSQL database
    try {
      const { data: inserted, error: dbError } = await supabaseAdmin
        .from('ai_knowledge_documents')
        .insert({
          id: documentId,
          title: metadata.title.trim(),
          description: metadata.description ? metadata.description.trim() : null,
          category: metadata.category?.trim() || 'general',
          version_label: metadata.version_label?.trim() || 'v1.0',
          original_file_name: validation.sanitizedFileName,
          storage_bucket: AI_KNOWLEDGE_STORAGE_BUCKET,
          storage_path: storagePath,
          mime_type: validation.mimeType,
          file_size: file.size,
          content_hash: contentHash,
          status: 'draft',
          processing_status: 'pending',
          visibility_type: 'global',
          error_message: null,
          effective_from: effFrom,
          effective_until: effUntil,
          created_by: actorId,
          updated_by: actorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        // Compensating action: Delete file from storage
        await supabaseAdmin.storage.from(AI_KNOWLEDGE_STORAGE_BUCKET).remove([storagePath]);
        throw new Error(`Lỗi ghi nhận thông tin tài liệu vào cơ sở dữ liệu: ${dbError.message}`);
      }

      // Record audit log
      await this.recordAuditLog(supabaseAdmin, actorId, 'upload', documentId, {
        title: metadata.title,
        original_file_name: validation.sanitizedFileName,
        file_size: file.size,
        content_hash: contentHash
      });

      return inserted;
    } catch (err: any) {
      // Ensure storage cleanup on exception
      try {
        await supabaseAdmin.storage.from(AI_KNOWLEDGE_STORAGE_BUCKET).remove([storagePath]);
      } catch (cleanupErr: any) {
        console.warn('[KnowledgeDocumentService:createDocument] Cleanup storage error:', cleanupErr.message);
      }
      throw err;
    }
  }

  /**
   * Updates document metadata (only allowed fields).
   */
  async updateMetadata(
    supabaseAdmin: any,
    actorId: string,
    documentId: string,
    payload: AIKnowledgeDocumentUpdatePayload
  ): Promise<AIKnowledgeDocument> {
    const existing = await this.getDocumentById(supabaseAdmin, documentId);
    if (!existing) {
      throw new Error('Không tìm thấy tài liệu cần cập nhật.');
    }

    const updates: Record<string, any> = {
      updated_by: actorId,
      updated_at: new Date().toISOString()
    };

    if (payload.title !== undefined) {
      if (!payload.title.trim()) {
        throw new Error('Tiêu đề tài liệu không được để trống.');
      }
      updates.title = payload.title.trim();
    }

    if (payload.description !== undefined) {
      updates.description = payload.description ? payload.description.trim() : null;
    }

    if (payload.category !== undefined) {
      updates.category = payload.category.trim() || 'general';
    }

    if (payload.version_label !== undefined) {
      updates.version_label = payload.version_label.trim() || 'v1.0';
    }

    if (payload.effective_from !== undefined) {
      updates.effective_from = payload.effective_from
        ? new Date(payload.effective_from).toISOString()
        : null;
    }

    if (payload.effective_until !== undefined) {
      updates.effective_until = payload.effective_until
        ? new Date(payload.effective_until).toISOString()
        : null;
    }

    const fromDate = updates.effective_from !== undefined ? updates.effective_from : existing.effective_from;
    const untilDate = updates.effective_until !== undefined ? updates.effective_until : existing.effective_until;
    if (fromDate && untilDate && new Date(untilDate) < new Date(fromDate)) {
      throw new Error('Ngày hết hiệu lực không thể trước ngày bắt đầu hiệu lực.');
    }

    const { data: updated, error } = await supabaseAdmin
      .from('ai_knowledge_documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Lỗi cập nhật metadata tài liệu: ${error.message}`);
    }

    await this.recordAuditLog(supabaseAdmin, actorId, 'update_metadata', documentId, {
      updated_fields: Object.keys(updates).filter((k) => k !== 'updated_at' && k !== 'updated_by')
    });

    return updated;
  }

  /**
   * Generates a short-lived signed URL (300 seconds) for downloading original file.
   */
  async createDownloadUrl(
    supabaseAdmin: any,
    actorId: string,
    documentId: string
  ): Promise<AIKnowledgeDownloadUrlResponse> {
    const doc = await this.getDocumentById(supabaseAdmin, documentId);
    if (!doc) {
      throw new Error('Không tìm thấy tài liệu.');
    }

    if (!doc.storage_path) {
      throw new Error('Tài liệu không có đường dẫn lưu trữ hợp lệ.');
    }

    const expiresIn = 300; // 5 minutes
    const { data, error } = await supabaseAdmin.storage
      .from(AI_KNOWLEDGE_STORAGE_BUCKET)
      .createSignedUrl(doc.storage_path, expiresIn);

    if (error || !data?.signedUrl) {
      throw new Error(`Không thể tạo liên kết tải về: ${error?.message || 'Lỗi không xác định'}`);
    }

    // Audit log (without storing signed URL)
    await this.recordAuditLog(supabaseAdmin, actorId, 'download_url_generated', documentId, {
      file_name: doc.original_file_name,
      expires_in: expiresIn
    });

    return {
      download_url: data.signedUrl,
      expires_in_seconds: expiresIn,
      file_name: doc.original_file_name
    };
  }

  /**
   * Publishes document.
   * STRICT CONDITION: Must be processing_status = 'ready', valid effective dates, and warning confirmed.
   */
  async publishDocument(
    supabaseAdmin: any,
    actorId: string,
    documentId: string,
    warningConfirmed: boolean
  ): Promise<AIKnowledgeDocument> {
    if (!warningConfirmed) {
      throw new Error('Bạn cần xác nhận cảnh báo phạm vi chia sẻ trước khi xuất bản tài liệu.');
    }

    const doc = await this.getDocumentById(supabaseAdmin, documentId);
    if (!doc) {
      throw new Error('Không tìm thấy tài liệu.');
    }

    if (doc.processing_status !== 'ready') {
      throw new Error(
        `Tài liệu chưa thể xuất bản vì trạng thái xử lý hiện tại là "${doc.processing_status}". Chỉ tài liệu đã xử lý thành công (ready) mới được xuất bản.`
      );
    }

    if (doc.effective_until && new Date(doc.effective_until) <= new Date()) {
      throw new Error('Tài liệu đã hết hạn hiệu lực, không thể xuất bản.');
    }

    const { data: updated, error } = await supabaseAdmin
      .from('ai_knowledge_documents')
      .update({
        status: 'published',
        published_by: actorId,
        published_at: new Date().toISOString(),
        updated_by: actorId,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Lỗi xuất bản tài liệu: ${error.message}`);
    }

    await this.recordAuditLog(supabaseAdmin, actorId, 'publish', documentId, {
      title: doc.title,
      version_label: doc.version_label
    });

    return updated;
  }

  /**
   * Deactivates document.
   */
  async deactivateDocument(
    supabaseAdmin: any,
    actorId: string,
    documentId: string
  ): Promise<AIKnowledgeDocument> {
    const doc = await this.getDocumentById(supabaseAdmin, documentId);
    if (!doc) {
      throw new Error('Không tìm thấy tài liệu.');
    }

    const { data: updated, error } = await supabaseAdmin
      .from('ai_knowledge_documents')
      .update({
        status: 'inactive',
        updated_by: actorId,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Lỗi ngừng sử dụng tài liệu: ${error.message}`);
    }

    await this.recordAuditLog(supabaseAdmin, actorId, 'deactivate', documentId, {
      title: doc.title
    });

    return updated;
  }

  /**
   * Deletes document, cascading related records, and deletes file in Storage.
   */
  async deleteDocument(
    supabaseAdmin: any,
    actorId: string,
    documentId: string
  ): Promise<{ success: boolean; id: string }> {
    const doc = await this.getDocumentById(supabaseAdmin, documentId);
    if (!doc) {
      throw new Error('Không tìm thấy tài liệu để xóa.');
    }

    // 1. Delete file in Storage
    if (doc.storage_path) {
      const { error: storageErr } = await supabaseAdmin.storage
        .from(AI_KNOWLEDGE_STORAGE_BUCKET)
        .remove([doc.storage_path]);

      if (storageErr) {
        console.warn(
          '[KnowledgeDocumentService:deleteDocument] Storage remove warning:',
          storageErr.message
        );
      }
    }

    // 2. Delete database record (Foreign keys to chunks and message_sources cascade/set null)
    const { error: dbErr } = await supabaseAdmin
      .from('ai_knowledge_documents')
      .delete()
      .eq('id', documentId);

    if (dbErr) {
      throw new Error(`Lỗi xóa tài liệu khỏi cơ sở dữ liệu: ${dbErr.message}`);
    }

    // 3. Record audit log
    await this.recordAuditLog(supabaseAdmin, actorId, 'delete', documentId, {
      title: doc.title,
      original_file_name: doc.original_file_name
    });

    return { success: true, id: documentId };
  }
}

export const knowledgeDocumentService = new KnowledgeDocumentService();
