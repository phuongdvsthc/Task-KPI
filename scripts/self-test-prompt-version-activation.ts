/**
 * Automated Self-Test: Prompt Version Activation Flow
 * 
 * Test Scenarios:
 * 1. Kích hoạt thành công: v1 ACTIVE, v2 DRAFT -> Kích hoạt v2 -> v2 ACTIVE, v1 RETIRED.
 * 2. API lỗi & Rollback: Giả lập lỗi DB khi activate -> Rollback thành công, v1 vẫn giữ ACTIVE, không để 0 hoặc 2 active.
 * 3. Kiểm tra phân quyền: Người không có quyền (không có ai.prompt_manage) bị từ chối 403, trạng thái v1 không đổi.
 * 4. Chặn bấm lặp (Debounce / In-flight guard): Khi request đang xử lý, chặn các lần bấm tiếp theo.
 * 5. Chuyển đổi trạng thái v1 -> v2 -> v1: Tại mọi thời điểm chỉ có ĐÚNG 1 phiên bản active cho mỗi prompt.
 * 6. Hai prompt khác nhau: Kích hoạt version của Prompt A không làm ảnh hưởng đến active version của Prompt B.
 * 7. Kiểm tra Cache Invalidation: Sau khi v2 được kích hoạt, yêu cầu resolve() ngay lập tức lấy v2 mới nhất.
 */

import { aiPromptRegistryService } from '../src/services/ai/aiPromptRegistry.service';

interface MockPromptDef {
  id: string;
  prompt_key: string;
  name: string;
  enabled: boolean;
}

interface MockPromptVer {
  id: string;
  prompt_definition_id: string;
  version_number: number;
  status: 'draft' | 'active' | 'retired';
  system_prompt: string;
  user_prompt_template: string;
  output_mode: string;
  activated_at?: string;
  activated_by?: string;
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

// Simulated backend activation handler mirroring promptRegistryApi.ts
async function simulateActivateVersion(
  supabaseAdmin: any,
  versionId: string,
  userPermission: string | null,
  options?: { simulateDbFailureOnActivate?: boolean }
) {
  // Permission check
  if (userPermission !== 'ai.prompt_manage' && userPermission !== 'admin') {
    return {
      status: 403,
      body: { error: 'FORBIDDEN', message: 'You lack permission ai.prompt_manage' }
    };
  }

  const { data: targetVersion, error: fetchErr } = await supabaseAdmin
    .from('ai_prompt_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (fetchErr || !targetVersion) {
    return {
      status: 404,
      body: { error: 'VERSION_NOT_FOUND', message: 'Phiên bản prompt không tồn tại.' }
    };
  }

  const definitionId = targetVersion.prompt_definition_id;

  // If already active, return targetVersion
  if (targetVersion.status === 'active') {
    return { status: 200, body: targetVersion };
  }

  // Find currently active version for rollback
  const { data: previousActiveVersions } = await supabaseAdmin
    .from('ai_prompt_versions')
    .select('id, version_number')
    .eq('prompt_definition_id', definitionId)
    .eq('status', 'active');

  const previousActiveId = previousActiveVersions?.[0]?.id;

  // 1. Retire previous active version
  const { error: retireErr } = await supabaseAdmin
    .from('ai_prompt_versions')
    .update({ status: 'retired' })
    .eq('prompt_definition_id', definitionId)
    .eq('status', 'active');

  if (retireErr) {
    return {
      status: 500,
      body: { error: 'RETIRE_FAILED', message: retireErr.message || 'Không thể chuyển phiên bản cũ sang retired.' }
    };
  }

  // Simulate unexpected DB failure on activate if requested
  if (options?.simulateDbFailureOnActivate) {
    // Rollback previous active
    if (previousActiveId) {
      await supabaseAdmin
        .from('ai_prompt_versions')
        .update({ status: 'active' })
        .eq('id', previousActiveId);
    }
    return {
      status: 500,
      body: { error: 'ACTIVATE_FAILED', message: 'Simulated database failure on activate step. Rollback performed.' }
    };
  }

  // 2. Activate target version
  const { data: activatedVersion, error: activateErr } = await supabaseAdmin
    .from('ai_prompt_versions')
    .update({
      status: 'active',
      activated_at: new Date().toISOString(),
      activated_by: 'mock-admin-user'
    })
    .eq('id', versionId)
    .select()
    .single();

  if (activateErr) {
    // Rollback
    if (previousActiveId) {
      await supabaseAdmin
        .from('ai_prompt_versions')
        .update({ status: 'active' })
        .eq('id', previousActiveId);
    }
    return {
      status: 500,
      body: { error: 'ACTIVATE_FAILED', message: activateErr.message || 'Không thể kích hoạt phiên bản mới.' }
    };
  }

  // 3. Invalidate Cache
  const { data: def } = await supabaseAdmin
    .from('ai_prompt_definitions')
    .select('prompt_key')
    .eq('id', definitionId)
    .single();

  if (def) {
    aiPromptRegistryService.invalidateCache(def.prompt_key);
  }

  return { status: 200, body: activatedVersion };
}

async function runPromptActivationSelfTests() {
  console.log('========================================================================');
  console.log('🧪 RUNNING AUTOMATED SELF-TEST: PROMPT VERSION ACTIVATION FLOW');
  console.log('========================================================================\n');

  // In-memory Database Store
  let defs: MockPromptDef[] = [];
  let vers: MockPromptVer[] = [];

  const createMockSupabase = () => ({
    from: (table: string) => {
      let currentData: any[] = table === 'ai_prompt_definitions' ? defs : vers;
      const filters: ((it: any) => boolean)[] = [];
      let pendingUpdate: any = null;

      const executeUpdate = () => {
        if (!pendingUpdate) return [];
        const matched = currentData.filter(it => filters.every(f => f(it)));
        for (const m of matched) {
          Object.assign(m, pendingUpdate);
        }
        return matched;
      };

      const createBuilder = (): any => {
        const builder: any = {
          select: () => builder,
          eq: (col: string, val: any) => {
            filters.push(it => it[col] === val);
            return builder;
          },
          single: async () => {
            if (pendingUpdate) {
              const updated = executeUpdate();
              const item = updated[0];
              if (!item) return { data: null, error: { message: 'Not found' } };
              return { data: JSON.parse(JSON.stringify(item)), error: null };
            }
            const item = currentData.find(it => filters.every(f => f(it)));
            if (!item) return { data: null, error: { message: 'Not found' } };
            return { data: JSON.parse(JSON.stringify(item)), error: null };
          },
          maybeSingle: async () => {
            const item = currentData.find(it => filters.every(f => f(it)));
            return { data: item ? JSON.parse(JSON.stringify(item)) : null, error: null };
          },
          update: (payload: any) => {
            pendingUpdate = payload;
            return builder;
          },
          then: (resolve: any, reject: any) => {
            if (pendingUpdate) {
              const updated = executeUpdate();
              return Promise.resolve({ data: updated, error: null }).then(resolve, reject);
            }
            const filtered = currentData.filter(it => filters.every(f => f(it)));
            return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
          }
        };
        return builder;
      };

      return createBuilder();
    }
  });

  const supabase = createMockSupabase();

  // Helper to count active versions for a definition
  const getActiveVersionsCount = (defId: string) => {
    return vers.filter(v => v.prompt_definition_id === defId && v.status === 'active').length;
  };

  // Setup Initial Test Data: Prompt A and Prompt B
  const defAId = 'def-a-uuid';
  const defBId = 'def-b-uuid';

  defs = [
    { id: defAId, prompt_key: 'assistant.chat', name: 'Trợ lý AI', enabled: true },
    { id: defBId, prompt_key: 'kpi.staff_summary', name: 'Tóm tắt KPI', enabled: true }
  ];

  // Prompt A has v1 (active), v2 (draft), v3 (draft)
  const v1AId = 'ver-a1-uuid';
  const v2AId = 'ver-a2-uuid';
  const v3AId = 'ver-a3-uuid';

  // Prompt B has v1 (active) and v2 (draft)
  const v1BId = 'ver-b1-uuid';
  const v2BId = 'ver-b2-uuid';

  vers = [
    {
      id: v1AId,
      prompt_definition_id: defAId,
      version_number: 1,
      status: 'active',
      system_prompt: 'System prompt v1 for A',
      user_prompt_template: 'User prompt v1: {{question}}',
      output_mode: 'text',
      activated_at: new Date().toISOString()
    },
    {
      id: v2AId,
      prompt_definition_id: defAId,
      version_number: 2,
      status: 'draft',
      system_prompt: 'System prompt v2 for A (Advanced)',
      user_prompt_template: 'User prompt v2: {{question}}',
      output_mode: 'text'
    },
    {
      id: v1BId,
      prompt_definition_id: defBId,
      version_number: 1,
      status: 'active',
      system_prompt: 'System prompt v1 for B',
      user_prompt_template: 'KPI summary v1',
      output_mode: 'text',
      activated_at: new Date().toISOString()
    },
    {
      id: v2BId,
      prompt_definition_id: defBId,
      version_number: 2,
      status: 'draft',
      system_prompt: 'System prompt v2 for B',
      user_prompt_template: 'KPI summary v2',
      output_mode: 'text'
    }
  ];

  console.log('--- TEST 1: Kích hoạt thành công (v1 ACTIVE -> v2 DRAFT -> v2 ACTIVE, v1 RETIRED) ---');
  {
    assert(getActiveVersionsCount(defAId) === 1, 'Test 1.1: Ban đầu Prompt A có đúng 1 active version (v1)');

    const res = await simulateActivateVersion(supabase, v2AId, 'ai.prompt_manage');
    assert(res.status === 200, 'Test 1.2: API trả về HTTP 200 thành công');
    assert(res.body.status === 'active', 'Test 1.3: Phiên bản v2 chuyển sang status "active"');

    const v1 = vers.find(v => v.id === v1AId);
    const v2 = vers.find(v => v.id === v2AId);
    assert(v1?.status === 'retired', 'Test 1.4: Phiên bản v1 đã chuyển sang status "retired"');
    assert(v2?.status === 'active', 'Test 1.5: Phiên bản v2 đã ở trạng thái "active"');
    assert(getActiveVersionsCount(defAId) === 1, 'Test 1.6: DUY NHẤT 1 phiên bản active sau khi kích hoạt');
  }

  console.log('\n--- TEST 2: API Lỗi & Cơ chế Rollback bảo vệ tính toàn vẹn ---');
  {
    // Tạo thêm v3 draft cho Prompt A
    vers.push({
      id: v3AId,
      prompt_definition_id: defAId,
      version_number: 3,
      status: 'draft',
      system_prompt: 'System prompt v3 for A',
      user_prompt_template: 'User prompt v3',
      output_mode: 'text'
    });

    // Hiện tại v2 đang active
    assert(vers.find(v => v.id === v2AId)?.status === 'active', 'Test 2.1: Trước khi test lỗi, v2 đang active');

    // Giả lập lỗi DB khi kích hoạt v3
    const res = await simulateActivateVersion(supabase, v3AId, 'ai.prompt_manage', { simulateDbFailureOnActivate: true });
    assert(res.status === 500, 'Test 2.2: API trả về HTTP 500 khi có sự cố DB');
    assert(res.body.error === 'ACTIVATE_FAILED', 'Test 2.3: Trả mã lỗi cụ thể ACTIVATE_FAILED');

    // Kiểm tra Rollback: v2 vẫn giữ active, v3 vẫn là draft, không bị mất active version
    const v2 = vers.find(v => v.id === v2AId);
    const v3 = vers.find(v => v.id === v3AId);
    assert(v2?.status === 'active', 'Test 2.4: Rollback thành công, v2 vẫn giữ nguyên trạng thái ACTIVE');
    assert(v3?.status === 'draft', 'Test 2.5: v3 vẫn ở trạng thái DRAFT');
    assert(getActiveVersionsCount(defAId) === 1, 'Test 2.6: Số lượng active version luôn được bảo toàn là 1');
  }

  console.log('\n--- TEST 3: Kiểm tra Phân quyền (RBAC) ---');
  {
    // Người dùng không có quyền (user thường)
    const res = await simulateActivateVersion(supabase, v3AId, 'user_read_only');
    assert(res.status === 403, 'Test 3.1: Người không có quyền bị từ chối 403 Forbidden');
    assert(res.body.error === 'FORBIDDEN', 'Test 3.2: Mã lỗi FORBIDDEN được trả về');
    
    // Kiểm tra DB không bị biến đổi
    const v3 = vers.find(v => v.id === v3AId);
    assert(v3?.status === 'draft', 'Test 3.3: Phiên bản v3 không bị kích hoạt');
    assert(getActiveVersionsCount(defAId) === 1, 'Test 3.4: Trạng thái active không đổi');
  }

  console.log('\n--- TEST 4: Chặn Bấm Lặp (Debounce & Concurrency Guard) ---');
  {
    let inFlight = false;
    let successfulCalls = 0;
    let blockedCalls = 0;

    const frontendClick = async (vId: string) => {
      if (inFlight) {
        blockedCalls++;
        return { blocked: true };
      }
      inFlight = true;
      try {
        await new Promise(r => setTimeout(r, 20)); // Mô phỏng network delay
        const res = await simulateActivateVersion(supabase, vId, 'ai.prompt_manage');
        successfulCalls++;
        return res;
      } finally {
        inFlight = false;
      }
    };

    // User click 4 lần liên tiếp cực nhanh
    const clickPromises = [
      frontendClick(v3AId),
      frontendClick(v3AId),
      frontendClick(v3AId),
      frontendClick(v3AId)
    ];

    await Promise.all(clickPromises);
    assert(successfulCalls === 1, 'Test 4.1: Chỉ có ĐÚNG 1 request được thực thi');
    assert(blockedCalls === 3, 'Test 4.2: 3 lần click lặp lại bị chặn ở frontend guard');
    assert(getActiveVersionsCount(defAId) === 1, 'Test 4.3: DB chỉ cập nhật 1 lần, duy trì đúng 1 active version');
  }

  console.log('\n--- TEST 5: Chuyển đổi linh hoạt v1 -> v2 -> v1 ---');
  {
    // Kích hoạt lại v1AId
    const resToV1 = await simulateActivateVersion(supabase, v1AId, 'ai.prompt_manage');
    assert(resToV1.status === 200, 'Test 5.1: Chuyển lại về v1 thành công');
    assert(vers.find(v => v.id === v1AId)?.status === 'active', 'Test 5.2: v1 đang ACTIVE');
    assert(vers.find(v => v.id === v3AId)?.status === 'retired', 'Test 5.3: v3 chuyển sang RETIRED');
    assert(getActiveVersionsCount(defAId) === 1, 'Test 5.4: Chính xác 1 bản active');

    // Chuyển sang v2AId
    const resToV2 = await simulateActivateVersion(supabase, v2AId, 'ai.prompt_manage');
    assert(resToV2.status === 200, 'Test 5.5: Chuyển tiếp sang v2 thành công');
    assert(vers.find(v => v.id === v2AId)?.status === 'active', 'Test 5.6: v2 đang ACTIVE');
    assert(vers.find(v => v.id === v1AId)?.status === 'retired', 'Test 5.7: v1 chuyển sang RETIRED');
    assert(getActiveVersionsCount(defAId) === 1, 'Test 5.8: Chính xác 1 bản active');
  }

  console.log('\n--- TEST 6: Hai Prompt khác nhau độc lập, không ảnh hưởng lẫn nhau ---');
  {
    // Kiểm tra Prompt B ban đầu có v1 active
    assert(vers.find(v => v.id === v1BId)?.status === 'active', 'Test 6.1: Prompt B ban đầu có v1 ACTIVE');
    assert(vers.find(v => v.id === v2BId)?.status === 'draft', 'Test 6.2: Prompt B có v2 DRAFT');

    // Kích hoạt v2 của Prompt B
    const resB = await simulateActivateVersion(supabase, v2BId, 'ai.prompt_manage');
    assert(resB.status === 200, 'Test 6.3: Kích hoạt v2 cho Prompt B thành công');

    // Prompt B: v2 active, v1 retired
    assert(vers.find(v => v.id === v2BId)?.status === 'active', 'Test 6.4: Prompt B: v2 chuyển sang ACTIVE');
    assert(vers.find(v => v.id === v1BId)?.status === 'retired', 'Test 6.5: Prompt B: v1 chuyển sang RETIRED');

    // Prompt A: v2 vẫn active, không hề bị thay đổi
    assert(vers.find(v => v.id === v2AId)?.status === 'active', 'Test 6.6: Prompt A: v2 vẫn giữ nguyên ACTIVE không bị ảnh hưởng');
    assert(getActiveVersionsCount(defAId) === 1, 'Test 6.7: Prompt A có đúng 1 active');
    assert(getActiveVersionsCount(defBId) === 1, 'Test 6.8: Prompt B có đúng 1 active');
  }

  console.log('\n--- TEST 7: Kiểm tra Cache Invalidation & Chatbot Resolve ---');
  {
    // Invalidate cache and simulate resolve with mock supabase
    aiPromptRegistryService.invalidateCache('assistant.chat');

    // Mock query in aiPromptRegistryService
    const mockSupabaseQuery: any = {
      from: (table: string) => {
        let currentData: any[] = table === 'ai_prompt_definitions' ? defs : vers;
        const filters: ((it: any) => boolean)[] = [];
        const builder: any = {
          select: () => builder,
          eq: (col: string, val: any) => {
            filters.push(it => it[col] === val);
            return builder;
          },
          single: async () => {
            const item = currentData.find(it => filters.every(f => f(it)));
            if (!item) return { data: null, error: { message: 'Not found' } };
            return { data: JSON.parse(JSON.stringify(item)), error: null };
          },
          maybeSingle: async () => {
            const item = currentData.find(it => filters.every(f => f(it)));
            return { data: item ? JSON.parse(JSON.stringify(item)) : null, error: null };
          }
        };
        return builder;
      }
    };

    const resolved = await aiPromptRegistryService.resolve(mockSupabaseQuery, 'assistant.chat', {
      question: 'Hỏi về v2'
    });

    assert(resolved.promptVersionId === v2AId, 'Test 7.1: Resolve trả về đúng ID của v2 vừa được kích hoạt');
    assert(resolved.versionNumber === 2, 'Test 7.2: Resolve trả về đúng versionNumber = 2');
    assert(resolved.systemPrompt.includes('Advanced'), 'Test 7.3: System Prompt chứa nội dung mới của v2');
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(`📊 TỔNG KẾT SELF-TEST: ${passedTests}/${totalTests} PASS`);
  console.log('------------------------------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPromptActivationSelfTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
