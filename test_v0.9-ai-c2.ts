/**
 * Self-test suite for AI-C2: Xử lý tài liệu, chia đoạn và embedding
 * Run via: npx tsx test_v0.9-ai-c2.ts
 *
 * Adheres strictly to requirements:
 * 1. "Không gọi embedding provider thật trong automated test"
 * 2. "Không tạo tài liệu/chunk/embedding test trong database thật"
 * 3. "Không ghi nội dung tài liệu vào application log"
 */

import crypto from 'crypto';
import { TextNormalizer } from './src/services/ai/knowledge/processing/textNormalizer';
import { TextChunker } from './src/services/ai/knowledge/processing/textChunker';
import { VectorValidator } from './src/services/ai/knowledge/processing/vectorValidator';
import { ExtractorFactory } from './src/services/ai/knowledge/extractors/extractorFactory';
import { PlainTextExtractor } from './src/services/ai/knowledge/extractors/plainTextExtractor';
import { KnowledgeProcessingService } from './src/services/ai/knowledge/processing/knowledgeProcessing.service';
import { AI_KNOWLEDGE_CHUNK_CONFIG } from './src/types/aiKnowledge';
import { aiGateway } from './src/services/ai/gateway';

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
  console.log('=== RUNNING AI-C2 SELF-TEST SUITE ===\n');

  // =========================================================================
  // Test Group 1: Text Normalization (Unicode NFC, Whitespace, Line Endings)
  // =========================================================================
  console.log('--- Test Group 1: Text Normalization ---');

  // 1.1 Unicode NFC normalization
  // 'e\u0301' (decomposed NFD) vs 'é' (composed NFC)
  const nfdText = 'Quy đi\u0323nh tuyê\u0309n sinh Đa\u0323i ho\u0323c 2025';
  const nfcNormalized = TextNormalizer.normalize(nfdText);
  assert(
    nfcNormalized === nfdText.normalize('NFC'),
    '1.1 Converts Vietnamese text into canonical Unicode NFC form'
  );

  // 1.2 Line endings and excess whitespace
  const messyText = 'Đoạn 1.\r\n\r\n\r\n\r\nĐoạn 2   với    nhiều   khoảng trắng.\r\n\r\n';
  const cleanWhitespace = TextNormalizer.normalize(messyText);
  assert(
    !cleanWhitespace.includes('\r') && !cleanWhitespace.includes('   '),
    '1.2 Normalizes carriage returns (\\r\\n -> \\n) and collapses multi-spaces'
  );
  assert(
    !cleanWhitespace.includes('\n\n\n'),
    '1.3 Consolidates 3+ consecutive newlines into maximum 2 newlines'
  );

  // 1.4 Non-printable control characters removal (preserving \n and \t)
  const textWithControlChars = 'Văn bản\x00 có ký\x08 tự điều khiển\x1F ẩn.';
  const cleanedControls = TextNormalizer.normalize(textWithControlChars);
  assert(
    !cleanedControls.includes('\x00') && !cleanedControls.includes('\x08') && !cleanedControls.includes('\x1F'),
    '1.4 Strips non-printable ASCII control characters'
  );

  // 1.5 Header / Title cleanup
  const rawTitle = '  ###  1.2 QUY ĐỊNH CHUNG VỀ KHẢO THÍ :   ';
  const cleanedTitle = TextNormalizer.cleanSectionTitle(rawTitle);
  assert(
    cleanedTitle === '1.2 QUY ĐỊNH CHUNG VỀ KHẢO THÍ',
    '1.5 Cleans markdown heading symbols and trims section headers'
  );

  // =========================================================================
  // Test Group 2: Sentence Splitting & Token Estimation
  // =========================================================================
  console.log('\n--- Test Group 2: Sentence Splitting & Token Estimation ---');
  const chunker = new TextChunker();

  // 2.1 Token estimation heuristics
  const sampleVietnamese = 'Trường Đại học Phenikaa thông báo tuyển sinh đại học chính quy năm 2025.';
  const estimatedTokens = TextChunker.estimateTokens(sampleVietnamese);
  assert(
    estimatedTokens > 5 && estimatedTokens < 30,
    `2.1 Reasonable token count estimation (${estimatedTokens} tokens for 14 words)`
  );

  // 2.2 Vietnamese sentence boundary detection (handling abbreviations like ThS., TS., TP., PGS.)
  const paraWithAbbr = 'Theo thông báo của TS. Nguyễn Văn A tại TP. Hà Nội, kỳ thi sẽ diễn ra vào tháng 6. Thí sinh cần chuẩn bị kỹ.';
  const sentences = chunker.splitIntoSentences(paraWithAbbr);
  assert(
    sentences.length === 2,
    `2.2 Correctly avoids splitting on common abbreviations (TS., TP.) - got ${sentences.length} sentences`
  );
  assert(
    sentences[0].includes('TS. Nguyễn Văn A') && sentences[0].includes('TP. Hà Nội'),
    '2.3 Preserves titles/abbreviations inside the first sentence'
  );

  // =========================================================================
  // Test Group 3: Natural Chunking & Overlap Window
  // =========================================================================
  console.log('\n--- Test Group 3: Natural Chunking with Semantic Overlap ---');

  // Generate a multi-paragraph text block designed to exceed 900 tokens
  const longSentence = 'Quy chế này áp dụng cho toàn thể giảng viên, cán bộ quản lý và sinh viên đang theo học các hệ đào tạo chính quy tại Nhà trường trong suốt niên khóa. ';
  let longBody = '';
  for (let i = 0; i < 60; i++) {
    longBody += `Điều ${i + 1}: ${longSentence} Mọi quy định trước đây trái với điều khoản này đều bị bãi bỏ theo quyết định của Hội đồng trường.\n\n`;
  }

  const testDocId = 'doc-test-uuid-001';
  const chunks = chunker.chunkDocument(longBody, testDocId, 'text-embedding-004', 'Quy chế mẫu');

  assert(chunks.length >= 2, `3.1 Splits large text into multiple chunks (produced ${chunks.length} chunks)`);
  assert(chunks[0].chunk_index === 0 && chunks[1].chunk_index === 1, '3.2 Chunk indexes are sequentially zero-indexed');
  assert(chunks[0].document_id === testDocId, '3.3 Chunks retain parent document_id reference');

  // Verify token sizing within target boundaries
  const allWithinRange = chunks.every(
    c => c.token_count <= AI_KNOWLEDGE_CHUNK_CONFIG.MAX_TARGET_TOKENS + 100 // slight variance for oversized single sentences
  );
  assert(allWithinRange, '3.4 All chunks stay within maximum token limits');

  // Verify overlap: Chunk 1 tail should share text with Chunk 2 head
  const chunk1Words = chunks[0].content.split(/\s+/).slice(-15).join(' ');
  const chunk2StartsWithTail = chunks[1].content.includes(chunk1Words.slice(0, 30));
  assert(chunk2StartsWithTail, '3.5 Overlap window properly carries forward context between adjacent chunks');

  // Verify content hash generation
  assert(
    chunks[0].content_hash && chunks[0].content_hash.length === 64,
    '3.6 Each chunk includes SHA-256 content hash for change tracking'
  );

  // =========================================================================
  // Test Group 4: Vector Validator (Dimension & Numerical Checks)
  // =========================================================================
  console.log('\n--- Test Group 4: Vector Validator ---');

  // 4.1 Valid 768-dim float vector
  const validVector = Array.from({ length: 768 }, (_, i) => Math.sin(i));
  const validResult = VectorValidator.validateVector(validVector, 768);
  assert(validResult.valid === true, '4.1 Accepts valid 768-dimensional float vector');

  // 4.2 Invalid dimension (e.g. 1536 from OpenAI instead of 768 from Gemini text-embedding-004)
  const wrongDimVector = Array.from({ length: 1536 }, () => 0.05);
  const wrongDimResult = VectorValidator.validateVector(wrongDimVector, 768);
  assert(
    wrongDimResult.valid === false && wrongDimResult.error?.includes('768'),
    '4.2 Rejects vector with incorrect dimension count'
  );

  // 4.3 Rejects non-finite values (NaN, Infinity, null)
  const nanVector = [...validVector];
  nanVector[10] = NaN;
  const nanResult = VectorValidator.validateVector(nanVector, 768);
  assert(nanResult.valid === false && nanResult.error?.includes('NaN'), '4.3 Rejects vector containing NaN');

  const infVector = [...validVector];
  infVector[50] = Infinity;
  const infResult = VectorValidator.validateVector(infVector, 768);
  assert(infResult.valid === false && infResult.error?.includes('hữu hạn'), '4.4 Rejects vector containing Infinity');

  // 4.4 Batch validation
  const batchResult = VectorValidator.validateBatch(
    {
      embeddings: [validVector, validVector],
      model: 'text-embedding-004',
      token_count: 500
    },
    2,
    768
  );
  assert(batchResult.valid === true, '4.5 Accepts valid batch embedding result matching requested count');

  const batchCountMismatch = VectorValidator.validateBatch(
    {
      embeddings: [validVector],
      model: 'text-embedding-004',
      token_count: 250
    },
    2,
    768
  );
  assert(
    batchCountMismatch.valid === false,
    '4.6 Rejects batch when returned embeddings count does not match input batch size'
  );

  // =========================================================================
  // Test Group 5: Text Extractors & ExtractorFactory
  // =========================================================================
  console.log('\n--- Test Group 5: Text Extractors & Factory ---');

  const plainExtractor = new PlainTextExtractor();
  const rawMarkdown = '# Tuyển sinh 2025\n\nQuy định tuyển sinh chi tiết.\n\n## Ngành Công nghệ thông tin\nĐiểm sàn: 24.0';
  const extractedMd = await plainExtractor.extract(Buffer.from(rawMarkdown, 'utf-8'), 'tuyensinh.md');

  assert(extractedMd.blocks.length >= 2, '5.1 PlainTextExtractor extracts blocks with section titles');
  assert(
    extractedMd.blocks[0].sectionTitle === 'Tuyển sinh 2025',
    '5.2 Extracts first markdown section heading'
  );
  assert(
    extractedMd.blocks[1].sectionTitle === 'Ngành Công nghệ thông tin',
    '5.3 Extracts subsequent section heading'
  );

  // Factory selection
  const pdfExtractor = ExtractorFactory.getExtractor('application/pdf', 'document.pdf');
  assert(pdfExtractor !== null, '5.4 Factory resolves PDF extractor for application/pdf');

  const docxExtractor = ExtractorFactory.getExtractor(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'file.docx'
  );
  assert(docxExtractor !== null, '5.5 Factory resolves DOCX extractor for docx');

  let unsupportedThrown = false;
  try {
    ExtractorFactory.getExtractor('application/zip', 'archive.zip');
  } catch {
    unsupportedThrown = true;
  }
  assert(unsupportedThrown, '5.6 Factory throws error for unsupported file MIME type');

  // =========================================================================
  // Test Group 6: Full Processing Pipeline Orchestration (In-Memory Mock)
  // =========================================================================
  console.log('\n--- Test Group 6: End-to-End Processing Pipeline Orchestration ---');

  // In-memory document and chunk database (no real DB touched)
  const mockFileContent = `# Quy chế Công tác Sinh viên
Chương 1: Những quy định chung.
Sinh viên có nghĩa vụ chấp hành nghiêm túc quy định của nhà trường và pháp luật nhà nước.
Chương 2: Quyền và nghĩa vụ học tập.
Sinh viên được quyền tiếp cận học liệu, tham gia nghiên cứu khoa học và rèn luyện kỹ năng thực hành.
Nhà trường đảm bảo môi trường học tập an toàn, minh bạch và hỗ trợ sinh viên tối đa trong quá trình học tập.`;

  const fileBuffer = Buffer.from(mockFileContent, 'utf-8');
  const contentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const mockDb = {
    documents: new Map<string, any>(),
    chunks: [] as any[],
    storage: new Map<string, Buffer>()
  };

  const sampleDocId = 'doc-mock-process-123';
  const storageBucket = 'ai-knowledge-docs';
  const storagePath = `documents/${sampleDocId}/v1/sample.md`;

  // Seed storage and document in draft/pending state
  mockDb.storage.set(`${storageBucket}/${storagePath}`, fileBuffer);
  mockDb.documents.set(sampleDocId, {
    id: sampleDocId,
    title: 'Quy chế Công tác Sinh viên',
    status: 'draft',
    processing_status: 'pending',
    original_file_name: 'sample.md',
    mime_type: 'text/markdown',
    file_size: fileBuffer.length,
    content_hash: contentHash,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    processing_attempts: 0
  });

  // Mock Supabase admin client matching query chain
  const mockSupabaseAdmin: any = {
    from: (table: string) => {
      let filterCol = '';
      let filterVal: any = null;

      const queryBuilder: any = {
        select: (cols: string) => queryBuilder,
        eq: (col: string, val: any) => {
          filterCol = col;
          filterVal = val;
          return queryBuilder;
        },
        maybeSingle: async () => {
          if (table === 'ai_knowledge_documents') {
            const doc = mockDb.documents.get(filterVal);
            return { data: doc ? { ...doc } : null, error: null };
          }
          return { data: null, error: null };
        },
        update: (updates: any) => {
          return {
            eq: (col: string, val: any) => {
              return {
                select: () => ({
                  maybeSingle: async () => {
                    if (table === 'ai_knowledge_documents') {
                      const doc = mockDb.documents.get(val);
                      if (doc) {
                        const updated = { ...doc, ...updates };
                        mockDb.documents.set(val, updated);
                        return { data: updated, error: null };
                      }
                    }
                    return { data: null, error: null };
                  }
                }),
                then: (resolve: any) => {
                  if (table === 'ai_knowledge_documents') {
                    const doc = mockDb.documents.get(val);
                    if (doc) {
                      mockDb.documents.set(val, { ...doc, ...updates });
                    }
                  }
                  resolve({ error: null });
                }
              };
            }
          };
        },
        delete: () => {
          return {
            eq: (col: string, val: any) => {
              if (table === 'ai_knowledge_chunks') {
                mockDb.chunks = mockDb.chunks.filter(c => c.document_id !== val);
              }
              return Promise.resolve({ error: null });
            }
          };
        },
        insert: async (records: any[]) => {
          if (table === 'ai_knowledge_chunks') {
            mockDb.chunks.push(...records);
          }
          return { error: null };
        }
      };

      return queryBuilder;
    },
    storage: {
      from: (bucket: string) => ({
        download: async (path: string) => {
          const buf = mockDb.storage.get(`${bucket}/${path}`);
          if (!buf) return { data: null, error: { message: 'File not found' } };
          return { data: buf, error: null };
        }
      })
    }
  };

  // Mock aiGateway.embed to return synthetic 768-dim vectors without real external API calls
  const originalEmbed = aiGateway.embed;
  aiGateway.embed = async (_client: any, request: any) => {
    const inputCount = Array.isArray(request.input) ? request.input.length : 1;
    const mockEmbeddings = Array.from({ length: inputCount }, () =>
      Array.from({ length: 768 }, (_, idx) => 0.01 * (idx % 10))
    );
    return {
      embeddings: mockEmbeddings,
      model: 'text-embedding-004',
      token_count: inputCount * 120
    };
  };

  try {
    const procService = new KnowledgeProcessingService();

    // 6.1 Execute processing
    const processResult = await procService.processDocument(mockSupabaseAdmin, sampleDocId, 'test-worker-1');
    assert(processResult.success === true, '6.1 Pipeline execution finishes successfully');
    assert(processResult.chunk_count > 0, `6.2 Generates positive chunk count (${processResult.chunk_count} chunks)`);
    assert(processResult.embedding_model === 'text-embedding-004', '6.3 Uses text-embedding-004 model');

    // 6.4 Document state verification
    const docAfter = mockDb.documents.get(sampleDocId);
    assert(docAfter.processing_status === 'ready', '6.4 Document status transitioned to "ready"');
    assert(docAfter.chunk_count === processResult.chunk_count, '6.5 Document record reflects accurate chunk_count');
    assert(docAfter.processing_completed_at !== null, '6.6 processing_completed_at timestamp recorded');
    assert(docAfter.processing_lease_until === null, '6.7 Processing lease released');
    assert(docAfter.error_message === null, '6.8 error_message is cleared on success');

    // 6.9 Stored chunks verification
    assert(mockDb.chunks.length === processResult.chunk_count, '6.9 Chunks persisted to ai_knowledge_chunks table');
    assert(
      mockDb.chunks[0].embedding.length === 768,
      '6.10 Chunks store exact 768-dimensional vector embedding'
    );
    assert(
      mockDb.chunks[0].embedding_model === 'text-embedding-004',
      '6.11 Embedding model metadata stored alongside vector'
    );

    // 6.12 Idempotent re-run / replacement
    // Processing again replaces previous chunks rather than appending duplicates
    await procService.processDocument(mockSupabaseAdmin, sampleDocId, 'test-worker-2');
    assert(
      mockDb.chunks.length === processResult.chunk_count,
      '6.12 Idempotent reprocessing deletes old chunks and maintains exact chunk count'
    );

    // 6.13 Failure handling: Integrity hash mismatch
    const corruptedDocId = 'doc-corrupted-hash';
    mockDb.documents.set(corruptedDocId, {
      ...mockDb.documents.get(sampleDocId),
      id: corruptedDocId,
      content_hash: 'wrong-hash-000000000000000000000000000000000000000000000000000000000000',
      processing_status: 'pending'
    });

    let hashErrThrown = false;
    try {
      await procService.processDocument(mockSupabaseAdmin, corruptedDocId);
    } catch (e: any) {
      hashErrThrown = true;
      assert(
        e.message.includes('Mã băm toàn vẹn'),
        '6.13 Rejects processing if SHA-256 integrity hash does not match'
      );
    }
    assert(hashErrThrown, '6.14 Error thrown on integrity mismatch');

    const corruptedDocAfter = mockDb.documents.get(corruptedDocId);
    assert(
      corruptedDocAfter.processing_status === 'failed',
      '6.15 Corrupted document transitioned safely to "failed" status'
    );
    assert(
      corruptedDocAfter.error_message && corruptedDocAfter.error_message.includes('toàn vẹn'),
      '6.16 Error message stored in document for administrator review'
    );

    // 6.17 Concurrency lease lock
    const lockedDocId = 'doc-locked-test';
    const futureLease = new Date(Date.now() + 60000).toISOString();
    mockDb.documents.set(lockedDocId, {
      ...mockDb.documents.get(sampleDocId),
      id: lockedDocId,
      processing_status: 'processing',
      processing_lease_until: futureLease
    });

    let leaseLockThrown = false;
    try {
      await procService.processDocument(mockSupabaseAdmin, lockedDocId);
    } catch (e: any) {
      leaseLockThrown = true;
      assert(e.message.includes('tiến trình xử lý bởi một tác vụ khác'), '6.17 Active lease prevents concurrent processing');
    }
    assert(leaseLockThrown, '6.18 Concurrency lease guard prevented overlapping execution');
  } finally {
    // Restore aiGateway embed method
    aiGateway.embed = originalEmbed;
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n=======================================');
  console.log(`AI-C2 TEST SUMMARY: Passed: ${testsPassed}, Failed: ${testsFailed}`);
  console.log('=======================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
