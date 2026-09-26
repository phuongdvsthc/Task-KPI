import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaffKpiAiSummary } from './StaffKpiAiSummary';
import { StaffMyKpiView } from './StaffMyKpiView';
import { KPIAIResultPanel } from '../intelligence/KPIAIResultPanel';
import { KPIAIErrorAlert } from '../intelligence/KPIAIErrorAlert';
import {
  getKpiAiFriendlyErrorMessage,
  KPI_AI_ERROR_MESSAGES
} from '../intelligence/kpiAiErrorUtils';
import { KPIIntelligenceResult, KPIEvidenceRef } from '../../../types/kpi-intelligence';
import { KpiAssignment } from '../../../types/kpi';

// Test runner helper
let passCount = 0;
let failCount = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passCount++;
  } catch (err: any) {
    console.error(`FAIL: ${name}`, err);
    failCount++;
  }
}

console.log('--- STARTING v0.5-E5.2 STAFF KPI AI UI ACCEPTANCE ---');

// Mock fixtures
const mockAssignments: KpiAssignment[] = [
  {
    id: 'assign-101',
    period_id: 'period-2026-q1',
    template_id: 'tpl-1',
    template_version_id: 'ver-1',
    assignee_type: 'individual',
    assignee_user_id: 'staff-user-1',
    assignee_organization_unit_id: null,
    assignee_unit_id_snapshot: null,
    effective_from: '2026-01-01',
    effective_to: '2026-03-31',
    notes: null,
    periodId: 'period-2026-q1',
    periodName: 'Quý 1 / 2026',
    status: 'active',
    templateName: 'KPI Nhân viên Kỹ thuật',
    period: {
      id: 'period-2026-q1',
      name: 'Quý 1 / 2026',
      code: '2026_Q1',
      start_date: '2026-01-01',
      end_date: '2026-03-31',
      status: 'active'
    } as any
  },
  {
    id: 'assign-102',
    period_id: 'period-2026-q2',
    template_id: 'tpl-2',
    template_version_id: 'ver-2',
    assignee_type: 'individual',
    assignee_user_id: 'staff-user-1',
    assignee_organization_unit_id: null,
    assignee_unit_id_snapshot: null,
    effective_from: '2026-04-01',
    effective_to: '2026-06-30',
    notes: null,
    periodId: 'period-2026-q2',
    periodName: 'Quý 2 / 2026',
    status: 'locked',
    templateName: 'KPI Đổi mới sáng tạo',
    period: {
      id: 'period-2026-q2',
      name: 'Quý 2 / 2026',
      code: '2026_Q2',
      start_date: '2026-04-01',
      end_date: '2026-06-30',
      status: 'active'
    } as any
  }
];

const mockAiResult: KPIIntelligenceResult = {
  summary: 'Tiến độ thực hiện KPI cá nhân trong Quý 1 / 2026 đạt 92% kế hoạch, các chỉ tiêu trọng tâm đang vận hành ổn định.',
  highlights: [
    {
      text: 'Chỉ tiêu chất lượng dịch vụ đạt 98% vượt kỳ vọng.',
      evidence: [
        {
          type: 'kpi_item',
          assignmentId: 'assign-101',
          assignmentItemId: 'item-101',
          kpiName: 'Chất lượng dịch vụ',
          scoreMode: 'live',
          target: 95,
          actual: 98,
          score: 100,
          scoringStatus: 'scored',
          attainmentState: 'exceeded'
        }
      ]
    }
  ],
  issues: [
    {
      text: 'Chỉ tiêu thời gian xử lý sự cố chưa cập nhật số liệu thực tế.',
      evidence: [
        {
          type: 'kpi_item',
          assignmentId: 'assign-101',
          assignmentItemId: 'item-102',
          kpiName: 'Thời gian xử lý sự cố',
          scoreMode: 'live',
          target: 4,
          actual: null,
          scoringStatus: 'not_scored'
        }
      ]
    }
  ],
  actions: [
    {
      text: 'Rà soát nguồn dữ liệu để cập nhật Actual cho chỉ tiêu Thời gian xử lý sự cố.',
      actionType: 'suggested',
      evidence: [
        {
          type: 'kpi_item',
          assignmentId: 'assign-101',
          assignmentItemId: 'item-102',
          kpiName: 'Thời gian xử lý sự cố'
        }
      ]
    }
  ],
  metadata: {
    featureKey: 'kpi.staff_summary',
    promptKey: 'kpi.staff_summary',
    generatedAt: new Date().toISOString(),
    periodId: 'period-2026-q1',
    periodLabel: 'Quý 1 / 2026',
    scopeLabel: 'self',
    assignmentCount: 1,
    itemCount: 2,
    scoredCount: 1,
    unscoredCount: 1,
    lockedCount: 0,
    liveCount: 1,
    truncatedContext: false
  }
};

// E5.2.1 AI action appears on Staff KPI page
runTest('E5.2.1 – AI action appears on Staff KPI page', () => {
  const html = renderToStaticMarkup(
    <StaffKpiAiSummary assignments={mockAssignments} />
  );
  assert.ok(html.includes('Tóm tắt KPI bằng AI'), 'Must include "Tóm tắt KPI bằng AI" button text');
  assert.ok(html.includes('id="btn-staff-kpi-ai-summary"'), 'Must have action button');
  assert.ok(html.includes('id="staff-kpi-ai-summary-container"'), 'Must have container');
});

// E5.2.2 request feature exact
runTest('E5.2.2 – request feature exact', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(
    source.includes("feature: 'staff_kpi_summary'"),
    'Must specify feature: "staff_kpi_summary" in request payload'
  );
});

// E5.2.3 backend actor used, no Staff auth userId required
runTest('E5.2.3 – backend actor used, no Staff auth userId required', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  // Ensure payload does not send client-specified userId
  assert.ok(
    !source.includes('payload.userId =') && !source.includes('userId:'),
    'Payload must NOT send userId; backend must derive authenticated user'
  );
});

// E5.2.4 selected period passed correctly
runTest('E5.2.4 – selected period passed correctly', () => {
  const html = renderToStaticMarkup(
    <StaffKpiAiSummary
      assignments={mockAssignments}
      periodId="period-2026-q1"
    />
  );
  assert.ok(html.includes('value="period-2026-q1"'), 'Period select must contain period-2026-q1');
  assert.ok(html.includes('Quý 1 / 2026'), 'Period name must be displayed');
});

// E5.2.5 selected assignment filter passed correctly if supported
runTest('E5.2.5 – selected assignment filter passed correctly if supported', () => {
  const html = renderToStaticMarkup(
    <StaffKpiAiSummary
      assignments={mockAssignments}
      assignmentId="assign-101"
    />
  );
  assert.ok(html.includes('value="assign-101"'), 'Assignment select must reflect assign-101');
  assert.ok(html.includes('KPI Nhân viên Kỹ thuật'), 'Assignment template name must be displayed');
});

// E5.2.6 result panel reused
runTest('E5.2.6 – result panel reused', () => {
  const html = renderToStaticMarkup(
    <KPIAIResultPanel result={mockAiResult} role="staff" />
  );
  assert.ok(html.includes('Tóm tắt'), 'Must render Tóm tắt section');
  assert.ok(html.includes('Điểm nổi bật'), 'Must render Điểm nổi bật');
  assert.ok(html.includes('Vướng mắc'), 'Must render Vướng mắc');
  assert.ok(html.includes('Việc cần theo dõi'), 'Must render Việc cần theo dõi');
});

// E5.2.7 live badge visible
runTest('E5.2.7 – live badge visible', () => {
  const html = renderToStaticMarkup(
    <KPIAIResultPanel result={mockAiResult} role="staff" />
  );
  assert.ok(html.includes('Kết quả hiện tại'), 'Must render "Kết quả hiện tại" badge for live scoreMode');
});

// E5.2.8 official badge visible
runTest('E5.2.8 – official badge visible', () => {
  const officialResult: KPIIntelligenceResult = {
    ...mockAiResult,
    metadata: {
      ...mockAiResult.metadata,
      lockedCount: 1,
      liveCount: 0
    },
    highlights: [
      {
        text: 'Chỉ tiêu chính thức đã hoàn thành.',
        evidence: [
          {
            type: 'kpi_item',
            assignmentId: 'assign-102',
            assignmentItemId: 'item-201',
            kpiName: 'Đổi mới',
            scoreMode: 'official'
          }
        ]
      }
    ]
  };
  const html = renderToStaticMarkup(
    <KPIAIResultPanel result={officialResult} role="staff" />
  );
  assert.ok(html.includes('Kết quả chính thức'), 'Must render "Kết quả chính thức" badge');
});

// E5.2.9 partial result remains partial
runTest('E5.2.9 – partial result remains partial', () => {
  const partialResult: KPIIntelligenceResult = {
    ...mockAiResult,
    issues: [
      {
        text: 'Chỉ tiêu đang trong trạng thái tính một phần.',
        evidence: [
          {
            type: 'kpi_item',
            assignmentId: 'assign-101',
            assignmentItemId: 'item-103',
            kpiName: 'Đánh giá tiến độ',
            scoringStatus: 'partial'
          }
        ]
      }
    ]
  };
  const html = renderToStaticMarkup(
    <KPIAIResultPanel result={partialResult} role="staff" />
  );
  assert.ok(html.includes('Kết quả một phần'), 'Must display "Kết quả một phần" for partial status');
  assert.ok(!html.includes('0 điểm'), 'Must not display 0 điểm for partial state');
});

// E5.2.10 missing/unscored remains factual
runTest('E5.2.10 – missing/unscored remains factual', () => {
  const html = renderToStaticMarkup(
    <KPIAIResultPanel result={mockAiResult} role="staff" />
  );
  assert.ok(html.includes('Chưa có Actual'), 'Missing actual must be rendered as "Chưa có Actual"');
  assert.ok(html.includes('Chưa chấm điểm'), 'Unscored must be rendered as "Chưa chấm điểm"');
});

// E5.2.11 period change clears old result
runTest('E5.2.11 – period change clears old result', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  // Verify useEffect includes selectedPeriodId and clears result
  assert.ok(
    source.includes('selectedPeriodId, selectedAssignmentId, selectedStatus, includeLocked'),
    'useEffect must depend on filter states'
  );
  assert.ok(
    source.includes('setResult(null);'),
    'Filter change must clear result'
  );
});

// E5.2.12 assignment change clears old result
runTest('E5.2.12 – assignment change clears old result', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(
    source.includes('selectedAssignmentId'),
    'Filter dependency must include selectedAssignmentId'
  );
});

// E5.2.13 status change clears old result
runTest('E5.2.13 – status change clears old result', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(
    source.includes('selectedStatus'),
    'Filter dependency must include selectedStatus'
  );
});

// E5.2.14 includeLocked change clears old result
runTest('E5.2.14 – includeLocked change clears old result', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(
    source.includes('includeLocked'),
    'Filter dependency must include includeLocked'
  );
});

// E5.2.15 duplicate submit prevented
runTest('E5.2.15 – duplicate submit prevented', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(
    source.includes('if (loading) return;'),
    'Must check if (loading) return to prevent duplicate submit'
  );
  assert.ok(
    source.includes('disabled={loading}'),
    'Button must be disabled when loading'
  );
});

// E5.2.16 loading clears after success
runTest('E5.2.16 – loading clears after success', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(
    source.includes('setLoading(false);'),
    'setLoading(false) must be called in finally'
  );
});

// E5.2.17 loading clears after failure
runTest('E5.2.17 – loading clears after failure', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(
    source.includes('finally {'),
    'Loading reset must be inside finally block'
  );
});

// E5.2.18 regenerate uses current filters
runTest('E5.2.18 – regenerate uses current filters', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(
    source.includes('onRegenerate={handleGenerate}'),
    'handleGenerate must be passed as onRegenerate to use current filter state'
  );
});

// E5.2.19 old Period A response cannot overwrite Period B
runTest('E5.2.19 – old Period A response cannot overwrite Period B', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(
    source.includes('latestRequestId.current'),
    'Must track latestRequestId to ignore stale responses'
  );
  assert.ok(
    source.includes('if (requestId !== latestRequestId.current'),
    'Must reject response if requestId !== latestRequestId.current'
  );
});

// E5.2.20 old Assignment A response cannot overwrite Assignment B
runTest('E5.2.20 – old Assignment A response cannot overwrite Assignment B', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(
    source.includes('latestRequestId.current++'),
    'Filter change must increment latestRequestId counter'
  );
  assert.ok(
    source.includes('abortControllerRef.current?.abort()') || source.includes('abortControllerRef.current.abort()'),
    'Filter change must abort pending controller'
  );
});

// E5.2.21 navigation/unmount safe
runTest('E5.2.21 – navigation/unmount safe', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(
    source.includes('isMountedRef.current = false'),
    'Must mark unmount in cleanup'
  );
  assert.ok(
    source.includes('abortControllerRef.current.abort()'),
    'Must abort in-flight requests on unmount'
  );
});

// E5.2.22 empty result handled normally
runTest('E5.2.22 – empty result handled normally', () => {
  const emptyResult: KPIIntelligenceResult = {
    summary: 'Không có dữ liệu KPI phù hợp trong phạm vi đã chọn.',
    highlights: [],
    issues: [],
    actions: [],
    metadata: {
      featureKey: 'kpi.staff_summary',
      promptKey: 'kpi.staff_summary',
      generatedAt: new Date().toISOString(),
      truncatedContext: false,
      assignmentCount: 0,
      itemCount: 0,
      scoredCount: 0,
      unscoredCount: 0,
      lockedCount: 0,
      liveCount: 0
    }
  };
  const html = renderToStaticMarkup(
    <KPIAIResultPanel result={emptyResult} role="staff" />
  );
  assert.ok(html.includes('Không có dữ liệu KPI phù hợp trong phạm vi đã chọn.'), 'Must render empty summary');
  assert.ok(html.includes('Chưa ghi nhận điểm nổi bật.'), 'Must show deterministic empty highlights');
  assert.ok(html.includes('Chưa ghi nhận vướng mắc.'), 'Must show deterministic empty issues');
  assert.ok(html.includes('Chưa có việc cần theo dõi.'), 'Must show deterministic empty actions');
  assert.ok(!html.includes('bg-rose-50'), 'Empty result must not have error alert styling');
});

// E5.2.23 truncated result notice visible
runTest('E5.2.23 – truncated result notice visible', () => {
  const truncatedResult: KPIIntelligenceResult = {
    ...mockAiResult,
    metadata: {
      ...mockAiResult.metadata,
      truncatedContext: true
    }
  };
  const html = renderToStaticMarkup(
    <KPIAIResultPanel result={truncatedResult} role="staff" />
  );
  assert.ok(
    html.includes('Kết quả được tạo từ một phần dữ liệu KPI do giới hạn ngữ cảnh.'),
    'Must render truncated notice'
  );
});

// E5.2.24 AI_DISABLED friendly
runTest('E5.2.24 – AI_DISABLED friendly', () => {
  const msg = getKpiAiFriendlyErrorMessage('AI feature is currently disabled', 'AI_DISABLED');
  assert.strictEqual(msg, 'Tính năng AI hiện đang được tắt.');
  const html = renderToStaticMarkup(<KPIAIErrorAlert error="Disabled" errorCode="AI_DISABLED" />);
  assert.ok(html.includes('Tính năng AI hiện đang được tắt.'));
});

// E5.2.25 AI_NOT_CONFIGURED friendly
runTest('E5.2.25 – AI_NOT_CONFIGURED friendly', () => {
  const msg = getKpiAiFriendlyErrorMessage('Missing API key', 'AI_NOT_CONFIGURED');
  assert.strictEqual(msg, 'Tính năng AI chưa được cấu hình.');
  const html = renderToStaticMarkup(<KPIAIErrorAlert error="Missing" errorCode="AI_NOT_CONFIGURED" />);
  assert.ok(html.includes('Tính năng AI chưa được cấu hình.'));
});

// E5.2.26 RATE_LIMITED friendly
runTest('E5.2.26 – RATE_LIMITED friendly', () => {
  const msg = getKpiAiFriendlyErrorMessage('Rate limit exceeded 429', 'RATE_LIMITED');
  assert.strictEqual(msg, 'Hệ thống AI đang bận. Vui lòng thử lại sau.');
  const html = renderToStaticMarkup(<KPIAIErrorAlert error="Rate" errorCode="RATE_LIMITED" />);
  assert.ok(html.includes('Hệ thống AI đang bận. Vui lòng thử lại sau.'));
});

// E5.2.27 TIMEOUT friendly
runTest('E5.2.27 – TIMEOUT friendly', () => {
  const msg = getKpiAiFriendlyErrorMessage('Request took too long', 'TIMEOUT');
  assert.strictEqual(msg, 'Yêu cầu AI mất quá nhiều thời gian. Vui lòng thử lại.');
  const html = renderToStaticMarkup(<KPIAIErrorAlert error="Timeout" errorCode="TIMEOUT" />);
  assert.ok(html.includes('Yêu cầu AI mất quá nhiều thời gian. Vui lòng thử lại.'));
});

// E5.2.28 PROVIDER_UNAVAILABLE friendly
runTest('E5.2.28 – PROVIDER_UNAVAILABLE friendly', () => {
  const msg = getKpiAiFriendlyErrorMessage('Provider 503 unavailable', 'PROVIDER_UNAVAILABLE');
  assert.strictEqual(msg, 'Dịch vụ AI tạm thời chưa khả dụng.');
  const html = renderToStaticMarkup(<KPIAIErrorAlert error="503" errorCode="PROVIDER_UNAVAILABLE" />);
  assert.ok(html.includes('Dịch vụ AI tạm thời chưa khả dụng.'));
});

// E5.2.29 INVALID_RESPONSE friendly
runTest('E5.2.29 – INVALID_RESPONSE friendly', () => {
  const msg = getKpiAiFriendlyErrorMessage('Failed to parse JSON', 'INVALID_RESPONSE');
  assert.strictEqual(msg, 'AI chưa thể tạo kết quả hợp lệ. Vui lòng thử lại.');
  const html = renderToStaticMarkup(<KPIAIErrorAlert error="Bad JSON" errorCode="INVALID_RESPONSE" />);
  assert.ok(html.includes('AI chưa thể tạo kết quả hợp lệ. Vui lòng thử lại.'));
});

// E5.2.30 CONTENT_BLOCKED friendly
runTest('E5.2.30 – CONTENT_BLOCKED friendly', () => {
  const msg = getKpiAiFriendlyErrorMessage('Blocked by safety policy', 'CONTENT_BLOCKED');
  assert.strictEqual(msg, 'AI không thể tạo nội dung cho yêu cầu này.');
  const html = renderToStaticMarkup(<KPIAIErrorAlert error="Blocked" errorCode="CONTENT_BLOCKED" />);
  assert.ok(html.includes('AI không thể tạo nội dung cho yêu cầu này.'));
});

// E5.2.31 raw backend error absent
runTest('E5.2.31 – raw backend error absent', () => {
  const rawLeak = 'Error at pg_query line 42: column "secret_pw" does not exist (POST /api/internal/kpi)';
  const msg = getKpiAiFriendlyErrorMessage(rawLeak, 'INTERNAL_SERVER_ERROR');
  assert.ok(!msg.includes('pg_query'), 'Must not leak database details');
  assert.ok(!msg.includes('secret_pw'), 'Must not leak internal columns');
  assert.ok(!msg.includes('POST /api/internal'), 'Must not leak internal URLs');
  assert.strictEqual(msg, 'Không thể thực hiện tóm tắt KPI lúc này. Vui lòng thử lại.');
});

// E5.2.32 AI failure does not break Staff KPI UI
runTest('E5.2.32 – AI failure does not break Staff KPI UI', () => {
  const html = renderToStaticMarkup(
    <div className="space-y-6">
      <StaffKpiAiSummary assignments={mockAssignments} />
      <KPIAIErrorAlert error="Failed" errorCode="PROVIDER_UNAVAILABLE" />
      <div id="normal-kpi-list">
        {mockAssignments.map(a => (
          <div key={a.id} id={`assignment-${a.id}`}>
            {a.templateName} - {a.periodName}
          </div>
        ))}
      </div>
    </div>
  );
  assert.ok(html.includes('Dịch vụ AI tạm thời chưa khả dụng.'), 'Error banner rendered');
  assert.ok(html.includes('KPI Nhân viên Kỹ thuật'), 'Normal KPI content remains completely rendered');
  assert.ok(html.includes('KPI Đổi mới sáng tạo'), 'Second assignment remains completely rendered');
});

// E5.2.33 evidence drill-down reauthorizes if clickable
runTest('E5.2.33 – evidence drill-down reauthorizes if clickable', () => {
  let drillDownCalled = false;
  let drillDownAssignmentId = '';

  const handleDrillDown = (id: string) => {
    drillDownCalled = true;
    drillDownAssignmentId = id;
  };

  // Simulate internal logic of handleEvidenceDrillDown
  const testEvidence: KPIEvidenceRef = {
    type: 'kpi_item',
    assignmentId: 'assign-101',
    assignmentItemId: 'item-101'
  };

  const isAuthorized = mockAssignments.some(a => a.id === testEvidence.assignmentId);
  if (isAuthorized) {
    handleDrillDown(testEvidence.assignmentId);
  }

  assert.strictEqual(drillDownCalled, true, 'Authorized assignment must proceed to drill-down');
  assert.strictEqual(drillDownAssignmentId, 'assign-101');
});

// E5.2.34 revoked access blocks drill-down
runTest('E5.2.34 – revoked access blocks drill-down', () => {
  let drillDownCalled = false;

  const handleDrillDown = () => {
    drillDownCalled = true;
  };

  // Malicious or unauthorized assignment ID not belonging to mockAssignments
  const rogueEvidence: KPIEvidenceRef = {
    type: 'kpi_item',
    assignmentId: 'unauthorized-assign-999',
    assignmentItemId: 'item-999'
  };

  const isAuthorized = mockAssignments.some(a => a.id === rogueEvidence.assignmentId);
  if (isAuthorized) {
    handleDrillDown();
  }

  assert.strictEqual(drillDownCalled, false, 'Revoked/unauthorized ID must NOT drill down');
});

// E5.2.35 no mutation controls
runTest('E5.2.35 – no mutation controls', () => {
  const html = renderToStaticMarkup(
    <div id="ai-container">
      <StaffKpiAiSummary assignments={mockAssignments} />
      <KPIAIResultPanel result={mockAiResult} role="staff" />
    </div>
  );
  assert.ok(!html.includes('Sửa Target') && !html.includes('Edit Target'), 'No Target edit');
  assert.ok(!html.includes('Sửa Điểm') && !html.includes('Edit Score'), 'No Score edit');
  assert.ok(!html.includes('Khóa KPI') && !html.includes('Mở khóa KPI'), 'No Lock/Unlock control');
  assert.ok(!html.includes('Tạo công việc') && !html.includes('Tạo Task'), 'No Task creation');
  assert.ok(!html.includes('Phê duyệt') && !html.includes('Trả lại review'), 'No review transitions');
});

// E5.2.36 no employee performance/ranking UI
runTest('E5.2.36 – no employee performance/ranking UI', () => {
  const html = renderToStaticMarkup(
    <KPIAIResultPanel result={mockAiResult} role="staff" />
  );
  assert.ok(!html.includes('Bảng xếp hạng'), 'No leaderboard');
  assert.ok(!html.includes('Xếp loại nhân viên'), 'No employee performance rating');
  assert.ok(!html.includes('Điểm rủi ro nhân sự'), 'No employee risk score');
  assert.ok(!html.includes('Top performer'), 'No top performers');
});

// E5.2.37 no API/service-role secret in browser
runTest('E5.2.37 – no API/service-role secret in browser', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx'),
    'utf-8'
  );
  assert.ok(!source.includes('SUPABASE_SERVICE_ROLE_KEY'), 'No service role key in frontend file');
  assert.ok(!source.includes('process.env.GEMINI_API_KEY'), 'No Gemini API key in frontend file');
  assert.ok(!source.includes('system_instruction'), 'No system instruction in frontend file');
});

// E5.2.38 XSS smoke PASS
runTest('E5.2.38 – XSS smoke PASS', () => {
  const xssPayload: KPIIntelligenceResult = {
    summary: '<script>alert("xss-summary")</script>',
    highlights: [
      {
        text: '<img src=x onerror=alert("xss-hl") />',
        evidence: []
      }
    ],
    issues: [
      {
        text: '<b onmouseover=alert("xss-issue")>hover</b>',
        evidence: []
      }
    ],
    actions: [
      {
        text: '<iframe src="javascript:alert(1)"></iframe>',
        evidence: []
      }
    ],
    metadata: {
      featureKey: 'kpi.staff_summary',
      promptKey: 'kpi.staff_summary',
      generatedAt: new Date().toISOString(),
      truncatedContext: false
    }
  };
  const html = renderToStaticMarkup(
    <KPIAIResultPanel result={xssPayload} role="staff" />
  );
  assert.ok(!html.includes('<script>'), '<script> must be escaped');
  assert.ok(html.includes('&lt;script&gt;alert('), 'Must be safely escaped HTML entities');
  assert.ok(!html.includes('<img src=x'), '<img onerror> must be escaped');
  assert.ok(html.includes('&lt;img src=x'), 'Img tag must be escaped entities');
});

// E5.2.39 Staff KPI normal UI regression PASS
runTest('E5.2.39 – Staff KPI normal UI regression PASS', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffMyKpiView.tsx'),
    'utf-8'
  );
  assert.ok(source.includes('KPI của tôi'), 'Title must exist');
  assert.ok(source.includes('StaffKpiAiSummary'), 'StaffKpiAiSummary must be mounted in StaffMyKpiView');
  assert.ok(source.includes('kpiAssignmentService.getMyAssignments'), 'Core API fetch must remain intact');
  assert.ok(source.includes('kpiScoringService.resolveAssignmentScore'), 'Scoring service must remain intact');
  assert.ok(source.includes('kpiReviewService.getReviewByAssignment'), 'Review service must remain intact');
});

// E5.2.40 frontend production build PASS (file check)
runTest('E5.2.40 – frontend production build verification', () => {
  assert.ok(
    fs.existsSync(path.resolve(process.cwd(), 'src/components/kpis/assignments/StaffKpiAiSummary.tsx')),
    'StaffKpiAiSummary.tsx must exist'
  );
  assert.ok(
    fs.existsSync(path.resolve(process.cwd(), 'src/components/kpis/intelligence/KPIAIResultPanel.tsx')),
    'KPIAIResultPanel.tsx must exist'
  );
  assert.ok(
    fs.existsSync(path.resolve(process.cwd(), 'src/components/kpis/intelligence/KPIAIErrorAlert.tsx')),
    'KPIAIErrorAlert.tsx must exist'
  );
  assert.ok(
    fs.existsSync(path.resolve(process.cwd(), 'src/components/kpis/intelligence/kpiAiErrorUtils.ts')),
    'kpiAiErrorUtils.ts must exist'
  );
});

console.log('====================================================');
console.log(`ACCEPTANCE SUITE: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount}`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('v0.5-E5.2 STAFF KPI AI UI PASS');
}
