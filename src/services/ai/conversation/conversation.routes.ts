import express from 'express';
import { conversationController } from './conversation.controller';
import { requireCapability } from '../../../../server/authorization/authorization.middleware';

/**
 * Registers AI Assistant Conversation routes.
 * Strictly maps endpoints to dynamic RBAC capabilities from AI-A4:
 * - POST /api/ai/conversations               -> ai.chat.use
 * - GET  /api/ai/conversations               -> ai.conversations.read_own
 * - GET  /api/ai/conversations/:id           -> ai.conversations.read_own
 * - GET  /api/ai/conversations/:id/messages  -> ai.conversations.read_own
 * - PATCH /api/ai/conversations/:id          -> ai.conversations.read_own
 * - POST /api/ai/conversations/:id/archive   -> ai.conversations.read_own
 * - DELETE /api/ai/conversations/:id         -> ai.conversations.delete_own
 * - POST /api/ai/conversations/:id/messages/stream -> ai.chat.use
 */
export function registerConversationRoutes(app: express.Express, authMiddleware: any) {
  // 1. Create conversation (ai.chat.use)
  app.post(
    '/api/ai/conversations',
    authMiddleware,
    requireCapability('ai.chat.use'),
    conversationController.createConversation
  );

  // 2. List conversations of current user (ai.conversations.read_own)
  app.get(
    '/api/ai/conversations',
    authMiddleware,
    requireCapability('ai.conversations.read_own'),
    conversationController.listConversations
  );

  // 3. Get single conversation of current user (ai.conversations.read_own)
  app.get(
    '/api/ai/conversations/:conversationId',
    authMiddleware,
    requireCapability('ai.conversations.read_own'),
    conversationController.getConversation
  );

  // 4. List messages of conversation of current user (ai.conversations.read_own)
  app.get(
    '/api/ai/conversations/:conversationId/messages',
    authMiddleware,
    requireCapability('ai.conversations.read_own'),
    conversationController.listMessages
  );

  // 5. Update title / status of conversation (ai.conversations.read_own)
  app.patch(
    '/api/ai/conversations/:conversationId',
    authMiddleware,
    requireCapability('ai.conversations.read_own'),
    conversationController.updateConversation
  );

  // 6. Archive conversation (ai.conversations.read_own)
  app.post(
    '/api/ai/conversations/:conversationId/archive',
    authMiddleware,
    requireCapability('ai.conversations.read_own'),
    conversationController.archiveConversation
  );

  // 7. Delete conversation (ai.conversations.delete_own)
  app.delete(
    '/api/ai/conversations/:conversationId',
    authMiddleware,
    requireCapability('ai.conversations.delete_own'),
    conversationController.deleteConversation
  );

  // 8. Send message and stream answer (ai.chat.use)
  app.post(
    '/api/ai/conversations/:conversationId/messages/stream',
    authMiddleware,
    requireCapability('ai.chat.use'),
    conversationController.streamMessage
  );
}
