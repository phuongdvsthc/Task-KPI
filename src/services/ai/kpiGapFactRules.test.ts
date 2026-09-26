import assert from 'assert';
import { resolveLiveScoresBatch, resolveOfficialScoresBatch } from '../kpiDashboardResolver';
import { aiPromptRegistry } from './aiPromptRegistry';
import { normalizeKPIIntelligenceResult } from './kpiIntelligence.service';

function createMockSupabase(items: any[] = [], actuals: any[] = []) {
  return {
    from: (table: string) => {
      if (table === 'kpi_assignment_items') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: items, error: null })
          })
        };
      }
      if (table === 'kpi_manual_actual_entries') {
        return {
          select: () => ({
            in: () => ({
              order: () => Promise.resolve({ data: actuals, error: null })
            })
          })
        };
      }
      return {
        select: () => ({
          in: () => Promise.resolve({ data: [], error: null })
        })
      };
    }
  };
}

async function runRegressionTests() {
  console.log('--- RUNNING KPI GAP FACT RULES REGRESSION SUITE (E4.1.1 – E4.1.24) ---');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`FAIL: ${name}`, err);
      failed++;
    }
  }

  // E4.1.1: Live linear KPI with Target=100, Actual=80 -> achievement=80%, gap=20, attainment_state=under_target
  await test('E4.1.1: Live linear KPI Target=100, Actual=80 -> ach=80%, gap=20, attainment_state=under_target', async () => {
    const mockAssignment = { id: 'asg-1' };
    const mockItem = {
      id: 'item-1',
      assignment_id: 'asg-1',
      target_config: { target_value: 100 },
      weight: 100,
      scoring_method: 'linear',
      direction: 'higher_is_better',
      measurement_type: 'number'
    };
    const mockActual = {
      assignment_item_id: 'item-1',
      value_numeric: 80,
      entered_at: '2026-03-01T00:00:00Z'
    };
    const mockSupabase = createMockSupabase([mockItem], [mockActual]);
    const { liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const items = liveItemsMap.get('asg-1');
    assert.strictEqual(items?.length, 1);
    assert.strictEqual(items![0].resolved_ach, 80);
    assert.strictEqual(items![0].resolved_gap, 20);
    assert.strictEqual(items![0].attainment_state, 'under_target');
    assert.strictEqual(items![0].scoring_status, 'scored');
  });

  // E4.1.2: Live linear KPI with Target=100, Actual=100 -> achievement=100%, gap=0, attainment_state=achieved
  await test('E4.1.2: Live linear KPI Target=100, Actual=100 -> ach=100%, gap=0, attainment_state=achieved', async () => {
    const mockAssignment = { id: 'asg-2' };
    const mockItem = {
      id: 'item-2',
      assignment_id: 'asg-2',
      target_config: { target_value: 100 },
      weight: 100,
      scoring_method: 'linear',
      direction: 'higher_is_better',
      measurement_type: 'number'
    };
    const mockActual = {
      assignment_item_id: 'item-2',
      value_numeric: 100,
      entered_at: '2026-03-01T00:00:00Z'
    };
    const mockSupabase = createMockSupabase([mockItem], [mockActual]);
    const { liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const items = liveItemsMap.get('asg-2');
    assert.strictEqual(items![0].resolved_ach, 100);
    assert.strictEqual(items![0].resolved_gap, 0);
    assert.strictEqual(items![0].attainment_state, 'achieved');
  });

  // E4.1.3: Live linear KPI with Target=100, Actual=120, capped at 100 -> achievement=100%, gap=0, attainment_state=achieved/exceeded
  await test('E4.1.3: Live linear KPI Target=100, Actual=120, cap=100 -> gap=0, attainment_state=exceeded', async () => {
    const mockAssignment = { id: 'asg-3' };
    const mockItem = {
      id: 'item-3',
      assignment_id: 'asg-3',
      target_config: { target_value: 100, cap_percent: 100 },
      weight: 100,
      scoring_method: 'linear',
      direction: 'higher_is_better',
      measurement_type: 'number'
    };
    const mockActual = {
      assignment_item_id: 'item-3',
      value_numeric: 120,
      entered_at: '2026-03-01T00:00:00Z'
    };
    const mockSupabase = createMockSupabase([mockItem], [mockActual]);
    const { liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const items = liveItemsMap.get('asg-3');
    assert.strictEqual(items![0].resolved_gap, 0);
    assert.strictEqual(items![0].attainment_state, 'exceeded');
  });

  // E4.1.4: Live lower-is-better KPI with Target=5, Actual=3 -> achieved, gap=0, attainment_state=achieved/exceeded
  await test('E4.1.4: Live lower-is-better KPI Target=5, Actual=3 -> gap=0, attainment_state=achieved/exceeded', async () => {
    const mockAssignment = { id: 'asg-4' };
    const mockItem = {
      id: 'item-4',
      assignment_id: 'asg-4',
      target_config: { target_value: 5 },
      weight: 100,
      scoring_method: 'linear',
      direction: 'lower_is_better',
      measurement_type: 'number'
    };
    const mockActual = {
      assignment_item_id: 'item-4',
      value_numeric: 3,
      entered_at: '2026-03-01T00:00:00Z'
    };
    const mockSupabase = createMockSupabase([mockItem], [mockActual]);
    const { liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const items = liveItemsMap.get('asg-4');
    assert.strictEqual(items![0].resolved_gap, 0);
    assert.ok(items![0].attainment_state === 'achieved' || items![0].attainment_state === 'exceeded');
  });

  // E4.1.5: Live lower-is-better KPI with Target=5, Actual=7 -> under target, gap=2, attainment_state=under_target
  await test('E4.1.5: Live lower-is-better KPI Target=5, Actual=7 -> under target, gap=2, attainment_state=under_target', async () => {
    const mockAssignment = { id: 'asg-5' };
    const mockItem = {
      id: 'item-5',
      assignment_id: 'asg-5',
      target_config: { target_value: 5 },
      weight: 100,
      scoring_method: 'linear',
      direction: 'lower_is_better',
      measurement_type: 'number'
    };
    const mockActual = {
      assignment_item_id: 'item-5',
      value_numeric: 7,
      entered_at: '2026-03-01T00:00:00Z'
    };
    const mockSupabase = createMockSupabase([mockItem], [mockActual]);
    const { liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const items = liveItemsMap.get('asg-5');
    assert.strictEqual(items![0].resolved_gap, 2);
    assert.strictEqual(items![0].attainment_state, 'under_target');
  });

  // E4.1.6: Lower-is-better prompt instruction forbids "Actual thấp hơn Target là chưa đạt"
  await test('E4.1.6: Prompt instruction forbids "Actual thấp hơn Target là chưa đạt" for lower_is_better', () => {
    const promptDef = aiPromptRegistry['kpi.team_summary'];
    assert.ok(promptDef.systemInstruction.includes('Actual thấp hơn Target là chiều hướng tích cực'));
    assert.ok(promptDef.systemInstruction.includes('TUYỆT ĐỐI KHÔNG dùng câu sáo rỗng "Actual thấp hơn Target là chưa đạt"'));
  });

  // E4.1.7: Missing Actual -> actual=null, scoring_status=not_scored, gap=null, attainment_state=not_scored
  await test('E4.1.7: Missing Actual -> actual=null, scoring_status=not_scored, gap=null, attainment_state=not_scored', async () => {
    const mockAssignment = { id: 'asg-7' };
    const mockItem = {
      id: 'item-7',
      assignment_id: 'asg-7',
      target_config: { target_value: 100 },
      weight: 100,
      scoring_method: 'linear',
      direction: 'higher_is_better'
    };
    const mockSupabase = createMockSupabase([mockItem], []);
    const { liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const items = liveItemsMap.get('asg-7');
    assert.strictEqual(items![0].resolved_actual, null);
    assert.strictEqual(items![0].scoring_status, 'not_scored');
    assert.strictEqual(items![0].status_reason, 'actual_not_available');
    assert.strictEqual(items![0].resolved_gap, null);
    assert.strictEqual(items![0].attainment_state, 'not_scored');
  });

  // E4.1.8: Missing Actual -> AI must not describe as 0, failed, or performance risk
  await test('E4.1.8: Prompt instruction forbids interpreting missing actual as 0 or failed', () => {
    const staffDef = aiPromptRegistry['kpi.staff_summary'];
    assert.ok(staffDef.systemInstruction.includes('Thiếu Actual (actual = null) chỉ có nghĩa là "Chưa có dữ liệu Actual", TUYỆT ĐỐI KHÔNG coi là 0'));
  });

  // E4.1.9: Actual=0 recorded -> actual=0, distinguished from missing Actual
  await test('E4.1.9: Actual=0 recorded -> actual=0 distinguished from missing Actual', async () => {
    const mockAssignment = { id: 'asg-9' };
    const mockItem = {
      id: 'item-9',
      assignment_id: 'asg-9',
      target_config: { target_value: 100 },
      weight: 100,
      scoring_method: 'linear',
      direction: 'higher_is_better',
      measurement_type: 'number'
    };
    const mockActual = {
      assignment_item_id: 'item-9',
      value_numeric: 0,
      entered_at: '2026-03-01T00:00:00Z'
    };
    const mockSupabase = createMockSupabase([mockItem], [mockActual]);
    const { liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const items = liveItemsMap.get('asg-9');
    assert.strictEqual(items![0].resolved_actual, 0);
    assert.strictEqual(items![0].scoring_status, 'scored');
    assert.strictEqual(items![0].resolved_gap, 100);
    assert.strictEqual(items![0].attainment_state, 'under_target');
  });

  // E4.1.10: Unscored KPI -> not_scored, gap=null, attainment_state=not_scored
  await test('E4.1.10: Unscored KPI -> not_scored, gap=null, attainment_state=not_scored', async () => {
    const mockAssignment = { id: 'asg-10' };
    const mockItem = {
      id: 'item-10',
      assignment_id: 'asg-10',
      target_config: { target_value: 50 },
      weight: 100
    };
    const mockSupabase = createMockSupabase([mockItem], []);
    const { liveScoreMap, liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    assert.strictEqual(liveScoreMap.get('asg-10')?.status, 'not_scored');
    assert.strictEqual(liveItemsMap.get('asg-10')?.[0].attainment_state, 'not_scored');
    assert.strictEqual(liveItemsMap.get('asg-10')?.[0].resolved_gap, null);
  });

  // E4.1.11: Unscored KPI -> AI must not describe as failed, 0 score, or violation
  await test('E4.1.11: Prompt instruction & normalizer protect unscored KPI from being called failed', () => {
    const teamDef = aiPromptRegistry['kpi.team_summary'];
    assert.ok(teamDef.systemInstruction.includes('scoringStatus = \'not_scored\' chỉ có nghĩa là "Chưa được chấm điểm", KHÔNG coi là 0 điểm'));
  });

  // E4.1.12: Partial scoring -> partial score, AI describes as partial only
  await test('E4.1.12: Partial scoring reflected accurately as partial', async () => {
    const mockAssignment = { id: 'asg-12' };
    const mockItems = [
      {
        id: 'item-12a',
        assignment_id: 'asg-12',
        target_config: { target_value: 100 },
        weight: 50,
        scoring_method: 'linear',
        direction: 'higher_is_better',
        measurement_type: 'number'
      },
      {
        id: 'item-12b',
        assignment_id: 'asg-12',
        target_config: { target_value: 100 },
        weight: 50,
        scoring_method: 'linear',
        direction: 'higher_is_better',
        measurement_type: 'number'
      }
    ];
    const mockActuals = [
      {
        assignment_item_id: 'item-12a',
        value_numeric: 80,
        entered_at: '2026-03-01T00:00:00Z'
      }
      // item-12b has no actual entry
    ];
    const mockSupabase = createMockSupabase(mockItems, mockActuals);
    const { liveScoreMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const score = liveScoreMap.get('asg-12');
    assert.strictEqual(score?.status, 'partial');
    assert.strictEqual(score?.total_score, 40);
  });

  // E4.1.13: Official snapshot with locked target/actual/score -> authoritative score used
  await test('E4.1.13: Official snapshot with locked score -> authoritative score used', async () => {
    const mockAssignment = {
      id: 'asg-13',
      status: 'locked',
      config: {
        official_result: {
          total_score: 92.5
        }
      }
    };
    const mockSupabase = {
      from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [] }) }) })
    };
    const { officialScoreMap } = await resolveOfficialScoresBatch(mockSupabase, [mockAssignment]);
    assert.strictEqual(officialScoreMap.get('asg-13')?.total_score, 92.5);
    assert.strictEqual(officialScoreMap.get('asg-13')?.status, 'complete');
  });

  // E4.1.14: Live score changing in DB -> reflected in live resolution
  await test('E4.1.14: Live score changes dynamically with input items', async () => {
    const item = { id: 'it-14', assignment_id: 'asg-14', target_config: { target_value: 100 }, weight: 100, scoring_method: 'linear', direction: 'higher_is_better', measurement_type: 'number' };
    const actualA = [{ assignment_item_id: 'it-14', value_numeric: 50, entered_at: '2026-03-01T00:00:00Z' }];
    const actualB = [{ assignment_item_id: 'it-14', value_numeric: 90, entered_at: '2026-03-01T00:00:00Z' }];

    const resA = await resolveLiveScoresBatch(createMockSupabase([item], actualA), [{ id: 'asg-14' }]);
    const resB = await resolveLiveScoresBatch(createMockSupabase([item], actualB), [{ id: 'asg-14' }]);
    assert.strictEqual(resA.liveScoreMap.get('asg-14')?.total_score, 50);
    assert.strictEqual(resB.liveScoreMap.get('asg-14')?.total_score, 90);
  });

  // E4.1.15: Locked assignment with different live data -> locked snapshot wins
  await test('E4.1.15: Locked assignment snapshot wins over live item values', async () => {
    const mockAssignment = {
      id: 'asg-15',
      status: 'locked',
      config: {
        official_result: { total_score: 85 }
      }
    };
    const mockSupabase = {
      from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [] }) }) })
    };
    const { officialScoreMap } = await resolveOfficialScoresBatch(mockSupabase, [mockAssignment]);
    assert.strictEqual(officialScoreMap.get('asg-15')?.total_score, 85);
  });

  // E4.1.16: Live vs Official prompt rule: live cannot be called final/official/kết luận cuối cùng
  await test('E4.1.16: Live vs Official prompt rule prevents finality on live results', () => {
    const unitDef = aiPromptRegistry['kpi.unit_summary'];
    assert.ok(unitDef.systemInstruction.includes('Đối với KPI có resultMode = \'live\': phải dùng từ ngữ phản ánh dữ liệu hiện thời'));
    assert.ok(unitDef.systemInstruction.includes('TUYỆT ĐỐI KHÔNG dùng từ "chính thức", "cuối cùng", "kết luận cuối cùng"'));
  });

  // E4.1.17: Boolean KPI achieved -> attainment_state=achieved, gap=null (no numeric gap)
  await test('E4.1.17: Boolean KPI achieved -> attainment_state=achieved, gap=null', async () => {
    const mockAssignment = { id: 'asg-17' };
    const mockItem = {
      id: 'item-17',
      assignment_id: 'asg-17',
      target_config: { target_value: 1 },
      measurement_type: 'boolean',
      scoring_method: 'binary',
      weight: 100
    };
    const mockActual = {
      assignment_item_id: 'item-17',
      value_numeric: 1,
      entered_at: '2026-03-01T00:00:00Z'
    };
    const mockSupabase = createMockSupabase([mockItem], [mockActual]);
    const { liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const it = liveItemsMap.get('asg-17')?.[0];
    assert.strictEqual(it.attainment_state, 'achieved');
    assert.strictEqual(it.resolved_gap, null);
  });

  // E4.1.18: Boolean KPI not achieved -> attainment_state=under_target, gap=null
  await test('E4.1.18: Boolean KPI not achieved -> attainment_state=under_target, gap=null', async () => {
    const mockAssignment = { id: 'asg-18' };
    const mockItem = {
      id: 'item-18',
      assignment_id: 'asg-18',
      target_config: { target_value: 1 },
      measurement_type: 'boolean',
      scoring_method: 'binary',
      weight: 100
    };
    const mockActual = {
      assignment_item_id: 'item-18',
      value_numeric: 0,
      entered_at: '2026-03-01T00:00:00Z'
    };
    const mockSupabase = createMockSupabase([mockItem], [mockActual]);
    const { liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const it = liveItemsMap.get('asg-18')?.[0];
    assert.strictEqual(it.attainment_state, 'under_target');
    assert.strictEqual(it.resolved_gap, null);
  });

  // E4.1.19: Invalid target -> scoring_status=invalid_target, attainment_state=invalid_target, AI does not blame employee
  await test('E4.1.19: Invalid target -> scoring_status=invalid_target, attainment_state=invalid_target', async () => {
    const mockAssignment = { id: 'asg-19' };
    const mockItem = {
      id: 'item-19',
      assignment_id: 'asg-19',
      target_config: { target_value: null },
      scoring_method: 'linear',
      direction: 'higher_is_better',
      measurement_type: 'number',
      weight: 100
    };
    const mockActual = {
      assignment_item_id: 'item-19',
      value_numeric: 50,
      entered_at: '2026-03-01T00:00:00Z'
    };
    const mockSupabase = createMockSupabase([mockItem], [mockActual]);
    const { liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const it = liveItemsMap.get('asg-19')?.[0];
    assert.strictEqual(it.scoring_status, 'invalid_target');
    assert.strictEqual(it.attainment_state, 'invalid_target');
  });

  // E4.1.20: Invalid scoring config -> scoring_status=invalid_config, AI does not treat as performance failure
  await test('E4.1.20: Invalid scoring config -> scoring_status=invalid_config', async () => {
    const mockAssignment = { id: 'asg-20' };
    const mockItem = {
      id: 'item-20',
      assignment_id: 'asg-20',
      target_config: { target_value: 100 },
      scoring_method: 'bands',
      bands_config: [], // empty bands config -> invalid
      direction: 'higher_is_better',
      measurement_type: 'number',
      weight: 100
    };
    const mockActual = {
      assignment_item_id: 'item-20',
      value_numeric: 50,
      entered_at: '2026-03-01T00:00:00Z'
    };
    const mockSupabase = createMockSupabase([mockItem], [mockActual]);
    const { liveItemsMap } = await resolveLiveScoresBatch(mockSupabase, [mockAssignment]);
    const it = liveItemsMap.get('asg-20')?.[0];
    assert.strictEqual(it.scoring_status, 'invalid_config');
    assert.strictEqual(it.attainment_state, 'invalid_config');
  });

  // E4.1.21: Normalizer rejects AI claim that unscored KPI is failed
  await test('E4.1.21: Normalizer rejects AI claim that unscored KPI is failed', () => {
    const rawAIResult = {
      summary: 'Tóm tắt KPI',
      highlights: [],
      issues: [
        {
          text: 'KPI A bị 0 điểm thất bại do chưa chấm',
          evidence: [{ assignmentId: 'asg-21', assignmentItemId: 'it-21', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const validAssignmentIds = new Set(['asg-21']);
    const validItemIds = new Set(['it-21']);
    const assignmentsById = new Map([
      ['asg-21', {
        id: 'asg-21',
        resultMode: 'live',
        items: [{ id: 'it-21', assignmentItemId: 'it-21', scoringStatus: 'not_scored', actual: null }]
      }]
    ]);
    const normalized = normalizeKPIIntelligenceResult(rawAIResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.issues.length, 0, 'Should have removed unsupported failed claim for unscored KPI');
  });

  // E4.1.22: Normalizer rejects AI claim that missing Actual is 0
  await test('E4.1.22: Normalizer rejects AI claim that missing Actual is 0', () => {
    const rawAIResult = {
      summary: 'Tóm tắt KPI',
      highlights: [],
      issues: [
        {
          text: 'KPI B bằng 0 do thiếu số liệu',
          evidence: [{ assignmentId: 'asg-22', assignmentItemId: 'it-22', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const validAssignmentIds = new Set(['asg-22']);
    const validItemIds = new Set(['it-22']);
    const assignmentsById = new Map([
      ['asg-22', {
        id: 'asg-22',
        resultMode: 'live',
        items: [{ id: 'it-22', assignmentItemId: 'it-22', scoringStatus: 'not_scored', actual: null }]
      }]
    ]);
    const normalized = normalizeKPIIntelligenceResult(rawAIResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.issues.length, 0, 'Should have rejected claim equating missing actual to 0');
  });

  // E4.1.23: Normalizer normalizes scoreMode to authoritative context
  await test('E4.1.23: Normalizer normalizes scoreMode to authoritative context', () => {
    const rawAIResult = {
      summary: 'Tóm tắt',
      highlights: [
        {
          text: 'KPI Đạt kết quả xuất sắc',
          evidence: [{ assignmentId: 'asg-23', assignmentItemId: 'it-23', type: 'kpi_item', scoreMode: 'official' }]
        }
      ],
      issues: [],
      actions: []
    };
    const validAssignmentIds = new Set(['asg-23']);
    const validItemIds = new Set(['it-23']);
    const assignmentsById = new Map([
      ['asg-23', {
        id: 'asg-23',
        resultMode: 'live', // Authoritative is live!
        items: [{ id: 'it-23', assignmentItemId: 'it-23', scoringStatus: 'scored', actual: 120, achievementPercent: 120, attainmentState: 'exceeded' }]
      }]
    ]);
    const normalized = normalizeKPIIntelligenceResult(rawAIResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.highlights[0].evidence[0].scoreMode, 'live', 'scoreMode must be normalized to authoritative context');
  });

  // E4.1.24: End-to-end: Staff summary, Team summary, Unit summary obey gap fact rules
  await test('E4.1.24: Staff, Team, Unit prompt definitions in registry all conform to v1.1 rules', () => {
    const keys = ['kpi.staff_summary', 'kpi.team_summary', 'kpi.unit_summary'];
    for (const key of keys) {
      const def = aiPromptRegistry[key];
      assert.strictEqual(def.version, '1.1', `${key} should be at version 1.1`);
      assert.ok(def.systemInstruction.includes('KHÔNG TỰ TÍNH TOÁN SỐ LIỆU (No Arithmetic Invention)'));
      assert.ok(def.systemInstruction.includes('KHOẢNG CÁCH MỤC TIÊU (GAP)'));
      assert.ok(def.systemInstruction.includes('DỮ LIỆU THIẾU VS SỐ KHÔNG'));
      assert.ok(def.systemInstruction.includes('CHƯA CHẤM ĐIỂM (UNSCORED)'));
      assert.ok(def.systemInstruction.includes('ĐIỂM BỘ PHẬN (PARTIAL)'));
      assert.ok(def.systemInstruction.includes('PHÂN BIỆT LIVE VS OFFICIAL'));
      assert.ok(def.systemInstruction.includes('TUYỆT ĐỐI KHÔNG SUY DIỄN HIỆU SUẤT'));
    }
  });

  console.log(`\n========================================`);
  console.log(`SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionTests().catch(err => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
