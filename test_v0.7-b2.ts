import fs from 'fs';
import path from 'path';

async function runB2SelfTest() {
  console.log('Running v0.7-B2 Self-Test: Staff Dashboard Summary Cards...');

  let failures = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // 1. Test File Existence for Staff Summary Cards
  const viewPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'StaffDashboardView.tsx');
  const docPath = path.join(process.cwd(), 'docs', 'v0.7-b2-staff-summary-cards.md');

  assert(fs.existsSync(viewPath), 'StaffDashboardView.tsx exists');
  assert(fs.existsSync(docPath), 'v0.7-B2 documentation exists');

  const viewContent = fs.readFileSync(viewPath, 'utf-8');

  // 2. Test Task Cards Requirements
  assert(viewContent.includes('Tổng công việc') || viewContent.includes('total_tasks'), 'Task cards mapped');
  assert(viewContent.includes('Đã hoàn thành'), 'Completed task card present');
  assert(viewContent.includes('Đang thực hiện'), 'In-progress task card present');
  assert(viewContent.includes('Quá hạn'), 'Overdue task card present');
  assert(viewContent.includes('Tỷ lệ hoàn thành'), 'Completion rate card present');
  assert(!viewContent.includes('Sắp đến hạn'), 'Due-soon card is absent');

  // 3. Test Daily Report Cards Requirements
  assert(viewContent.includes('Ngày cần báo cáo') || viewContent.includes('expected_reporting_days'), 'Expected reporting days mapped');
  assert(viewContent.includes('Ngày đã báo cáo') || viewContent.includes('submitted_reports'), 'Submitted reporting days mapped');
  assert(viewContent.includes('Ngày còn thiếu') || viewContent.includes('missing_reports'), 'Missing reporting days mapped');
  assert(!viewContent.includes('70%'), 'No arbitrary 70% warning threshold exists');

  // 4. Test KPI Cards Requirements
  assert(viewContent.includes('KPI được giao') || viewContent.includes('assignment_count'), 'Assigned KPI mapped');
  assert(viewContent.includes('KPI đạt') || viewContent.includes('achieved_kpi_count'), 'Achieved KPI mapped');
  assert(viewContent.includes('Chờ đánh giá') || viewContent.includes('pending_review_count'), 'Pending review mapped');
  assert(viewContent.includes('Điểm tổng hợp') || viewContent.includes('weighted_score'), 'Weighted score mapped');
  assert(!viewContent.includes('Có nguy cơ'), 'At-risk KPI card is absent');
  assert(!viewContent.includes('KPI quá hạn'), 'KPI overdue card is absent');

  // 5. Test Attention Cards Requirements
  assert(viewContent.includes('Thông báo chưa đọc') || viewContent.includes('unread_notifications'), 'Unread notifications mapped');
  assert(viewContent.includes('Cần xác nhận') || viewContent.includes('required_announcements_pending_acknowledgement'), 'Pending acknowledgement mapped');
  assert(viewContent.includes('Chưa xem') || viewContent.includes('announcements_not_viewed'), 'Not viewed mapped');
  assert(viewContent.includes('Tổng cần chú ý') || viewContent.includes('pending_attention_total'), 'Total attention mapped');

  // 6. Test Formatting & Safety Requirements
  assert(viewContent.includes('Chưa có dữ liệu'), 'Unavailable data rendered consistently as "Chưa có dữ liệu"');
  assert(viewContent.includes('SummaryCard'), 'Reusable SummaryCard component used');

  // 7. Regression & Scope Checks
  const migrations = fs.readdirSync(path.join(process.cwd(), 'migrations'));
  const b2Migrations = migrations.filter(m => m.includes('v0.7-b2') || m.includes('v0.7_b2'));
  assert(b2Migrations.length === 0, 'No database migration added for v0.7-B2');

  const componentsDir = path.join(process.cwd(), 'src', 'components', 'dashboard');
  const dashboardComponents = fs.readdirSync(componentsDir);
  const unauthorized = dashboardComponents.filter(c => 
    c.toLowerCase().includes('dashboard') && 
    !c.toLowerCase().includes('staff') &&
    !c.toLowerCase().includes('executive') &&
    !c.toLowerCase().includes('manager') &&
    !c.toLowerCase().includes('dashboardview')
  );
  assert(unauthorized.length === 0, `No unauthorized admin/manager dashboards added in components: ${unauthorized.join(', ')}`);

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-B2 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-B2 Self-Test completed successfully.');
    process.exit(0);
  }
}

runB2SelfTest();
