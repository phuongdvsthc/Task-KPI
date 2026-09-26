/**
 * Automated Self-Test: Prompt Registry User Prompt Template Rendering & RAG Context Verification
 * 
 * Verifies:
 * 1. Syntax of supported variables (Mustache {{variable}} vs single {variable}).
 * 2. Missing variable detection (throws AIPromptError.VARIABLE_MISSING).
 * 3. Accurate rendering of Real User Question, Real Document Context ([S1], [S2]), and Conversation History.
 * 4. Verifies that all template variables are completely replaced (no {{...}} remnants).
 * 5. Verifies the generated AI payload contains authentic question content and document snippets with citations [S1], [S2].
 */

import { aiPromptRegistryService } from '../src/services/ai/aiPromptRegistry.service';
import { AIPromptError, PromptErrorCodes } from '../src/types/ai_prompt';
import { contextBuilder } from '../src/services/ai/knowledge/rag/contextBuilder';
import { SelectedContextChunk } from '../src/services/ai/knowledge/rag/rag.types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

async function runSelfTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING SELF-TEST: AI PROMPT REGISTRY TEMPLATE RENDERING & RAG');
  console.log('================================================================\n');

  // Test 1: Mustache Syntax {{var}} is supported and replaces trimmed keys
  {
    const template = 'Xin chào {{ name }}, câu hỏi của bạn là: {{ question }}';
    const variables = { name: 'Nguyễn Văn A', question: 'Chính sách làm việc từ xa như thế nào?' };
    const rendered = aiPromptRegistryService.renderPromptTemplate(template, variables);

    assert(
      rendered === 'Xin chào Nguyễn Văn A, câu hỏi của bạn là: Chính sách làm việc từ xa như thế nào?',
      'Test 1: Render đúng cú pháp {{variable}} với khoảng trắng linh hoạt (trimming)'
    );
  }

  // Test 2: Single curly braces {var} are NOT treated as dynamic variables by the regex
  {
    const singleBraceTemplate = 'Context: {context} | Question: {question}';
    const variables = { context: 'Đoạn văn tài liệu', question: 'Câu hỏi test' };
    const rendered = aiPromptRegistryService.renderPromptTemplate(singleBraceTemplate, variables);

    assert(
      rendered === 'Context: {context} | Question: {question}',
      'Test 2: Cú pháp {var} (ngoặc đơn) không được thay thế bởi engine {{...}} hiện tại'
    );
  }

  // Test 3: Missing required variable throws AIPromptError
  {
    let errorCaught = false;
    let errorCode = '';
    try {
      const template = 'Tài liệu: {{context}}\nCâu hỏi: {{question}}';
      aiPromptRegistryService.renderPromptTemplate(template, { question: 'Tìm hiểu quy chế' }); // missing context
    } catch (err: any) {
      if (err instanceof AIPromptError) {
        errorCaught = true;
        errorCode = err.code;
      }
    }

    assert(
      errorCaught && errorCode === PromptErrorCodes.VARIABLE_MISSING,
      'Test 3: Ném lỗi AIPromptError (VARIABLE_MISSING) nếu thiếu biến được khai báo trong {{...}}'
    );
  }

  // Test 4: Realistic RAG Document context representation with [S1], [S2]
  {
    const sampleChunks: SelectedContextChunk[] = [
      {
        sourceId: 'S1',
        chunk_id: 'chunk-001',
        document_id: 'doc-001',
        document_title: 'Quy chế Đánh giá KPI & Khen thưởng 2026',
        version_label: 'v2.0',
        page_number: 14,
        section_title: 'Mục 3.2: Tiêu chuẩn xếp loại xuất sắc',
        content: 'Nhân viên đạt điểm đánh giá KPI từ 95% trở lên và không có vi phạm kỷ luật được xếp loại Hoàn thành xuất sắc nhiệm vụ.',
        similarity_score: 0.92,
        token_count: 50,
        published_at: new Date().toISOString()
      },
      {
        sourceId: 'S2',
        chunk_id: 'chunk-002',
        document_id: 'doc-002',
        document_title: 'Sổ tay Văn hóa & Quy định Doanh nghiệp',
        version_label: 'v1.5',
        page_number: 8,
        section_title: 'Chương 2: Thời hạn nộp báo cáo công việc',
        content: 'Báo cáo công việc hàng ngày phải được gửi trước 17:30 cùng ngày làm việc qua hệ thống quản trị nội bộ.',
        similarity_score: 0.88,
        token_count: 45,
        published_at: new Date().toISOString()
      }
    ];

    const builtContext = contextBuilder.buildContext(sampleChunks);
    
    assert(
      builtContext.formattedContext.includes('[S1]') &&
      builtContext.formattedContext.includes('[S2]') &&
      builtContext.formattedContext.includes('--- BẮT ĐẦU TÀI LIỆU NỘI BỘ THAM KHẢO ---') &&
      builtContext.formattedContext.includes('Quy chế Đánh giá KPI & Khen thưởng 2026') &&
      builtContext.formattedContext.includes('Sổ tay Văn hóa & Quy định Doanh nghiệp'),
      'Test 4: ContextBuilder định dạng chuẩn hóa mã nguồn [S1], [S2] và hàng rào phòng vệ prompt-injection'
    );

    // Test 5: Full prompt template rendering with {{conversation_history}}, {{context}}, {{question}}
    const correctedUserPromptTemplate = `LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ:
{{conversation_history}}

TÀI LIỆU NỘI BỘ THAM KHẢO:
{{context}}

CÂU HỎI HIỆN TẠI CỦA NGƯỜI DÙNG:
{{question}}`;

    const realVariables = {
      conversation_history: '- User: Xin chào\n- Assistant: Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?',
      context: builtContext.formattedContext,
      question: 'Nhân viên cần đạt bao nhiêu phần trăm KPI để được xếp loại xuất sắc, và báo cáo ngày phải nộp trước mấy giờ?'
    };

    const finalRenderedPrompt = aiPromptRegistryService.renderPromptTemplate(correctedUserPromptTemplate, realVariables);

    // Check no unresolved variables remain
    const unresolvedMatches = finalRenderedPrompt.match(/\{\{([^}]+)\}\}/g);
    assert(
      unresolvedMatches === null,
      'Test 5.1: Không còn bất kỳ biến {{...}} nào chưa được thay thế trong kết quả render'
    );

    // Check authentic user question exists in prompt
    assert(
      finalRenderedPrompt.includes('Nhân viên cần đạt bao nhiêu phần trăm KPI để được xếp loại xuất sắc'),
      'Test 5.2: Chứa câu hỏi thực tế của người dùng'
    );

    // Check authentic document text and citations exist in prompt
    assert(
      finalRenderedPrompt.includes('[S1]') &&
      finalRenderedPrompt.includes('Nhân viên đạt điểm đánh giá KPI từ 95% trở lên') &&
      finalRenderedPrompt.includes('[S2]') &&
      finalRenderedPrompt.includes('Báo cáo công việc hàng ngày phải được gửi trước 17:30'),
      'Test 5.3: Chứa nội dung đoạn trích tài liệu thật cùng mã nguồn trích dẫn [S1] và [S2]'
    );
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`📊 KẾT QUẢ SELF-TEST: ${passedTests}/${totalTests} PASS`);
  console.log('----------------------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSelfTests().catch((err) => {
  console.error('Self-test error:', err);
  process.exit(1);
});
