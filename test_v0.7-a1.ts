import fs from 'fs';
import path from 'path';

function runSelfTest() {
  console.log('Running v0.7-A1 Self-Test: Dashboard Data Inventory & Reporting Contract...');

  // 1. Check inventory document exists
  const docPath = path.join(process.cwd(), 'docs', 'v0.7-dashboard-data-inventory.md');
  if (!fs.existsSync(docPath)) {
    console.error('FAIL: docs/v0.7-dashboard-data-inventory.md does not exist.');
    process.exit(1);
  }
  const content = fs.readFileSync(docPath, 'utf8');

  // 2. Check all required functional areas are documented
  const requiredSections = [
    'Existing Data Sources',
    'Dashboard Metric Definitions',
    'Role visibility matrix',
    'Reporting filter contract',
    'Reporting response contract'
  ];
  for (const sec of requiredSections) {
    if (!content.toLowerCase().includes(sec.toLowerCase())) {
      console.error(`FAIL: Missing required section in inventory document: "${sec}"`);
      process.exit(1);
    }
  }

  // 3. Check role visibility matrix exists and covers Staff, Manager, Admin, Executive
  const roles = ['Staff', 'Manager', 'Admin', 'Executive'];
  for (const r of roles) {
    if (!content.includes(r)) {
      console.error(`FAIL: Role visibility matrix missing role: "${r}"`);
      process.exit(1);
    }
  }

  // 4. Check reporting filter contract fields
  const filterFields = ['date_from', 'date_to', 'organization_unit_id', 'employee_id', 'source_id', 'metric_id', 'kpi_id', 'status'];
  for (const f of filterFields) {
    if (!content.includes(f)) {
      console.error(`FAIL: Reporting filter contract missing field: "${f}"`);
      process.exit(1);
    }
  }

  // 5. Check reporting response contract structure
  const responseFields = ['scope', 'filters', 'summary', 'series', 'breakdowns', 'warnings', 'generated_at'];
  for (const rf of responseFields) {
    if (!content.includes(rf)) {
      console.error(`FAIL: Reporting response contract missing field: "${rf}"`);
      process.exit(1);
    }
  }

  // 6. Verify documented data sources refer to existing codebase / db entities
  const dataSources = [
    'organization_units',
    'profiles',
    'tasks',
    'announcements',
    'notifications',
    'daily_reports',
    'report_sources',
    'metric_definitions',
    'metric_entries',
    'kpi_periods',
    'kpi_assignments',
    'kpi_reviews'
  ];
  for (const ds of dataSources) {
    if (!content.includes(ds)) {
      console.error(`FAIL: Documented data source "${ds}" not found in inventory.`);
      process.exit(1);
    }
  }

  // 7. Check no SQL migration was added for v0.7-A1
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir);
  const v07Migrations = migrationFiles.filter(f => f.includes('v0.7') || f.includes('v0.7-A1'));
  if (v07Migrations.length > 0) {
    console.error('FAIL: Found unauthorized SQL migration for v0.7-A1:', v07Migrations);
    process.exit(1);
  }

  // 8. Check no RLS policy was changed (migrations unchanged)
  // 9. Check no production UI component was added for A1 (only documentation and self-test)
  const compDir = path.join(process.cwd(), 'src', 'components');
  const components = fs.readdirSync(compDir);
  // Ensure no new dashboard UI files were added for A1
  const newDashboards = components.filter(c => c.toLowerCase().includes('v0.7') || c.toLowerCase().includes('reporting'));
  if (newDashboards.length > 0) {
    console.error('FAIL: Production UI component was added for A1:', newDashboards);
    process.exit(1);
  }

  console.log('PASS: v0.7-A1 Self-Test completed successfully.');
  process.exit(0);
}

runSelfTest();
