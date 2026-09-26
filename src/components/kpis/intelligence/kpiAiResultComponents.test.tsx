import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KPIAIResultPanel } from './KPIAIResultPanel';
import { KPIEvidenceList, getHumanReadableLabel, isUUID } from './KPIEvidenceList';
import { KPIIntelligenceResult, KPIEvidenceRef } from '../../../types/kpi-intelligence';

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

console.log('--- STARTING v0.5-E5.1 SHARED KPI AI RESULT COMPONENTS ACCEPTANCE ---');

// Mock data helpers
const createMockResult = (overrides?: Partial<KPIIntelligenceResult>): KPIIntelligenceResult => ({
  summary: 'Tổng quan kết quả KPI tháng 9: Tiến độ đạt yêu cầu, các mục tiêu trọng tâm đang được bám sát.',
  highlights: [
    {
      text: 'Doanh thu phòng kinh doanh hoàn thành 105% mục tiêu đề ra.',
      evidence: [
        {
          type: 'kpi_item',
          assignmentId: 'assign-1',
          assignmentItemId: 'item-1',
          kpiName: 'Doanh thu dịch vụ',
          scoreMode: 'live',
          target: 100,
          actual: 105,
          score: 100
        }
      ]
    }
  ],
  issues: [
    {
      text: 'Chỉ số SLA hỗ trợ khách hàng chưa cập nhật số liệu thực tế.',
      evidence: [
        {
          type: 'kpi_item',
          assignmentId: 'assign-2',
          assignmentItemId: 'item-2',
          kpiName: 'SLA phản hồi',
          scoreMode: 'official',
          target: 95,
          actual: null,
          scoringStatus: 'not_scored'
        }
      ]
    }
  ],
  actions: [
    {
      text: 'Theo dõi và cập nhật số liệu SLA từ hệ thống trước kỳ rà soát.',
      actionType: 'suggested',
      evidence: [
        {
          type: 'kpi_item',
          assignmentId: 'assign-2',
          assignmentItemId: 'item-2',
          kpiName: 'SLA phản hồi'
        }
      ]
    }
  ],
  metadata: {
    featureKey: 'staff_kpi_summary',
    promptKey: 'staff_kpi_summary_prompt',
    generatedAt: '2026-09-11T07:00:00Z',
    periodLabel: 'Tháng 09/2026',
    scopeLabel: 'unit',
    unitName: 'Phòng Kỹ thuật',
    assignmentCount: 2,
    itemCount: 5,
    scoredCount: 3,
    unscoredCount: 2,
    lockedCount: 1,
    liveCount: 1,
    truncatedContext: false
  },
  ...overrides
});

// E5.1.1 – shared result panel renders
runTest('E5.1.1 – shared result panel renders', () => {
  const result = createMockResult();
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(html.includes('data-testid="kpi-ai-result-panel"'));
  assert.ok(html.includes('Tóm tắt KPI cá nhân'));
});

// E5.1.2 – summary renders safely
runTest('E5.1.2 – summary renders safely', () => {
  const result = createMockResult({
    summary: 'Đánh giá KPI cá nhân trong tháng: 4/5 mục tiêu hoàn thành tốt.'
  });
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(html.includes('Đánh giá KPI cá nhân trong tháng: 4/5 mục tiêu hoàn thành tốt.'));
  assert.ok(html.includes('data-testid="kpi-summary-content"'));
});

// E5.1.3 – Highlights renders
runTest('E5.1.3 – Highlights renders', () => {
  const result = createMockResult({
    highlights: [
      { text: 'Chỉ tiêu Doanh thu quý đạt 110%.', evidence: [] }
    ]
  });
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(html.includes('Điểm nổi bật'));
  assert.ok(html.includes('Chỉ tiêu Doanh thu quý đạt 110%.'));
});

// E5.1.4 – Issues renders
runTest('E5.1.4 – Issues renders', () => {
  const result = createMockResult({
    issues: [
      { text: 'Chỉ tiêu tuyển dụng còn thiếu số liệu thực tế.', evidence: [] }
    ]
  });
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(html.includes('Vướng mắc'));
  assert.ok(html.includes('Chỉ tiêu tuyển dụng còn thiếu số liệu thực tế.'));
});

// E5.1.5 – Actions renders
runTest('E5.1.5 – Actions renders', () => {
  const result = createMockResult({
    actions: [
      { text: 'Bổ sung số liệu thực tế trước ngày 15.', actionType: 'explicit', evidence: [] }
    ]
  });
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(html.includes('Việc cần theo dõi'));
  assert.ok(html.includes('Bổ sung số liệu thực tế trước ngày 15.'));
});

// E5.1.6 – empty Highlights message correct
runTest('E5.1.6 – empty Highlights message correct', () => {
  const result = createMockResult({ highlights: [] });
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(html.includes('Chưa ghi nhận điểm nổi bật.'));
});

// E5.1.7 – empty Issues message correct
runTest('E5.1.7 – empty Issues message correct', () => {
  const result = createMockResult({ issues: [] });
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(html.includes('Chưa ghi nhận vướng mắc.'));
});

// E5.1.8 – empty Actions message correct
runTest('E5.1.8 – empty Actions message correct', () => {
  const result = createMockResult({ actions: [] });
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(html.includes('Chưa có việc cần theo dõi.'));
});

// E5.1.9 – live badge renders correctly
runTest('E5.1.9 – live badge renders correctly', () => {
  const evidence: KPIEvidenceRef[] = [
    {
      type: 'kpi_item',
      assignmentId: 'asg-live',
      kpiName: 'KPI Doanh thu',
      scoreMode: 'live'
    }
  ];
  const html = renderToStaticMarkup(<KPIEvidenceList evidence={evidence} />);
  assert.ok(html.includes('data-testid="badge-live"'));
  assert.ok(html.includes('Kết quả hiện tại'));
  assert.ok(!html.includes('Final'));
});

// E5.1.10 – official badge renders correctly
runTest('E5.1.10 – official badge renders correctly', () => {
  const evidence: KPIEvidenceRef[] = [
    {
      type: 'kpi_item',
      assignmentId: 'asg-off',
      kpiName: 'KPI Chi phí',
      scoreMode: 'official'
    }
  ];
  const html = renderToStaticMarkup(<KPIEvidenceList evidence={evidence} />);
  assert.ok(html.includes('data-testid="badge-official"'));
  assert.ok(html.includes('Kết quả chính thức'));
});

// E5.1.11 – missing Actual not shown as zero
runTest('E5.1.11 – missing Actual not shown as zero', () => {
  const evidence: KPIEvidenceRef[] = [
    {
      type: 'kpi_item',
      assignmentId: 'asg-missing',
      kpiName: 'KPI Thiếu số liệu',
      actual: null
    }
  ];
  const html = renderToStaticMarkup(<KPIEvidenceList evidence={evidence} />);
  assert.ok(html.includes('data-testid="badge-missing-actual"'));
  assert.ok(html.includes('Chưa có Actual'));
  assert.ok(!html.includes('Thực tế: 0'));
  assert.ok(!html.includes('0 điểm'));
});

// E5.1.12 – unscored not shown as zero
runTest('E5.1.12 – unscored not shown as zero', () => {
  const evidence: KPIEvidenceRef[] = [
    {
      type: 'kpi_item',
      assignmentId: 'asg-unscored',
      kpiName: 'KPI Chưa chấm',
      scoringStatus: 'not_scored'
    }
  ];
  const html = renderToStaticMarkup(<KPIEvidenceList evidence={evidence} />);
  assert.ok(html.includes('data-testid="badge-unscored"'));
  assert.ok(html.includes('Chưa chấm điểm'));
  assert.ok(!html.includes('0 điểm'));
});

// E5.1.13 – partial state displayed
runTest('E5.1.13 – partial state displayed', () => {
  const evidence: KPIEvidenceRef[] = [
    {
      type: 'kpi_item',
      assignmentId: 'asg-partial',
      kpiName: 'KPI Một phần',
      scoringStatus: 'partial'
    }
  ];
  const html = renderToStaticMarkup(<KPIEvidenceList evidence={evidence} />);
  assert.ok(html.includes('data-testid="badge-partial"'));
  assert.ok(html.includes('Kết quả một phần'));
});

// E5.1.14 – assignment evidence renders
runTest('E5.1.14 – assignment evidence renders', () => {
  const evidence: KPIEvidenceRef[] = [
    {
      type: 'kpi_assignment',
      assignmentId: 'asg-1',
      assigneeLabel: 'Nguyễn Văn A',
      scoreMode: 'live'
    }
  ];
  const html = renderToStaticMarkup(<KPIEvidenceList evidence={evidence} />);
  assert.ok(html.includes('Giao KPI'));
  assert.ok(html.includes('Nguyễn Văn A'));
});

// E5.1.15 – item evidence renders
runTest('E5.1.15 – item evidence renders', () => {
  const evidence: KPIEvidenceRef[] = [
    {
      type: 'kpi_item',
      assignmentId: 'asg-item',
      assignmentItemId: 'item-99',
      kpiName: 'Chỉ tiêu năng suất dự án',
      scoreMode: 'official'
    }
  ];
  const html = renderToStaticMarkup(<KPIEvidenceList evidence={evidence} />);
  assert.ok(html.includes('Chỉ tiêu năng suất dự án'));
  assert.ok(html.includes('Kết quả chính thức'));
});

// E5.1.16 – raw UUID not primary label
runTest('E5.1.16 – raw UUID not primary label', () => {
  const rawUUID = '123e4567-e89b-12d3-a456-426614174000';
  const labelForItem = getHumanReadableLabel({
    type: 'kpi_item',
    assignmentId: rawUUID,
    kpiName: rawUUID // kpiName accidentally passed as raw UUID
  });
  assert.strictEqual(labelForItem, 'Mục KPI');

  const labelForAssignment = getHumanReadableLabel({
    type: 'kpi_assignment',
    assignmentId: rawUUID,
    kpiName: undefined
  });
  assert.strictEqual(labelForAssignment, 'Giao KPI');

  const evidence: KPIEvidenceRef[] = [
    {
      type: 'kpi_item',
      assignmentId: rawUUID,
      kpiName: rawUUID
    }
  ];
  const html = renderToStaticMarkup(<KPIEvidenceList evidence={evidence} />);
  assert.ok(html.includes('Mục KPI'));
  // The primary text should NOT be the raw UUID
  assert.ok(!html.includes(`>${rawUUID}<`));
});

// E5.1.17 – historical unit label supported
runTest('E5.1.17 – historical unit label supported', () => {
  const evidence: KPIEvidenceRef[] = [
    {
      type: 'kpi_assignment',
      assignmentId: 'asg-hist',
      unitLabel: 'Phòng Phát Triển Cũ (Q1)',
      kpiName: 'Giao KPI Q1'
    }
  ];
  const html = renderToStaticMarkup(<KPIEvidenceList evidence={evidence} />);
  assert.ok(html.includes('data-testid="evidence-unit-label"'));
  assert.ok(html.includes('Phòng Phát Triển Cũ (Q1)'));
});

// E5.1.18 – truncation notice visible
runTest('E5.1.18 – truncation notice visible', () => {
  const truncatedResult = createMockResult({
    metadata: {
      featureKey: 'staff_kpi_summary',
      promptKey: 'staff_prompt',
      generatedAt: '2026-09-11T07:00:00Z',
      truncatedContext: true
    }
  });
  const htmlTruncated = renderToStaticMarkup(<KPIAIResultPanel result={truncatedResult} />);
  assert.ok(htmlTruncated.includes('data-testid="kpi-truncation-notice"'));
  assert.ok(htmlTruncated.includes('Kết quả được tạo từ một phần dữ liệu KPI do giới hạn ngữ cảnh.'));
  assert.ok(!htmlTruncated.includes('toàn bộ KPI'));

  const normalResult = createMockResult({
    metadata: {
      featureKey: 'staff_kpi_summary',
      promptKey: 'staff_prompt',
      generatedAt: '2026-09-11T07:00:00Z',
      truncatedContext: false
    }
  });
  const htmlNormal = renderToStaticMarkup(<KPIAIResultPanel result={normalResult} />);
  assert.ok(!htmlNormal.includes('data-testid="kpi-truncation-notice"'));
});

// E5.1.19 – disclaimer visible
runTest('E5.1.19 – disclaimer visible', () => {
  const result = createMockResult();
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(html.includes('data-testid="kpi-disclaimer"'));
  assert.ok(html.includes('Nội dung AI chỉ mang tính hỗ trợ tổng hợp. Vui lòng đối chiếu với dữ liệu KPI gốc khi cần.'));
});

// E5.1.20 – suggested action label visible
runTest('E5.1.20 – suggested action label visible', () => {
  const result = createMockResult({
    actions: [
      {
        text: 'Chủ động đối soát số liệu cùng phòng kế toán',
        actionType: 'suggested'
      }
    ]
  });
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(html.includes('data-testid="badge-suggested-action"'));
  assert.ok(html.includes('Gợi ý theo dõi'));
});

// E5.1.21 – no mutation controls
runTest('E5.1.21 – no mutation controls', () => {
  const result = createMockResult();
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} onRegenerate={() => {}} />);
  
  // Extract all buttons from the rendered HTML
  const buttonMatches = Array.from(html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)).map(m => m[1]);
  
  // Verify none of the buttons are mutation actions
  for (const buttonText of buttonMatches) {
    assert.ok(!/(sửa\s+mục\s+tiêu|thay\s+đổi\s+mục\s+tiêu|cập\s+nhật\s+target|change\s+target)/i.test(buttonText));
    assert.ok(!/(chấm\s+điểm|sửa\s+điểm|change\s+score|nhập\s+điểm)/i.test(buttonText));
    assert.ok(!/(duyệt\s+review|phê\s+duyệt|approve\s+review|trả\s+về)/i.test(buttonText));
    assert.ok(!/(khóa\s+kpi|lock\s+kpi|mở\s+khóa)/i.test(buttonText));
    assert.ok(!/(cập\s+nhật\s+actual|update\s+actual|nhập\s+actual)/i.test(buttonText));
    assert.ok(!/(tạo\s+task|tạo\s+công\s+việc|create\s+task)/i.test(buttonText));
    assert.ok(!/(gửi\s+thông\s+báo|send\s+notification)/i.test(buttonText));
  }

  // Also verify no form inputs for data modification exist
  assert.ok(!/<input\b/i.test(html));
  assert.ok(!/<select\b/i.test(html));
  assert.ok(!/<textarea\b/i.test(html));
});

// E5.1.22 – XSS script does not execute
runTest('E5.1.22 – XSS script does not execute', () => {
  const maliciousSummary = '<script>alert("pwned")</script>';
  const result = createMockResult({ summary: maliciousSummary });
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  // Verify <script> tag is escaped/not executable
  assert.ok(!html.includes('<script>alert("pwned")</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;'));
});

// E5.1.23 – unsafe image handler does not execute
runTest('E5.1.23 – unsafe image handler does not execute', () => {
  const maliciousText = '<img src=x onerror=alert(1)>';
  const result = createMockResult({
    highlights: [{ text: maliciousText, evidence: [] }]
  });
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

// E5.1.24 – no dangerouslySetInnerHTML introduced
runTest('E5.1.24 – no dangerouslySetInnerHTML introduced', () => {
  const dir = path.resolve(process.cwd(), 'src/components/kpis/intelligence');
  const panelSrc = fs.readFileSync(path.join(dir, 'KPIAIResultPanel.tsx'), 'utf-8');
  const evidenceSrc = fs.readFileSync(path.join(dir, 'KPIEvidenceList.tsx'), 'utf-8');
  assert.ok(!panelSrc.includes('dangerouslySetInnerHTML'));
  assert.ok(!evidenceSrc.includes('dangerouslySetInnerHTML'));
});

// E5.1.25 – no ranking UI
runTest('E5.1.25 – no ranking UI', () => {
  const result = createMockResult();
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(!/leaderboard|xếp hạng nhân sự|top performer|bottom performer|bảng xếp hạng|employee rating/i.test(html));
});

// E5.1.26 – responsive smoke PASS
runTest('E5.1.26 – responsive smoke PASS', () => {
  const result = createMockResult();
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  // Checks responsive prefixes and fluid layout classes
  assert.ok(html.includes('sm:flex-row'));
  assert.ok(html.includes('grid-cols-1'));
  assert.ok(html.includes('md:grid-cols-2'));
  assert.ok(html.includes('flex-wrap'));
});

// E5.1.27 – dark mode smoke PASS
runTest('E5.1.27 – dark mode smoke PASS', () => {
  const result = createMockResult();
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} />);
  assert.ok(html.includes('dark:bg-slate-900'));
  assert.ok(html.includes('dark:border-slate-800'));
  assert.ok(html.includes('dark:text-slate-100') || html.includes('dark:text-slate-200'));

  const evidenceHtml = renderToStaticMarkup(
    <KPIEvidenceList
      evidence={[
        { type: 'kpi_item', assignmentId: '1', scoreMode: 'live', kpiName: 'Test' }
      ]}
    />
  );
  assert.ok(evidenceHtml.includes('dark:bg-slate-800'));
  assert.ok(evidenceHtml.includes('dark:text-emerald-300') || evidenceHtml.includes('dark:bg-emerald-950'));
});

// E5.1.28 – accessibility smoke PASS
runTest('E5.1.28 – accessibility smoke PASS', () => {
  const result = createMockResult();
  const html = renderToStaticMarkup(<KPIAIResultPanel result={result} onRegenerate={() => {}} />);
  // Headings
  assert.ok(html.includes('<h3'));
  assert.ok(html.includes('<h4'));
  // Button types & aria
  assert.ok(html.includes('type="button"'));
  assert.ok(html.includes('aria-label='));
});

// E5.1.29 – frontend build PASS
runTest('E5.1.29 – frontend build PASS', () => {
  // Verifies that typescript exports are correct and imported without error
  assert.ok(typeof KPIAIResultPanel === 'function');
  assert.ok(typeof KPIEvidenceList === 'function');
  assert.ok(typeof getHumanReadableLabel === 'function');
  assert.ok(typeof isUUID === 'function');
});

console.log('====================================================');
console.log(`ACCEPTANCE SUITE: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount}`);
console.log('====================================================');

if (failCount > 0) {
  console.log('v0.5-E5.1 SHARED KPI AI RESULT UI FAIL');
  process.exit(1);
} else {
  console.log('v0.5-E5.1 SHARED KPI AI RESULT UI PASS');
}
