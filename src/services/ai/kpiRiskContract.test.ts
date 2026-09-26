import assert from 'assert';
import { aiPromptRegistry } from './aiPromptRegistry';
import {
  normalizeKPIIntelligenceResult,
  containsProhibitedContent,
  PROHIBITED_RISK_PATTERNS
} from './kpiIntelligence.service';

async function runRegressionTests() {
  console.log('--- RUNNING KPI RISK CONTRACT REGRESSION SUITE (E4.2.1 – E4.2.21) ---');
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

  // Common fixtures
  const validAssignmentIds = new Set(['asg-1']);
  const validItemIds = new Set(['it-1']);
  const assignmentsById = new Map([
    ['asg-1', {
      id: 'asg-1',
      resultMode: 'live',
      items: [{
        id: 'it-1',
        assignmentItemId: 'it-1',
        scoringStatus: 'scored',
        actual: 80,
        target: 100,
        gap: 20,
        attainmentState: 'under_target',
        achievementPercent: 80,
        measurementType: 'number'
      }]
    }]
  ]);

  // E4.2.1: Authoritative gap does not create predictive failure claims
  await test('E4.2.1: Authoritative gap does not create predictive failure claims (normalizer rejects likely to fail / nguy cơ thất bại)', () => {
    const rawResult = {
      summary: 'Tổng quan kết quả',
      highlights: [],
      issues: [
        {
          text: 'KPI Doanh thu có nguy cơ thất bại trong kỳ này',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'KPI Doanh thu is likely to fail to achieve target',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.issues.length, 0, 'Normalizer must reject predictive failure claims');
  });

  // E4.2.2: Normalizer rejects employee risk claims
  await test('E4.2.2: Normalizer rejects employee risk claims (nhân viên có rủi ro / rủi ro nhân sự / employee risk)', () => {
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'Nhân viên Nguyễn Văn A có rủi ro không đạt chỉ tiêu',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'Phát sinh rủi ro nhân sự do kết quả thấp',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'Employee risk identified for assignee',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.issues.length, 0, 'Normalizer must reject all employee risk claims');
  });

  // E4.2.3: Normalizer rejects team / unit risk claims
  await test('E4.2.3: Normalizer rejects team / unit risk claims (nhóm yếu kém / team risk / đơn vị có rủi ro)', () => {
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'Đội ngũ kinh doanh là nhóm yếu kém trong tháng',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'Đơn vị có rủi ro cao về tiến độ',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'Department risk identified due to pending tasks',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.issues.length, 0, 'Normalizer must reject team/unit risk claims');
  });

  // E4.2.4: Normalizer rejects arbitrary high/medium/low/critical risk levels
  await test('E4.2.4: Normalizer rejects arbitrary high/medium/low/critical risk levels', () => {
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'KPI Doanh số ở mức độ rủi ro cao',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'High risk detected for KPI execution',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'Rủi ro nghiêm trọng cần can thiệp',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.issues.length, 0, 'Normalizer must reject invented risk levels');
  });

  // E4.2.5: Normalizer rejects probability of failure claims
  await test('E4.2.5: Normalizer rejects probability of failure claims', () => {
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'KPI này có xác suất không đạt là 80%',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'High probability of failure for Q1 target',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.issues.length, 0, 'Normalizer must reject probability of failure');
  });

  // E4.2.6: Normalizer rejects trend claims without time-series data
  await test('E4.2.6: Normalizer rejects trend claims without time-series data', () => {
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'KPI Doanh thu có xu hướng tụt dốc trong tháng',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'Kết quả đang ngày càng xấu đi so với trước',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'Declining trend observed in achievement',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.issues.length, 0, 'Normalizer must reject trend claims without authorized time-series data');
  });

  // E4.2.7: Normalizer rejects on track / off track claims without time-series/pace data
  await test('E4.2.7: Normalizer rejects on track / off track claims without time-series data', () => {
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'KPI đang bị chệch tiến độ kế hoạch',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'KPI is currently off track',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.issues.length, 0, 'Normalizer must reject on track/off track claims');
  });

  // E4.2.8: Missing Actual is categorized as data_issue, NOT performance risk
  await test('E4.2.8: Missing Actual is categorized as data_issue, not performance risk', () => {
    const missingActualMap = new Map([
      ['asg-1', {
        id: 'asg-1',
        resultMode: 'live',
        items: [{
          id: 'it-1',
          assignmentItemId: 'it-1',
          scoringStatus: 'not_scored',
          actual: null,
          target: 100,
          attainmentState: 'not_scored'
        }]
      }]
    ]);
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'Thiếu số liệu Actual do nhân viên sa sút không cập nhật',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'data_issue: KPI chưa có số liệu Actual ghi nhận',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, missingActualMap);
    assert.strictEqual(normalized.issues.length, 1, 'Should reject employee blaming but keep factual data_issue');
    assert.ok(normalized.issues[0].text.includes('data_issue'), 'Factual data_issue must be preserved');
  });

  // E4.2.9: Unscored KPI is NOT performance risk
  await test('E4.2.9: Unscored KPI is NOT performance risk', () => {
    const unscoredMap = new Map([
      ['asg-1', {
        id: 'asg-1',
        resultMode: 'live',
        items: [{
          id: 'it-1',
          assignmentItemId: 'it-1',
          scoringStatus: 'not_scored',
          actual: null,
          target: 50,
          attainmentState: 'not_scored'
        }]
      }]
    ]);
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'KPI chưa chấm điểm là lỗi của nhân viên vi phạm quy chế',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'attention: KPI chưa được chấm điểm trong kỳ',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, unscoredMap);
    assert.strictEqual(normalized.issues.length, 1, 'Should reject employee fault for unscored KPI');
    assert.ok(normalized.issues[0].text.includes('attention'), 'Factual attention must be preserved');
  });

  // E4.2.10: Partial scoring is incomplete scoring / attention, NOT employee underperformance risk
  await test('E4.2.10: Partial scoring is incomplete scoring / attention, NOT employee underperformance risk', () => {
    const partialMap = new Map([
      ['asg-1', {
        id: 'asg-1',
        resultMode: 'live',
        items: [{
          id: 'it-1',
          assignmentItemId: 'it-1',
          scoringStatus: 'partial',
          actual: 30,
          target: 100,
          attainmentState: 'under_target'
        }]
      }]
    ]);
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'Điểm bộ phận phản ánh nhân viên yếu kém sa sút',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'attention: Kết quả partial cần được tiếp tục hoàn thiện điểm số',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, partialMap);
    assert.strictEqual(normalized.issues.length, 1, 'Should reject underperformance claim and keep factual attention');
    assert.ok(normalized.issues[0].text.includes('attention'));
  });

  // E4.2.11: Locked KPI historical gap is NOT described as future / pending risk
  await test('E4.2.11: Locked KPI historical gap is NOT described as future / pending risk', () => {
    const lockedMap = new Map([
      ['asg-1', {
        id: 'asg-1',
        resultMode: 'official',
        status: 'locked',
        items: [{
          id: 'it-1',
          assignmentItemId: 'it-1',
          scoringStatus: 'scored',
          actual: 70,
          target: 100,
          gap: 30,
          attainmentState: 'under_target'
        }]
      }]
    ]);
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'KPI đã khóa có nguy cơ gây hậu quả về sau',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'gap: Kết quả chính thức ghi nhận khoảng cách 30 đơn vị so với mục tiêu',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, lockedMap);
    assert.strictEqual(normalized.issues.length, 1, 'Should reject future pending risk for locked KPI');
    assert.ok(normalized.issues[0].text.includes('gap: Kết quả chính thức'));
  });

  // E4.2.12: Live KPI under target can report factual gap / attention, but NOT forecast final outcome
  await test('E4.2.12: Live KPI under target can report factual gap / attention, but NOT forecast final outcome', () => {
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'KPI này chắc chắn sẽ không đạt khi kết thúc kỳ',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'gap: Hiện tại KPI còn khoảng cách 20 đơn vị so với target',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.issues.length, 1, 'Should reject forecasting final outcome');
    assert.ok(normalized.issues[0].text.includes('gap: Hiện tại KPI còn khoảng cách 20 đơn vị'));
  });

  // E4.2.13: Score < 100 is not automatic risk without authoritative attainmentState = under_target
  await test('E4.2.13: Achieved KPI is not marked as risk or gap even if score is mentioned', () => {
    const achievedMap = new Map([
      ['asg-1', {
        id: 'asg-1',
        resultMode: 'live',
        items: [{
          id: 'it-1',
          assignmentItemId: 'it-1',
          scoringStatus: 'scored',
          actual: 100,
          target: 100,
          gap: 0,
          attainmentState: 'achieved',
          achievementPercent: 100
        }]
      }]
    ]);
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'KPI chưa đạt mức tối đa và còn khoảng cách rủi ro',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, achievedMap);
    assert.strictEqual(normalized.issues.length, 0, 'Achieved KPI cannot be reported as gap or risk');
  });

  // E4.2.14: Boolean KPI with state = achieved cannot be labeled with risk or gap
  await test('E4.2.14: Boolean KPI with state = achieved cannot be labeled with risk or gap', () => {
    const booleanMap = new Map([
      ['asg-1', {
        id: 'asg-1',
        resultMode: 'live',
        items: [{
          id: 'it-1',
          assignmentItemId: 'it-1',
          scoringStatus: 'scored',
          measurementType: 'boolean',
          actual: 1,
          target: 1,
          gap: null,
          attainmentState: 'achieved'
        }]
      }]
    ]);
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'KPI boolean này còn thiếu chỉ số và có rủi ro',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, booleanMap);
    assert.strictEqual(normalized.issues.length, 0, 'Boolean achieved KPI cannot have gap or risk claims');
  });

  // E4.2.15: Invalid config / invalid target is data_issue / attention, normalizer rejects employee fault
  await test('E4.2.15: Invalid config / invalid target is data_issue / attention, normalizer rejects employee fault', () => {
    const invalidConfigMap = new Map([
      ['asg-1', {
        id: 'asg-1',
        resultMode: 'live',
        items: [{
          id: 'it-1',
          assignmentItemId: 'it-1',
          scoringStatus: 'invalid_config',
          actual: null,
          target: null,
          attainmentState: 'invalid_config'
        }]
      }]
    ]);
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'Cấu hình sai là do nhân viên không kiểm tra kĩ',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'data_issue: KPI chưa thể chấm điểm do cấu hình chưa hợp lệ',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, invalidConfigMap);
    assert.strictEqual(normalized.issues.length, 1, 'Should reject employee blaming and keep data_issue');
    assert.ok(normalized.issues[0].text.includes('data_issue'));
  });

  // E4.2.16: Normalizer rejects risk scores or AI ratings
  await test('E4.2.16: Normalizer rejects risk scores or AI ratings', () => {
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'Điểm rủi ro hiệu suất của KPI này là 65/100',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'AI risk rating is high for this item',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.strictEqual(normalized.issues.length, 0, 'Normalizer must reject risk scores and AI ratings');
  });

  // E4.2.17: Summary filtering removes predictive risk / employee risk sentences while preserving factual sentences
  await test('E4.2.17: Summary filtering removes predictive risk / employee risk sentences while preserving factual sentences', () => {
    const rawResult = {
      summary: 'Hiện tại có 5 KPI trong hệ thống. Nhân viên Nguyễn Văn A có rủi ro cao thất bại. KPI Doanh số hiện còn khoảng cách so với mục tiêu.',
      highlights: [],
      issues: [],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIds, assignmentsById);
    assert.ok(!normalized.summary.includes('Nhân viên Nguyễn Văn A có rủi ro cao thất bại'), 'Must remove sentence with prohibited risk content');
    assert.ok(normalized.summary.includes('Hiện tại có 5 KPI trong hệ thống'), 'Must preserve valid factual first sentence');
    assert.ok(normalized.summary.includes('KPI Doanh số hiện còn khoảng cách so với mục tiêu'), 'Must preserve valid factual third sentence');
  });

  // E4.2.18: Issues list allows valid factual categories: descriptive gap, data_issue, attention
  await test('E4.2.18: Issues list allows valid factual categories: descriptive gap, data_issue, attention', () => {
    const mixedMap = new Map([
      ['asg-1', {
        id: 'asg-1',
        resultMode: 'live',
        items: [
          { id: 'it-1', assignmentItemId: 'it-1', scoringStatus: 'scored', actual: 80, target: 100, gap: 20, attainmentState: 'under_target' },
          { id: 'it-2', assignmentItemId: 'it-2', scoringStatus: 'not_scored', actual: null, target: 50, gap: null, attainmentState: 'not_scored' },
          { id: 'it-3', assignmentItemId: 'it-3', scoringStatus: 'invalid_config', actual: null, target: null, gap: null, attainmentState: 'invalid_config' }
        ]
      }]
    ]);
    const validItemIdsMixed = new Set(['it-1', 'it-2', 'it-3']);
    const rawResult = {
      summary: 'Tổng quan',
      highlights: [],
      issues: [
        {
          text: 'gap: KPI Doanh thu còn khoảng cách 20 đơn vị so với mục tiêu',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-1', type: 'kpi_item' }]
        },
        {
          text: 'data_issue: KPI Tiếp thị chưa có dữ liệu Actual được ghi nhận',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-2', type: 'kpi_item' }]
        },
        {
          text: 'attention: KPI Đào tạo chưa thể tính điểm do cấu hình chưa hợp lệ',
          evidence: [{ assignmentId: 'asg-1', assignmentItemId: 'it-3', type: 'kpi_item' }]
        }
      ],
      actions: []
    };
    const normalized = normalizeKPIIntelligenceResult(rawResult, validAssignmentIds, validItemIdsMixed, mixedMap);
    assert.strictEqual(normalized.issues.length, 3, 'All 3 valid factual categories must be preserved');
    assert.ok(normalized.issues[0].text.startsWith('gap:'));
    assert.ok(normalized.issues[1].text.startsWith('data_issue:'));
    assert.ok(normalized.issues[2].text.startsWith('attention:'));
  });

  // E4.2.19: Staff prompt contains all mandatory risk contract instructions
  await test('E4.2.19: Staff prompt definition in registry conforms to risk contract rules', () => {
    const def = aiPromptRegistry['kpi.staff_summary'];
    assert.ok(def, 'kpi.staff_summary must exist in registry');
    const instruction = def.systemInstruction;
    assert.ok(instruction.includes('HỢP ĐỒNG RỦI RO KPI (KPI RISK CONTRACT)'));
    assert.ok(instruction.includes('KHOẢNG CÁCH KHÔNG TỰ ĐỘNG LÀ RỦI RO (gap != predictive risk)'));
    assert.ok(instruction.includes('THIẾU DỮ LIỆU KHÔNG PHẢI RỦI RO HIỆU SUẤT (missing != performance risk)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG TỰ NGHĨ RA MỨC ĐỘ RỦI RO (No High/Medium/Low Invention)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG DỰ BÁO TƯƠNG LAI (No Probability Prediction)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG TẠO ĐIỂM RỦI RO (No Employee Risk Score)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG SUY DIỄN XU HƯỚNG KHI THIẾU DỮ LIỆU (No Trend Without Data)'));
    assert.ok(instruction.includes('KPI ĐÃ KHÓA (LOCKED KPI)'));
    assert.ok(instruction.includes('CHỈ DÙNG CÁC DANH MỤC KHÁCH QUAN'));
  });

  // E4.2.20: Team prompt contains all mandatory risk contract instructions
  await test('E4.2.20: Team prompt definition in registry conforms to risk contract rules', () => {
    const def = aiPromptRegistry['kpi.team_summary'];
    assert.ok(def, 'kpi.team_summary must exist in registry');
    const instruction = def.systemInstruction;
    assert.ok(instruction.includes('HỢP ĐỒNG RỦI RO KPI (KPI RISK CONTRACT)'));
    assert.ok(instruction.includes('KHOẢNG CÁCH KHÔNG TỰ ĐỘNG LÀ RỦI RO (gap != predictive risk)'));
    assert.ok(instruction.includes('THIẾU DỮ LIỆU KHÔNG PHẢI RỦI RO HIỆU SUẤT (missing != performance risk)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG TỰ NGHĨ RA MỨC ĐỘ RỦI RO (No High/Medium/Low Invention)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG DỰ BÁO TƯƠNG LAI (No Probability Prediction)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG TẠO ĐIỂM RỦI RO (No Employee Risk Score)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG SUY DIỄN XU HƯỚNG KHI THIẾU DỮ LIỆU (No Trend Without Data)'));
    assert.ok(instruction.includes('KPI ĐÃ KHÓA (LOCKED KPI)'));
    assert.ok(instruction.includes('TỔNG HỢP NHÓM: TUYỆT ĐỐI KHÔNG'));
    assert.ok(instruction.includes('nhóm yếu kém'));
  });

  // E4.2.21: Unit prompt contains all mandatory risk contract instructions
  await test('E4.2.21: Unit prompt definition in registry conforms to risk contract rules', () => {
    const def = aiPromptRegistry['kpi.unit_summary'];
    assert.ok(def, 'kpi.unit_summary must exist in registry');
    const instruction = def.systemInstruction;
    assert.ok(instruction.includes('HỢP ĐỒNG RỦI RO KPI (KPI RISK CONTRACT)'));
    assert.ok(instruction.includes('KHOẢNG CÁCH KHÔNG TỰ ĐỘNG LÀ RỦI RO (gap != predictive risk)'));
    assert.ok(instruction.includes('THIẾU DỮ LIỆU KHÔNG PHẢI RỦI RO HIỆU SUẤT (missing != performance risk)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG TỰ NGHĨ RA MỨC ĐỘ RỦI RO (No High/Medium/Low Invention)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG DỰ BÁO TƯƠNG LAI (No Probability Prediction)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG TẠO ĐIỂM RỦI RO (No Employee Risk Score)'));
    assert.ok(instruction.includes('TUYỆT ĐỐI KHÔNG SUY DIỄN XU HƯỚNG KHI THIẾU DỮ LIỆU (No Trend Without Data)'));
    assert.ok(instruction.includes('KPI ĐÃ KHÓA (LOCKED KPI)'));
    assert.ok(instruction.includes('TỔNG HỢP ĐƠN VỊ: TUYỆT ĐỐI KHÔNG xếp hạng rủi ro giữa các đơn vị'));
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
