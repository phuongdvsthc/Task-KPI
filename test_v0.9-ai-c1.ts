/**
 * Self-test suite for AI-C1: Admin quản lý kho tài liệu nội bộ
 * Run via: npx tsx test_v0.9-ai-c1.ts
 */

import { KnowledgeDocumentService } from './src/services/ai/knowledge/knowledgeDocument.service';
import {
  AI_KNOWLEDGE_ALLOWED_EXTENSIONS,
  AI_KNOWLEDGE_ALLOWED_MIME_TYPES,
  AI_KNOWLEDGE_MAX_FILE_SIZE,
  AI_KNOWLEDGE_STORAGE_BUCKET
} from './src/types/aiKnowledge';
import crypto from 'crypto';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('=== RUNNING AI-C1 SELF-TEST SUITE ===\n');

  const service = new KnowledgeDocumentService();

  // Test 1: File name sanitization
  console.log('--- Test 1: File name sanitization & Path traversal prevention ---');
  const dirty1 = '../../../etc/passwd.pdf';
  const clean1 = service.sanitizeFileName(dirty1);
  assert(!clean1.includes('/') && !clean1.includes('..') && clean1.endsWith('.pdf'), 'Strips directory traversal slashes');

  const dirty2 = 'Quy chế \x00 tuyển sinh 2025*?.docx';
  const clean2 = service.sanitizeFileName(dirty2);
  assert(!clean2.includes('\x00') && !clean2.includes('*') && !clean2.includes('?'), 'Strips control and illegal characters');

  // Test 2: File validation & Magic bytes
  console.log('\n--- Test 2: File format validation & Magic bytes ---');
  // Valid PDF with %PDF- header
  const validPdfBuffer = Buffer.from('%PDF-1.4 mock content here');
  const pdfVal = service.validateFile({
    originalname: 'test_doc.pdf',
    mimetype: 'application/pdf',
    size: validPdfBuffer.length,
    buffer: validPdfBuffer
  });
  assert(pdfVal.valid === true, 'Accepts valid PDF with %PDF- header');

  // Invalid PDF without %PDF- header
  const fakePdfBuffer = Buffer.from('NOT A PDF FILE');
  const fakePdfVal = service.validateFile({
    originalname: 'fake.pdf',
    mimetype: 'application/pdf',
    size: fakePdfBuffer.length,
    buffer: fakePdfBuffer
  });
  assert(fakePdfVal.valid === false && fakePdfVal.error?.includes('chữ ký tệp'), 'Rejects PDF with invalid magic bytes');

  // Valid DOCX with PK\x03\x04 header
  const validDocxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02]);
  const docxVal = service.validateFile({
    originalname: 'report.docx',
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: validDocxBuffer.length,
    buffer: validDocxBuffer
  });
  assert(docxVal.valid === true, 'Accepts valid DOCX with PK signature');

  // Rejection of disallowed extension (.exe, .bat, .zip)
  const exeBuffer = Buffer.from('MZ binary executable content');
  const exeVal = service.validateFile({
    originalname: 'malware.exe',
    mimetype: 'application/x-msdownload',
    size: exeBuffer.length,
    buffer: exeBuffer
  });
  assert(exeVal.valid === false, 'Rejects executable or non-whitelisted extension');

  // File size limit (20MB)
  const hugeBuffer = Buffer.alloc(AI_KNOWLEDGE_MAX_FILE_SIZE + 100);
  const hugeVal = service.validateFile({
    originalname: 'large.pdf',
    mimetype: 'application/pdf',
    size: hugeBuffer.length,
    buffer: hugeBuffer
  });
  assert(hugeVal.valid === false && hugeVal.error?.includes('20 MB'), 'Rejects files exceeding 20 MB');

  // Test 3: Content hash computation
  console.log('\n--- Test 3: SHA-256 Content Hash ---');
  const sampleData = Buffer.from('Internal Knowledge Document v1.0 content string');
  const expectedHash = crypto.createHash('sha256').update(sampleData).digest('hex');
  const actualHash = service.computeContentHash(sampleData);
  assert(actualHash === expectedHash, 'Computes deterministic SHA-256 hash');

  // Test 4: Storage path generation
  console.log('\n--- Test 4: Server-controlled Private Storage Path ---');
  const docId = 'doc-uuid-123';
  const verId = 'ver-uuid-456';
  const fileName = 'quy_dinh.pdf';
  const path = service.generateStoragePath(docId, verId, fileName);
  assert(path === `documents/${docId}/${verId}/${fileName}`, 'Generates server-controlled storage path matching convention');

  // Test 5: State Machine & Publication rules
  console.log('\n--- Test 5: State Machine & Publication constraints ---');
  // Mock DB client
  const mockDb: any = {
    docs: new Map<string, any>(),
    storage: {
      from: (bucket: string) => ({
        upload: async (p: string, b: any) => ({ error: null }),
        remove: async (paths: string[]) => ({ error: null }),
        createSignedUrl: async (p: string, exp: number) => ({
          data: { signedUrl: `https://supabase.local/storage/v1/object/sign/${bucket}/${p}?token=mock&expires=${exp}` },
          error: null
        })
      })
    },
    from: (table: string) => ({
      select: (cols?: string) => ({
        eq: (col: string, val: any) => ({
          maybeSingle: async () => ({ data: mockDb.docs.get(val) || null, error: null }),
          single: async () => ({ data: mockDb.docs.get(val) || null, error: null })
        })
      }),
      insert: (record: any) => ({
        select: () => ({
          single: async () => {
            mockDb.docs.set(record.id, record);
            return { data: record, error: null };
          }
        })
      }),
      update: (updates: any) => ({
        eq: (col: string, val: any) => ({
          select: () => ({
            single: async () => {
              const current = mockDb.docs.get(val) || {};
              const updated = { ...current, ...updates };
              mockDb.docs.set(val, updated);
              return { data: updated, error: null };
            }
          })
        })
      }),
      delete: () => ({
        eq: (col: string, val: any) => {
          mockDb.docs.delete(val);
          return Promise.resolve({ error: null });
        }
      })
    })
  };

  // 5a. Create document without warning confirmation -> Must fail
  let uploadErr: string | null = null;
  try {
    await service.createDocument(
      mockDb,
      'admin-1',
      {
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        size: validPdfBuffer.length,
        buffer: validPdfBuffer
      },
      {
        title: 'Quy chế nội bộ',
        category: 'quy_che',
        version_label: 'v1.0',
        warning_confirmed: false // false
      }
    );
  } catch (err: any) {
    uploadErr = err.message;
  }
  assert(uploadErr !== null && uploadErr.includes('xác nhận cảnh báo'), 'Rejects document upload when warning_confirmed is false');

  // 5b. Create document with warning confirmed -> Must succeed in 'draft' and 'pending'
  const createdDoc = await service.createDocument(
    mockDb,
    'admin-1',
    {
      originalname: 'doc.pdf',
      mimetype: 'application/pdf',
      size: validPdfBuffer.length,
      buffer: validPdfBuffer
    },
    {
      title: 'Quy chế tuyển sinh 2025',
      category: 'tuyen_sinh',
      version_label: 'v1.0',
      warning_confirmed: true
    }
  );
  assert(createdDoc.status === 'draft', 'New document status is initialised to draft');
  assert(createdDoc.processing_status === 'pending', 'New document processing_status is initialised to pending');
  assert(createdDoc.storage_bucket === AI_KNOWLEDGE_STORAGE_BUCKET, 'Uses private bucket ai-knowledge-docs');

  // 5c. Publish document when processing_status is NOT 'ready' -> Must fail
  let publishErr: string | null = null;
  try {
    await service.publishDocument(mockDb, 'admin-1', createdDoc.id, true);
  } catch (err: any) {
    publishErr = err.message;
  }
  assert(
    publishErr !== null && publishErr.includes('Chỉ tài liệu đã xử lý thành công (ready) mới được xuất bản'),
    'Enforces strict invariant: Cannot publish if processing_status != ready'
  );

  // 5d. Set processing_status = 'ready' and publish -> Must succeed
  mockDb.docs.get(createdDoc.id).processing_status = 'ready';
  const publishedDoc = await service.publishDocument(mockDb, 'admin-1', createdDoc.id, true);
  assert(publishedDoc.status === 'published', 'Document transitioned to published when ready');
  assert(publishedDoc.published_by === 'admin-1', 'Recorded published_by actor ID');
  assert(typeof publishedDoc.published_at === 'string', 'Recorded published_at timestamp');

  // 5e. Deactivate document -> Must transition to 'inactive'
  const deactivatedDoc = await service.deactivateDocument(mockDb, 'admin-1', createdDoc.id);
  assert(deactivatedDoc.status === 'inactive', 'Document transitioned to inactive');

  // 5f. Download URL generation (short-lived signed URL)
  const downloadInfo = await service.createDownloadUrl(mockDb, 'admin-1', createdDoc.id);
  assert(typeof downloadInfo.download_url === 'string', 'Generates signed download URL');
  assert(downloadInfo.expires_in_seconds === 300, 'Signed download URL expires in 300 seconds (short-lived)');

  // 5g. Delete document
  const deleteResult = await service.deleteDocument(mockDb, 'admin-1', createdDoc.id);
  assert(deleteResult.success === true, 'Deletes document from database and storage');

  console.log('\n=== TEST RESULTS ===');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
