import { Request, Response } from 'express';
import { conversationService, ConversationService } from './conversation.service';
import { chatOrchestrator, ChatOrchestrator } from './chatOrchestrator';
import { redactSecrets } from '../gateway';

export class ConversationController {
  constructor(
    private service: ConversationService = conversationService,
    private orchestrator: ChatOrchestrator = chatOrchestrator
  ) {}

  /**
   * Helper to extract authenticated user ID from request locals.
   * Rejects if missing or unauthenticated.
   */
  private getAuthenticatedUserId(req: Request, res: Response): string {
    const user = res.locals.user || (req as any).user;
    if (!user || !user.id) {
      throw new Error('UNAUTHENTICATED');
    }
    return user.id;
  }

  /**
   * Helper to get Supabase Admin client from request locals.
   */
  private getSupabaseAdmin(req: Request, res: Response): any {
    const client = res.locals.supabaseAdmin || (req as any).supabaseAdmin;
    if (!client) {
      throw new Error('DATABASE_CLIENT_UNAVAILABLE');
    }
    return client;
  }

  /**
   * POST /api/ai/conversations
   */
  createConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);

      // Validate title if present
      const rawTitle = req.body?.title;
      if (rawTitle !== undefined && typeof rawTitle !== 'string') {
        res.status(400).json({ error: 'Tiêu đề cuộc trò chuyện phải là chuỗi ký tự.' });
        return;
      }

      const conversation = await this.service.createConversation(supabaseAdmin, userId, {
        title: rawTitle
      });

      res.status(201).json(conversation);
    } catch (err: any) {
      console.error('[ConversationController:createConversation] Error:', redactSecrets(err.message));
      res.status(500).json({ error: 'Không thể tạo cuộc trò chuyện mới.' });
    }
  };

  /**
   * GET /api/ai/conversations
   */
  listConversations = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);

      const statusQuery = req.query.status as string;
      const validStatus = statusQuery === 'active' || statusQuery === 'archived' ? statusQuery : undefined;

      const rawLimit = parseInt(req.query.limit as string, 10);
      const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;
      const cursor = (req.query.cursor as string) || undefined;

      const result = await this.service.listConversations(supabaseAdmin, userId, {
        status: validStatus,
        limit,
        cursor
      });

      res.json(result);
    } catch (err: any) {
      console.error('[ConversationController:listConversations] Error:', redactSecrets(err.message));
      res.status(500).json({ error: 'Không thể tải danh sách cuộc trò chuyện.' });
    }
  };

  /**
   * GET /api/ai/conversations/:conversationId
   */
  getConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { conversationId } = req.params;

      if (!conversationId) {
        res.status(400).json({ error: 'Thiếu mã cuộc trò chuyện.' });
        return;
      }

      const conversation = await this.service.getConversation(supabaseAdmin, conversationId, userId);
      if (!conversation) {
        res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập.' });
        return;
      }

      res.json(conversation);
    } catch (err: any) {
      console.error('[ConversationController:getConversation] Error:', redactSecrets(err.message));
      res.status(500).json({ error: 'Không thể tải thông tin cuộc trò chuyện.' });
    }
  };

  /**
   * GET /api/ai/conversations/:conversationId/messages
   */
  listMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { conversationId } = req.params;

      if (!conversationId) {
        res.status(400).json({ error: 'Thiếu mã cuộc trò chuyện.' });
        return;
      }

      const rawLimit = parseInt(req.query.limit as string, 10);
      const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;

      const messages = await this.service.listMessages(supabaseAdmin, conversationId, userId, {
        limit
      });

      if (messages === null) {
        res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập.' });
        return;
      }

      res.json({ items: messages });
    } catch (err: any) {
      console.error('[ConversationController:listMessages] Error:', redactSecrets(err.message));
      res.status(500).json({ error: 'Không thể tải danh sách tin nhắn.' });
    }
  };

  /**
   * PATCH /api/ai/conversations/:conversationId
   */
  updateConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { conversationId } = req.params;

      if (!conversationId) {
        res.status(400).json({ error: 'Thiếu mã cuộc trò chuyện.' });
        return;
      }

      const { title, status } = req.body || {};

      if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
        res.status(400).json({ error: 'Tiêu đề không hợp lệ.' });
        return;
      }

      if (status !== undefined && status !== 'active' && status !== 'archived') {
        res.status(400).json({ error: 'Trạng thái chỉ có thể là active hoặc archived.' });
        return;
      }

      const updated = await this.service.updateConversation(supabaseAdmin, conversationId, userId, {
        title: title ? title.trim() : undefined,
        status
      });

      if (!updated) {
        res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập.' });
        return;
      }

      res.json(updated);
    } catch (err: any) {
      console.error('[ConversationController:updateConversation] Error:', redactSecrets(err.message));
      res.status(500).json({ error: 'Không thể cập nhật cuộc trò chuyện.' });
    }
  };

  /**
   * POST /api/ai/conversations/:conversationId/archive
   */
  archiveConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { conversationId } = req.params;

      if (!conversationId) {
        res.status(400).json({ error: 'Thiếu mã cuộc trò chuyện.' });
        return;
      }

      const updated = await this.service.archiveConversation(supabaseAdmin, conversationId, userId);
      if (!updated) {
        res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập.' });
        return;
      }

      res.json(updated);
    } catch (err: any) {
      console.error('[ConversationController:archiveConversation] Error:', redactSecrets(err.message));
      res.status(500).json({ error: 'Không thể lưu trữ cuộc trò chuyện.' });
    }
  };

  /**
   * DELETE /api/ai/conversations/:conversationId
   */
  deleteConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { conversationId } = req.params;

      if (!conversationId) {
        res.status(400).json({ error: 'Thiếu mã cuộc trò chuyện.' });
        return;
      }

      const success = await this.service.deleteConversation(supabaseAdmin, conversationId, userId);
      if (!success) {
        res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại hoặc bạn không có quyền xóa.' });
        return;
      }

      res.json({ success: true, message: 'Đã xóa cuộc trò chuyện thành công.' });
    } catch (err: any) {
      console.error('[ConversationController:deleteConversation] Error:', redactSecrets(err.message));
      res.status(500).json({ error: 'Không thể xóa cuộc trò chuyện.' });
    }
  };

  /**
   * POST /api/ai/conversations/:conversationId/messages/stream
   * Handles SSE streaming with anti-buffering headers and client abort detection.
   */
  streamMessage = async (req: Request, res: Response): Promise<void> => {
    let clientDisconnected = false;
    const abortController = new AbortController();

    const disconnectHandler = () => {
      clientDisconnected = true;
      abortController.abort();
    };

    req.on('close', disconnectHandler);

    try {
      const userId = this.getAuthenticatedUserId(req, res);
      const supabaseAdmin = this.getSupabaseAdmin(req, res);
      const { conversationId } = req.params;

      if (!conversationId) {
        res.status(400).json({ error: 'Thiếu mã cuộc trò chuyện.' });
        return;
      }

      const { content, clientRequestId } = req.body || {};

      // Validate content
      if (typeof content !== 'string' || content.trim().length === 0) {
        res.status(400).json({ error: 'Nội dung tin nhắn không được để trống.' });
        return;
      }

      if (content.length > 4000) {
        res.status(400).json({ error: 'Nội dung tin nhắn vượt quá giới hạn cho phép (tối đa 4000 ký tự).' });
        return;
      }

      if (clientRequestId && (typeof clientRequestId !== 'string' || clientRequestId.length > 128)) {
        res.status(400).json({ error: 'Mã clientRequestId không hợp lệ.' });
        return;
      }

      // Configure SSE Headers
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx proxy buffering
      res.flushHeaders?.();

      const emitEvent = (event: any) => {
        if (!clientDisconnected && !res.writableEnded) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
      };

      const authContext = res.locals.authContext;
      const hasKnowledgeView = authContext
        ? (authContext.effectivePermissions?.has?.('ai.knowledge.view') || authContext.systemRole === 'admin')
        : undefined;

      await this.orchestrator.streamChat(
        supabaseAdmin,
        userId,
        conversationId,
        { content, clientRequestId },
        abortController.signal,
        emitEvent,
        {
          hasKnowledgeView,
          authContext
        }
      );

      if (!clientDisconnected && !res.writableEnded) {
        res.end();
      }
    } catch (err: any) {
      if (!res.headersSent) {
        const status = err?.status || 500;
        res.status(status).json({
          error: err?.message || 'Đã xảy ra lỗi khi xử lý yêu cầu.'
        });
      } else if (!clientDisconnected && !res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            code: err?.code || 'AI_PROVIDER_UNAVAILABLE',
            message: err?.message || 'Không thể nhận câu trả lời lúc này.'
          })}\n\n`
        );
        res.end();
      }
    } finally {
      req.off('close', disconnectHandler);
    }
  };
}

export const conversationController = new ConversationController();
