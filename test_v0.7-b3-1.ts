import fs from 'fs';
import path from 'path';

async function runB31SelfTest() {
  console.log('Running v0.7-B3.1 Self-Test: Staff Operational Charts...');

  let failures = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // 1. File existence checks
  const viewPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'StaffDashboardView.tsx');
  const docPath = path.join(process.cwd(), 'docs', 'v0.7-b3-1-staff-operational-charts.md');

  assert(fs.existsSync(viewPath), 'StaffDashboardView.tsx exists');
  assert(fs.existsSync(docPath), 'v0.7-B3.1 documentation exists');

  const viewContent = fs.readFileSync(viewPath, 'utf-8');

  // 2. Task Chart Requirements
  assert(viewContent.includes('Phân bổ công việc'), 'Task chart section title present');
  assert(viewContent.includes('BarChart'), 'Recharts BarChart used for task distribution');
  assert(viewContent.includes('completed_tasks') && viewContent.includes('in_progress_tasks') && viewContent.includes('not_started_tasks'), 'Mutually exclusive task statuses mapped');
  assert(!viewContent.includes('PieChart') && !viewContent.includes('DonutChart'), 'No pie or donut charts used for overlapping categories');
  assert(!viewContent.includes('due_soon'), 'Due-soon data absent from task chart');

  // 3. Daily Report Chart Requirements
  assert(viewContent.includes('Tiến độ báo cáo hằng ngày'), 'Daily report chart section title present');
  assert(viewContent.includes('LineChart'), 'Recharts LineChart used for daily report trend');
  assert(viewContent.includes('reports_by_date') || viewContent.includes('daily_reports'), 'Daily report series data used');
  assert(viewContent.includes('localeCompare'), 'Chronological sorting preserved');

  // 4. Accessibility & Responsive Requirements
  assert(viewContent.includes('ResponsiveContainer'), 'ResponsiveContainer used for fluid sizing');
  assert(viewContent.includes('aria-label'), 'Accessible aria labels present on charts');

  // 5. Scope & Regression Checks
  const migrations = fs.readdirSync(path.join(process.cwd(), 'migrations'));
  const b31Migrations = migrations.filter(m => m.includes('v0.7-b3') || m.includes('v0.7_b3'));
  assert(b31Migrations.length === 0, 'No database migration added for v0.7-B3.1');

  const componentsDir = path.join(process.cwd(), 'src', 'components', 'dashboard');
  const dashboardComponents = fs.readdirSync(componentsDir);
  const unauthorized = dashboardComponents.filter(c => 
    c.toLowerCase().includes('dashboard') && 
    !c.toLowerCase().includes('staff') &&
    !c.toLowerCase().includes('executive') &&
    !c.toLowerCase().includes('manager') &&
    !c.toLowerCase().includes('dashboardview')
  );
  assert(unauthorized.length === 0, `No unauthorized admin/manager dashboards added: ${unauthorized.join(', ')}`);

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-B3.1 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-B3.1 Self-Test completed successfully.');
    process.exit(0);
  }
}

runB31SelfTest();
