import express from 'express';
import multer from 'multer';
import { requireCapability } from '../../../../server/authorization/authorization.middleware';
import { knowledgeDocumentController } from './knowledgeDocument.controller';
import { AI_KNOWLEDGE_MAX_FILE_SIZE } from '../../../types/aiKnowledge';

export function registerKnowledgeDocumentRoutes(app: express.Express, authMiddleware: any) {
  // Use memory storage for buffer-based validation & magic byte check before storage
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: AI_KNOWLEDGE_MAX_FILE_SIZE, // 20 MB
      files: 1
    }
  });

  const basePrefix = '/api/admin/ai/knowledge/documents';
  // Capability requirement: ai.knowledge.manage
  const requireManage = requireCapability('ai.knowledge.manage');

  // 1. GET /api/admin/ai/knowledge/documents
  app.get(
    basePrefix,
    authMiddleware,
    requireManage,
    knowledgeDocumentController.listDocuments
  );

  // 2. GET /api/admin/ai/knowledge/documents/:documentId
  app.get(
    `${basePrefix}/:documentId`,
    authMiddleware,
    requireManage,
    knowledgeDocumentController.getDocument
  );

  // 3. POST /api/admin/ai/knowledge/documents
  app.post(
    basePrefix,
    authMiddleware,
    requireManage,
    (req, res, next) => {
      upload.single('file')(req, res, (err: any) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Dung lượng tệp vượt quá giới hạn 20 MB.' });
          }
          return res.status(400).json({ error: err.message || 'Lỗi xử lý tệp tải lên.' });
        }
        next();
      });
    },
    knowledgeDocumentController.uploadDocument
  );

  // 4. PATCH /api/admin/ai/knowledge/documents/:documentId
  app.patch(
    `${basePrefix}/:documentId`,
    authMiddleware,
    requireManage,
    knowledgeDocumentController.updateMetadata
  );

  // 5. POST /api/admin/ai/knowledge/documents/:documentId/download-url
  app.post(
    `${basePrefix}/:documentId/download-url`,
    authMiddleware,
    requireManage,
    knowledgeDocumentController.createDownloadUrl
  );

  // 6. POST /api/admin/ai/knowledge/documents/:documentId/publish
  app.post(
    `${basePrefix}/:documentId/publish`,
    authMiddleware,
    requireManage,
    knowledgeDocumentController.publishDocument
  );

  // 7. POST /api/admin/ai/knowledge/documents/:documentId/deactivate
  app.post(
    `${basePrefix}/:documentId/deactivate`,
    authMiddleware,
    requireManage,
    knowledgeDocumentController.deactivateDocument
  );

  // 8. DELETE /api/admin/ai/knowledge/documents/:documentId
  app.delete(
    `${basePrefix}/:documentId`,
    authMiddleware,
    requireManage,
    knowledgeDocumentController.deleteDocument
  );

  // 9. POST /api/admin/ai/knowledge/documents/:documentId/process (AI-C2)
  app.post(
    `${basePrefix}/:documentId/process`,
    authMiddleware,
    requireManage,
    knowledgeDocumentController.processDocument
  );

  // 10. GET /api/admin/ai/knowledge/documents/:documentId/chunks (AI-C2)
  app.get(
    `${basePrefix}/:documentId/chunks`,
    authMiddleware,
    requireManage,
    knowledgeDocumentController.listChunks
  );
}
