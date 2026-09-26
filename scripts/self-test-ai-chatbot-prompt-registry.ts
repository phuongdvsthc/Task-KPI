/**
 * Integration Self-Test: AI Prompt Registry -> Chatbot Integration
 * 
 * Verifies:
 * 1. Request tracing from Chat API -> ChatOrchestrator -> Prompt Registry -> Mock AI Provider.
 * 2. Case 1: Activate v1 -> Chatbot request uses v1 (system prompt v1, user prompt v1, version_id v1).
 * 3. Case 2: Create v2 as draft -> Chatbot request STILL uses active v1.
 * 4. Case 3: Activate v2 -> Chatbot subsequent request switches immediately to v2.
 * 5. Case 4: Authenticity & Sanitization -> Request contains real user question, authentic source snippet [S1], and NO {{...}} remnants.
 * 6. Case 5: Cache invalidation -> Activating new version takes immediate effect without stale reads.
 */

import { ChatOrchestrator } from '../src/services/ai/conversation/chatOrchestrator';
import { aiPromptRegistryService } from '../src/services/ai/aiPromptRegistry.service';
import { AIGateway, AIMessage } from '../src/services/ai/gateway';
import { ContextBuilder } from '../src/services/ai/knowledge/rag/contextBuilder';
import { SelectedContextChunk } from '../src/services/ai/knowledge/rag/rag.types';

interface CapturedProviderCall {
  taskType: string;
  systemInstruction?: string;
  messages: AIMessage[];
  metadata?: any;
}

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

async function runChatbotPromptRegistryIntegrationTest() {
  console.log('========================================================================');
  console.log('🚀 RUNNING INTEGRATION TEST: AI PROMPT REGISTRY -> CHATBOT (END-TO-END)');
  console.log('========================================================================\n');

  // In-memory Mock Database Store for Prompt Registry & Conversations
  const mockPromptDefinitions: any[] = [];
  const mockPromptVersions: any[] = [];
  const mockConversations: any[] = [];
  const mockMessages: any[] = [];

  // Captured calls to Mock AI Gateway / Provider
  const capturedCalls: CapturedProviderCall[] = [];

  // Mock AI Gateway
  const mockGateway = {
    async stream(supabaseAdmin: any, options: any, callbacks: any) {
      capturedCalls.push({
        taskType: options.taskType,
        systemInstruction: options.systemInstruction,
        messages: JSON.parse(JSON.stringify(options.messages)),
        metadata: options.metadata
      });

      // Stream delta and done
      callbacks?.onDelta?.('Phản hồi từ AI Provider');
      callbacks?.onUsage?.({ inputTokens: 50, outputTokens: 20, totalTokens: 70, isEstimated: false });
      callbacks?.onDone?.({ finishReason: 'STOP' });
    }
  } as unknown as AIGateway;

  // Mock Supabase Admin Client
  const mockSupabaseAdmin: any = {
    from: (table: string) => {
      let currentData: any[] = [];
      if (table === 'ai_prompt_definitions') currentData = mockPromptDefinitions;
      else if (table === 'ai_prompt_versions') currentData = mockPromptVersions;
      else if (table === 'ai_conversations') currentData = mockConversations;
      else if (table === 'ai_messages') currentData = mockMessages;

      const queryBuilder: any = {
        _filters: [] as ((item: any) => boolean)[],
        select: (fields?: string) => queryBuilder,
        eq: (col: string, val: any) => {
          queryBuilder._filters.push((item: any) => item[col] === val);
          return queryBuilder;
        },
        order: (col: string, opts?: any) => queryBuilder,
        limit: (n: number) => queryBuilder,
        single: async () => {
          const res = currentData.find(item => queryBuilder._filters.every(f => f(item)));
          if (!res) return { data: null, error: { message: 'Not found' } };
          return { data: JSON.parse(JSON.stringify(res)), error: null };
        },
        maybeSingle: async () => {
          const res = currentData.find(item => queryBuilder._filters.every(f => f(item)));
          return { data: res ? JSON.parse(JSON.stringify(res)) : null, error: null };
        },
        insert: (payload: any) => {
          const items = Array.isArray(payload) ? payload : [payload];
          const inserted = items.map((it, idx) => ({
            id: it.id || `gen-id-${Date.now()}-${idx}-${Math.random().toString(36).substring(7)}`,
            created_at: new Date().toISOString(),
            ...it
          }));
          currentData.push(...inserted);
          return {
            select: () => ({
              single: async () => ({ data: JSON.parse(JSON.stringify(inserted[0])), error: null })
            }),
            ...Promise.resolve({ data: inserted, error: null })
          };
        },
        update: (payload: any) => {
          return {
            eq: (col: string, val: any) => {
              queryBuilder._filters.push((item: any) => item[col] === val);
              const matched = currentData.filter(item => queryBuilder._filters.every(f => f(item)));
              for (const m of matched) {
                Object.assign(m, payload);
              }
              return {
                select: () => ({
                  single: async () => ({ data: JSON.parse(JSON.stringify(matched[0] || null)), error: null })
                }),
                eq: (col2: string, val2: any) => {
                  queryBuilder._filters.push((item: any) => item[col2] === val2);
                  const matched2 = currentData.filter(item => queryBuilder._filters.every(f => f(item)));
                  for (const m of matched2) {
                    Object.assign(m, payload);
                  }
                  return Promise.resolve({ data: matched2, error: null });
                },
                ...Promise.resolve({ data: matched, error: null })
              };
            }
          };
        }
      };
      return queryBuilder;
    },
    auth: {
      getUser: async () => ({ data: { user: { id: 'admin-user-id' } }, error: null })
    }
  };

  // Mock Conversation Repo
  const mockRepo: any = {
    findConversationByIdAndOwner: async (supabase: any, cid: string, uid: string) => {
      return { id: cid, owner_user_id: uid, title: 'Chat Test' };
    },
    findMessageByClientRequestId: async () => null,
    getNextSequenceNumber: async () => 1,
    createMessage: async (supabase: any, msg: any) => {
      const rec = { id: `msg-${Date.now()}`, ...msg };
      mockMessages.push(rec);
      return rec;
    },
    updateMessage: async (supabase: any, id: string, updates: any) => {
      const rec = mockMessages.find(m => m.id === id);
      if (rec) Object.assign(rec, updates);
    },
    updateConversationByOwner: async () => {}
  };

  const mockService: any = {
    buildPromptHistory: async () => []
  };

  const mockUsageTracking: any = {
    reserveUsage: async () => ({ allowed: true, requestId: 'test-req-1' }),
    finalizeUsage: async () => {}
  };

  // Mock RAG Retrieval returning a real document chunk with [S1]
  const mockChunk: SelectedContextChunk = {
    sourceId: 'S1',
    chunk_id: 'chk-101',
    document_id: 'doc-202',
    document_title: 'Quy chế Đào tạo & Khảo thí 2026',
    version_label: 'v1.0',
    page_number: 15,
    section_title: 'Mục 4.1: Điều kiện thi lại',
    content: 'Sinh viên có điểm chuyên cần từ 80% trở lên mới đủ điều kiện tham dự kỳ thi kết thúc học phần.',
    similarity_score: 0.95,
    token_count: 40,
    published_at: new Date().toISOString()
  };

  const mockRagRetrieval: any = {
    retrieve: async () => ({
      status: 'sources_found',
      selectedChunks: [mockChunk],
      sources: [{ sourceId: 'S1', title: mockChunk.document_title }]
    })
  };

  const orchestrator = new ChatOrchestrator({
    repo: mockRepo,
    service: mockService,
    gateway: mockGateway,
    ragRetrieval: mockRagRetrieval,
    usageTracking: mockUsageTracking
  });

  // Step 0: Setup Prompt Definition 'assistant.chat' in database
  const promptDefId = 'def-assistant-chat-uuid';
  mockPromptDefinitions.push({
    id: promptDefId,
    prompt_key: 'assistant.chat',
    name: 'AI Assistant Main Prompt',
    description: 'Chỉ dẫn hệ thống cho Chatbot Trợ lý AI',
    feature_group: 'assistant',
    enabled: true,
    created_at: new Date().toISOString()
  });

  // Step 1: Version 1 (v1.0 - Active)
  const v1Id = 'ver-v1-uuid';
  mockPromptVersions.push({
    id: v1Id,
    prompt_definition_id: promptDefId,
    version_number: 1,
    status: 'active',
    system_prompt: 'Bạn là Trợ lý AI phiên bản v1.0. Hãy trả lời câu hỏi dựa trên tài liệu được cung cấp.',
    user_prompt_template: 'Tài liệu tham khảo:\n{{context}}\n\nCâu hỏi của người dùng:\n{{question}}',
    output_mode: 'text',
    activated_at: new Date().toISOString()
  });

  // Invalidate any local service cache
  aiPromptRegistryService.invalidateCache('assistant.chat');

  console.log('--- TEST CA 1: Kích hoạt v1 -> Xác nhận Chatbot request dùng v1 ---');
  {
    capturedCalls.length = 0;
    const events: any[] = [];
    const emit = (ev: any) => events.push(ev);

    await orchestrator.streamChat(
      mockSupabaseAdmin,
      'user-1',
      'convo-1',
      { content: 'Điều kiện để sinh viên được thi lại là gì?' },
      new AbortController().signal,
      emit,
      { hasKnowledgeView: true }
    );

    assert(capturedCalls.length === 1, 'Ca 1.1: Provider AI nhận được 1 request');
    const call1 = capturedCalls[0];
    assert(
      call1.metadata?.promptKey === 'assistant.chat' && call1.metadata?.promptVersionId === v1Id && call1.metadata?.promptVersionNumber === 1,
      'Ca 1.2: Metadata request ghi nhận chính xác prompt_key (assistant.chat), version_id v1 và versionNumber 1'
    );
    assert(
      call1.systemInstruction?.includes('phiên bản v1.0'),
      'Ca 1.3: System Prompt chứa đúng chỉ thị của v1.0'
    );
    const userMsg = call1.messages[call1.messages.length - 1]?.content || '';
    assert(
      userMsg.includes('Tài liệu tham khảo:') && userMsg.includes('Điều kiện để sinh viên được thi lại là gì?'),
      'Ca 1.4: User Prompt Template render theo mẫu của v1 chứa câu hỏi thật của người dùng'
    );
  }

  console.log('\n--- TEST CA 2: Tạo v2 dạng bản nháp (Draft) -> Xác nhận request VẪN dùng v1 ---');
  const v2Id = 'ver-v2-uuid';
  mockPromptVersions.push({
    id: v2Id,
    prompt_definition_id: promptDefId,
    version_number: 2,
    status: 'draft',
    system_prompt: 'Bạn là Trợ lý AI CHUYÊN GIA phiên bản v2.0 NÂNG CAO. Trả lời súc tích và chính xác.',
    user_prompt_template: '=== KHỐI TÀI LIỆU V2 ===\n{{context}}\n\n=== CÂU HỎI V2 ===\n{{question}}',
    output_mode: 'text'
  });

  // Invalidate cache to simulate querying DB
  aiPromptRegistryService.invalidateCache('assistant.chat');

  {
    capturedCalls.length = 0;
    await orchestrator.streamChat(
      mockSupabaseAdmin,
      'user-1',
      'convo-1',
      { content: 'Sinh viên cần đạt bao nhiêu điểm chuyên cần?' },
      new AbortController().signal,
      () => {},
      { hasKnowledgeView: true }
    );

    assert(capturedCalls.length === 1, 'Ca 2.1: Provider AI nhận được request');
    const call2 = capturedCalls[0];
    assert(
      call2.metadata?.promptVersionId === v1Id && call2.metadata?.promptVersionNumber === 1,
      'Ca 2.2: Chatbot vẫn duy trì dùng v1, KHÔNG bị ảnh hưởng bởi bản nháp v2'
    );
    assert(
      call2.systemInstruction?.includes('phiên bản v1.0') && !call2.systemInstruction?.includes('v2.0 NÂNG CAO'),
      'Ca 2.3: System Prompt vẫn là của v1'
    );
    const userMsg2 = call2.messages[call2.messages.length - 1]?.content || '';
    assert(
      !userMsg2.includes('=== KHỐI TÀI LIỆU V2 ==='),
      'Ca 2.4: User Prompt không sử dụng template nháp của v2'
    );
  }

  console.log('\n--- TEST CA 3: Kích hoạt v2 (Activate) -> Xác nhận lượt chat kế tiếp chuyển sang v2 ---');
  // Retire v1 and activate v2
  const v1Record = mockPromptVersions.find(v => v.id === v1Id);
  const v2Record = mockPromptVersions.find(v => v.id === v2Id);
  if (v1Record) v1Record.status = 'retired';
  if (v2Record) {
    v2Record.status = 'active';
    v2Record.activated_at = new Date().toISOString();
  }

  // Cache invalidation triggered upon activate
  aiPromptRegistryService.invalidateCache('assistant.chat');

  {
    capturedCalls.length = 0;
    await orchestrator.streamChat(
      mockSupabaseAdmin,
      'user-1',
      'convo-1',
      { content: 'Sinh viên vắng bao nhiêu phần trăm thì bị cấm thi?' },
      new AbortController().signal,
      () => {},
      { hasKnowledgeView: true }
    );

    assert(capturedCalls.length === 1, 'Ca 3.1: Provider AI nhận được request');
    const call3 = capturedCalls[0];
    assert(
      call3.metadata?.promptVersionId === v2Id && call3.metadata?.promptVersionNumber === 2,
      'Ca 3.2: Chatbot lập tức chuyển sang sử dụng version_id v2 và versionNumber 2'
    );
    assert(
      call3.systemInstruction?.includes('v2.0 NÂNG CAO'),
      'Ca 3.3: System Prompt sử dụng chính xác chỉ thị của v2'
    );
    const userMsg3 = call3.messages[call3.messages.length - 1]?.content || '';
    assert(
      userMsg3.includes('=== KHỐI TÀI LIỆU V2 ===') && userMsg3.includes('=== CÂU HỎI V2 ==='),
      'Ca 3.4: User Prompt Template đã render theo cấu trúc mẫu mới của v2'
    );
  }

  console.log('\n--- TEST CA 4: Kiểm tra tính xác thực (Câu hỏi thật, Đoạn nguồn [S1], Không còn {{...}}) ---');
  {
    const call = capturedCalls[0];
    const userPrompt = call.messages[call.messages.length - 1]?.content || '';

    // Check authentic user question
    assert(
      userPrompt.includes('Sinh viên vắng bao nhiêu phần trăm thì bị cấm thi?'),
      'Ca 4.1: Request chứa nguyên vẹn câu hỏi thực tế của người dùng'
    );

    // Check authentic source citation [S1]
    assert(
      userPrompt.includes('[S1]') && userPrompt.includes('Quy chế Đào tạo & Khảo thí 2026'),
      'Ca 4.2: Request chứa mã nguồn trích dẫn [S1] và tên tài liệu thật'
    );

    // Check no unresolved curly braces {{...}}
    const unrenderedVariables = userPrompt.match(/\{\{([^}]+)\}\}/g);
    assert(
      unrenderedVariables === null,
      'Ca 4.3: Request không còn bất kỳ biến nào chưa được thay thế (không còn chuỗi {{...}})'
    );
  }

  console.log('\n--- TEST CA 5: Kiểm tra cơ chế Cache & Invalidation ---');
  {
    // First call caches the active v2
    const res1 = await aiPromptRegistryService.resolve(mockSupabaseAdmin, 'assistant.chat', {
      question: 'q1', context: 'c1'
    });
    assert(res1.promptVersionId === v2Id, 'Ca 5.1: Phân giải v2 thành công và đưa vào Cache');

    // Simulate switching active back to v1
    v2Record.status = 'retired';
    v1Record.status = 'active';

    // Without invalidation, cache would return v2
    // With invalidation (as done in activate endpoint):
    aiPromptRegistryService.invalidateCache('assistant.chat');

    const res2 = await aiPromptRegistryService.resolve(mockSupabaseAdmin, 'assistant.chat', {
      question: 'q2', context: 'c2'
    });
    assert(res2.promptVersionId === v1Id, 'Ca 5.2: Invalidation cache có hiệu lực ngay lập tức khi đổi active');
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(`📊 TỔNG KẾT INTEGRATION SELF-TEST: ${passedTests}/${totalTests} PASS`);
  console.log('------------------------------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runChatbotPromptRegistryIntegrationTest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
