import crypto from 'crypto';
import {
  AI_KNOWLEDGE_CHUNK_CONFIG,
  AI_KNOWLEDGE_MAX_FILE_SIZE,
  AIKnowledgeChunk,
  AIKnowledgeProcessResult
} from '../../../../types/aiKnowledge';
import { aiGateway, redactSecrets } from '../../gateway';
import { ExtractorFactory } from '../extractors/extractorFactory';
import { TextChunker } from './textChunker';
import { VectorValidator } from './vectorValidator';

export class KnowledgeProcessingService {
  private chunker: TextChunker;

  constructor(chunker?: TextChunker) {
    this.chunker = chunker || new TextChunker();
  }

  /**
   * Processes a document:
   * 1. Atomic lock / lease acquisition
   * 2. Download from private storage
   * 3. Integrity hash verification
   * 4. Text extraction (PDF / DOCX / TXT / MD)
   * 5. Normalization & natural-boundary chunking (600-900 tokens, 80-150 overlap)
   * 6. Batch vector embedding via AI Gateway (text-embedding-004, 768 dims)
   * 7. Vector verification
   * 8. Atomic save to ai_knowledge_chunks & update document to 'ready'
   */
  async processDocument(
    supabaseAdmin: any,
    documentId: string,
    workerId: string = 'backend-processor-1'
  ): Promise<AIKnowledgeProcessResult> {
    const startTime = Date.now();
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + AI_KNOWLEDGE_CHUNK_CONFIG.LEASE_TIMEOUT_MS).toISOString();

    // Step 1: Query current document
    const { data: doc, error: fetchErr } = await supabaseAdmin
      .from('ai_knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (fetchErr) {
      throw new Error(`Lỗi truy vấn thông tin tài liệu: ${fetchErr.message}`);
    }

    if (!doc) {
      throw new Error(`Không tìm thấy tài liệu với mã ID: ${documentId}`);
    }

    // Guard: Do not process documents that are currently published directly
    if (doc.status === 'published') {
      throw new Error(
        'Tài liệu đã xuất bản không thể tái xử lý trực tiếp. Vui lòng tạo phiên bản mới hoặc gỡ xuất bản trước khi xử lý lại.'
      );
    }

    // Guard: Prevent concurrent processing under valid active lease
    if (doc.processing_status === 'processing') {
      if (doc.processing_lease_until && new Date(doc.processing_lease_until).getTime() > Date.now()) {
        throw new Error(
          'Tài liệu đang trong tiến trình xử lý bởi một tác vụ khác. Vui lòng chờ tác vụ hoàn tất.'
        );
      }
    }

    // Step 2: Atomic acquire lock
    const { data: lockedDoc, error: lockErr } = await supabaseAdmin
      .from('ai_knowledge_documents')
      .update({
        processing_status: 'processing',
        processing_started_at: now.toISOString(),
        processing_lease_until: leaseUntil,
        processing_worker_id: workerId,
        processing_attempts: (doc.processing_attempts || 0) + 1,
        error_message: null,
        updated_at: now.toISOString()
      })
      .eq('id', documentId)
      .select()
      .maybeSingle();

    if (lockErr || !lockedDoc) {
      throw new Error(`Không thể khóa tài liệu để xử lý: ${lockErr?.message || 'Tài liệu đã được tác vụ khác tiếp nhận.'}`);
    }

    try {
      // Step 3: Download file buffer from private storage
      const { data: fileData, error: storageErr } = await supabaseAdmin.storage
        .from(doc.storage_bucket)
        .download(doc.storage_path);

      if (storageErr || !fileData) {
        throw new Error(
          `Không thể tải tệp từ Storage (${doc.storage_bucket}/${doc.storage_path}): ${storageErr?.message || 'Tệp không tồn tại'}`
        );
      }

      let buffer: Buffer;
      if (Buffer.isBuffer(fileData)) {
        buffer = fileData;
      } else if (fileData && typeof (fileData as any).arrayBuffer === 'function') {
        const ab = await (fileData as any).arrayBuffer();
        buffer = Buffer.from(ab);
      } else if (fileData instanceof ArrayBuffer) {
        buffer = Buffer.from(fileData);
      } else {
        buffer = Buffer.from(fileData as any);
      }

      if (!buffer || buffer.length === 0) {
        throw new Error('Tệp tải xuống từ kho lưu trữ rỗng (0 bytes).');
      }

      if (buffer.length > AI_KNOWLEDGE_MAX_FILE_SIZE) {
        throw new Error('Dung lượng tệp vượt quá giới hạn tối đa cho phép (20 MB).');
      }

      // Step 4: Verify integrity content hash
      const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
      if (actualHash !== doc.content_hash) {
        throw new Error(
          'Mã băm toàn vẹn tệp (SHA-256) không khớp với giá trị đã đăng ký ban đầu. Tệp có thể đã bị thay đổi trái phép.'
        );
      }

      // Step 5: Extract text using appropriate extractor
      const extractor = ExtractorFactory.getExtractor(doc.mime_type, doc.original_file_name);
      const extractedDoc = await extractor.extract(buffer, doc.original_file_name);

      if (!extractedDoc || extractedDoc.blocks.length === 0 || !extractedDoc.fullText.trim()) {
        throw new Error(
          'Tài liệu không chứa văn bản hoặc văn bản không thể trích xuất được. Vui lòng kiểm tra lại định dạng tệp.'
        );
      }

      // Step 6: Split into natural chunks
      const chunks: AIKnowledgeChunk[] = this.chunker.chunkBlocks(
        extractedDoc.blocks,
        doc.id,
        AI_KNOWLEDGE_CHUNK_CONFIG.EMBEDDING_MODEL
      );

      if (chunks.length === 0) {
        throw new Error('Không tạo được đoạn văn bản nào từ tài liệu sau khi chuẩn hóa.');
      }

      // Step 7: Batch embedding creation via AI Gateway
      const batchSize = AI_KNOWLEDGE_CHUNK_CONFIG.BATCH_SIZE;
      let totalTokens = 0;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchTexts = batch.map(c => c.content);

        const embedResult = await aiGateway.embed(supabaseAdmin, {
          input: batchTexts,
          model: AI_KNOWLEDGE_CHUNK_CONFIG.EMBEDDING_MODEL
        });

        // Validate embeddings
        const validation = VectorValidator.validateBatch(
          embedResult,
          batchTexts.length,
          AI_KNOWLEDGE_CHUNK_CONFIG.EMBEDDING_DIMENSION
        );

        if (!validation.valid) {
          throw new Error(`Xác thực vector embedding thất bại tại lô ${Math.floor(i / batchSize) + 1}: ${validation.error}`);
        }

        // Assign vectors to chunks
        for (let j = 0; j < batch.length; j++) {
          batch[j].embedding = embedResult.embeddings[j];
          totalTokens += batch[j].token_count;
        }

        // Add small pause between batches to respect rate limits
        if (i + batchSize < chunks.length) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }

      // Step 8: Atomic replace chunks in database
      // 8a. Remove old chunks for this document
      const { error: delChunksErr } = await supabaseAdmin
        .from('ai_knowledge_chunks')
        .delete()
        .eq('document_id', documentId);

      if (delChunksErr) {
        throw new Error(`Lỗi dọn dẹp các chunk cũ: ${delChunksErr.message}`);
      }

      // 8b. Insert new chunks
      const chunkPayloads = chunks.map(c => ({
        document_id: documentId,
        chunk_index: c.chunk_index,
        content: c.content,
        content_hash: c.content_hash,
        token_count: c.token_count,
        page_number: c.page_number,
        section_title: c.section_title,
        embedding: c.embedding,
        embedding_model: c.embedding_model,
        created_at: new Date().toISOString()
      }));

      const { error: insertChunksErr } = await supabaseAdmin
        .from('ai_knowledge_chunks')
        .insert(chunkPayloads);

      if (insertChunksErr) {
        throw new Error(`Lỗi lưu trữ vector chunks vào cơ sở dữ liệu: ${insertChunksErr.message}`);
      }

      // 8c. Mark document as 'ready'
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      const { error: updateDocErr } = await supabaseAdmin
        .from('ai_knowledge_documents')
        .update({
          processing_status: 'ready',
          processing_completed_at: completedAt,
          processing_lease_until: null,
          processing_worker_id: null,
          chunk_count: chunks.length,
          embedding_model: AI_KNOWLEDGE_CHUNK_CONFIG.EMBEDDING_MODEL,
          processing_fingerprint: actualHash,
          error_message: null,
          updated_at: completedAt
        })
        .eq('id', documentId);

      if (updateDocErr) {
        throw new Error(`Lỗi cập nhật trạng thái sẵn sàng cho tài liệu: ${updateDocErr.message}`);
      }

      return {
        success: true,
        document_id: documentId,
        chunk_count: chunks.length,
        total_tokens: totalTokens,
        embedding_model: AI_KNOWLEDGE_CHUNK_CONFIG.EMBEDDING_MODEL,
        duration_ms: durationMs
      };
    } catch (err: any) {
      const sanitizedMessage = redactSecrets(err.message || 'Lỗi không xác định trong quá trình xử lý tài liệu.');

      // Safely transition document to 'failed' state with sanitized error
      try {
        await supabaseAdmin
          .from('ai_knowledge_documents')
          .update({
            processing_status: 'failed',
            processing_completed_at: new Date().toISOString(),
            processing_lease_until: null,
            processing_worker_id: null,
            error_message: sanitizedMessage,
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId);
      } catch (updateFailErr: any) {
        console.error(
          `[KnowledgeProcessingService] Failed to set error state for document ${documentId}:`,
          redactSecrets(updateFailErr.message)
        );
      }

      throw new Error(sanitizedMessage);
    }
  }
}

export const knowledgeProcessingService = new KnowledgeProcessingService();
