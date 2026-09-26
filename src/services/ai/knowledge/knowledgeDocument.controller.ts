import { Request, Response } from 'express';
import { knowledgeDocumentService, KnowledgeDocumentService } from './knowledgeDocument.service';
import { knowledgeProcessingService, KnowledgeProcessingService } from './processing/knowledgeProcessing.service';
import { redactSecrets } from '../gateway';

export class KnowledgeDocumentController {
  constructor(
    private service: KnowledgeDocumentService = knowledgeDocumentService,
    private processingService: KnowledgeProcessingService = knowledgeProcessingService
  ) {}

  private getAuthenticatedUserId(req: Request, res: Response): string {
    const user = res.locals.user || (req as any).user;
    if (!user || !user.id) {
      throw new Error('UNAUTHENTICATED');
    }
    return user.id;
  }

  private getSupabaseAdmin(req: Request, res: Response): any {
    const client = res.locals.supabaseAdmin || (req as any).supabaseAdmin;
    if (!client) {
      throw new Error('DATABASE_CLIENT_UNAVAILABLE');
    }
    return client;
  }

  /**
   * GET /api/admin/ai/knowledge/documents
   */
  listDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const params = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        search: req.query.search as string | undefined,
        status: req.query.status as any,
        processing_status: req.query.processing_status as any,
        category: req.query.category as string | undefined,
        date_from: req.query.date_from as string | undefined,
        date_to: req.query.date_to as string | undefined,
        sort_by: req.query.sort_by as any,
        sort_order: req.query.sort_order as any
      };

      const result = await this.service.listDocuments(supabaseAdmin, params);
      res.json(result);
    } catch (err: any) {
      console.error('[KnowledgeDocumentController:listDocuments] Error:', redactSecrets(err.message));
      res.status(500).json({ error: err.message || 'Lỗi khi tải danh sách tài liệu.' });
    }
  };

  /**
   * GET /api/admin/ai/knowledge/documents/:documentId
   */
  getDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { documentId } = req.params;

      const doc = await this.service.getDocumentById(supabaseAdmin, documentId);
      if (!doc) {
        res.status(404).json({ error: 'Không tìm thấy tài liệu.' });
        return;
      }

      res.json(doc);
    } catch (err: any) {
      console.error('[KnowledgeDocumentController:getDocument] Error:', redactSecrets(err.message));
      res.status(500).json({ error: err.message || 'Lỗi khi lấy thông tin tài liệu.' });
    }
  };

  /**
   * POST /api/admin/ai/knowledge/documents
   */
  uploadDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'Vui lòng chọn một tệp để tải lên.' });
        return;
      }

      const warningConfirmed = req.body.warning_confirmed === true || req.body.warning_confirmed === 'true';

      const doc = await this.service.createDocument(
        supabaseAdmin,
        actorId,
        {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer
        },
        {
          title: req.body.title,
          description: req.body.description,
          category: req.body.category,
          version_label: req.body.version_label,
          effective_from: req.body.effective_from,
          effective_until: req.body.effective_until,
          warning_confirmed: warningConfirmed
        }
      );

      res.status(201).json(doc);
    } catch (err: any) {
      console.error('[KnowledgeDocumentController:uploadDocument] Error:', redactSecrets(err.message));
      res.status(400).json({ error: err.message || 'Lỗi khi tải lên tài liệu.' });
    }
  };

  /**
   * PATCH /api/admin/ai/knowledge/documents/:documentId
   */
  updateMetadata = async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { documentId } = req.params;

      const doc = await this.service.updateMetadata(supabaseAdmin, actorId, documentId, {
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        version_label: req.body.version_label,
        effective_from: req.body.effective_from,
        effective_until: req.body.effective_until
      });

      res.json(doc);
    } catch (err: any) {
      console.error('[KnowledgeDocumentController:updateMetadata] Error:', redactSecrets(err.message));
      res.status(400).json({ error: err.message || 'Lỗi khi cập nhật metadata.' });
    }
  };

  /**
   * POST /api/admin/ai/knowledge/documents/:documentId/download-url
   */
  createDownloadUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { documentId } = req.params;

      const downloadInfo = await this.service.createDownloadUrl(supabaseAdmin, actorId, documentId);
      res.json(downloadInfo);
    } catch (err: any) {
      console.error('[KnowledgeDocumentController:createDownloadUrl] Error:', redactSecrets(err.message));
      res.status(400).json({ error: err.message || 'Lỗi tạo liên kết tải về.' });
    }
  };

  /**
   * POST /api/admin/ai/knowledge/documents/:documentId/publish
   */
  publishDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { documentId } = req.params;
      const warningConfirmed = req.body.warning_confirmed === true || req.body.warning_confirmed === 'true';

      const doc = await this.service.publishDocument(
        supabaseAdmin,
        actorId,
        documentId,
        warningConfirmed
      );

      res.json(doc);
    } catch (err: any) {
      console.error('[KnowledgeDocumentController:publishDocument] Error:', redactSecrets(err.message));
      res.status(400).json({ error: err.message || 'Lỗi xuất bản tài liệu.' });
    }
  };

  /**
   * POST /api/admin/ai/knowledge/documents/:documentId/deactivate
   */
  deactivateDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { documentId } = req.params;

      const doc = await this.service.deactivateDocument(supabaseAdmin, actorId, documentId);
      res.json(doc);
    } catch (err: any) {
      console.error('[KnowledgeDocumentController:deactivateDocument] Error:', redactSecrets(err.message));
      res.status(400).json({ error: err.message || 'Lỗi ngừng sử dụng tài liệu.' });
    }
  };

  /**
   * DELETE /api/admin/ai/knowledge/documents/:documentId
   */
  deleteDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { documentId } = req.params;

      const result = await this.service.deleteDocument(supabaseAdmin, actorId, documentId);
      res.json(result);
    } catch (err: any) {
      console.error('[KnowledgeDocumentController:deleteDocument] Error:', redactSecrets(err.message));
      res.status(400).json({ error: err.message || 'Lỗi xóa tài liệu.' });
    }
  };

  /**
   * POST /api/admin/ai/knowledge/documents/:documentId/process
   * AI-C2 Document processing, chunking, and batch vector embedding
   */
  processDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { documentId } = req.params;

      const result = await this.processingService.processDocument(
        supabaseAdmin,
        documentId,
        `admin-api-${Date.now()}`
      );

      res.json(result);
    } catch (err: any) {
      console.error('[KnowledgeDocumentController:processDocument] Error:', redactSecrets(err.message));
      res.status(400).json({ error: err.message || 'Lỗi xử lý tài liệu và tạo vector embedding.' });
    }
  };

  /**
   * GET /api/admin/ai/knowledge/documents/:documentId/chunks
   * View processed chunks metadata (excludes raw vectors for payload efficiency)
   */
  listChunks = async (req: Request, res: Response): Promise<void> => {
    try {
      this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { documentId } = req.params;

      const { data: chunks, error } = await supabaseAdmin
        .from('ai_knowledge_chunks')
        .select('id, document_id, chunk_index, content, content_hash, token_count, page_number, section_title, embedding_model, created_at')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true });

      if (error) {
        throw new Error(`Lỗi tải danh sách chunk: ${error.message}`);
      }

      res.json(chunks || []);
    } catch (err: any) {
      console.error('[KnowledgeDocumentController:listChunks] Error:', redactSecrets(err.message));
      res.status(400).json({ error: err.message || 'Lỗi tải danh sách chunks.' });
    }
  };
}

export const knowledgeDocumentController = new KnowledgeDocumentController();
