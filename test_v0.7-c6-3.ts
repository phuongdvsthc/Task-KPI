/**
 * Automated Self-Test for v0.7-C6.3: Missing Report Reminder UI & Delivery Feedback
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Self-Test v0.7-C6.3] Starting Missing Report Reminder UI & Delivery Feedback tests...');

  // 1. Verify documentation exists
  const docPath = path.join(process.cwd(), 'docs/v0.7-c6-3-reminder-ui-feedback.md');
  assert.ok(fs.existsSync(docPath), 'v0.7-C6.3 documentation file must exist');
  console.log('  [PASS] v0.7-C6.3 documentation exists');

  // 2. Verify component files exist
  const reminderModalPath = path.join(process.cwd(), 'src/components/dashboard/MissingReportReminderModal.tsx');
  assert.ok(fs.existsSync(reminderModalPath), 'MissingReportReminderModal.tsx must exist');

  const missingModalPath = path.join(process.cwd(), 'src/components/dashboard/MissingReportsModal.tsx');
  assert.ok(fs.existsSync(missingModalPath), 'MissingReportsModal.tsx must exist');

  const managerViewPath = path.join(process.cwd(), 'src/components/dashboard/ManagerDashboardView.tsx');
  assert.ok(fs.existsSync(managerViewPath), 'ManagerDashboardView.tsx must exist');

  const apiClientPath = path.join(process.cwd(), 'src/services/dashboardApiClient.ts');
  assert.ok(fs.existsSync(apiClientPath), 'dashboardApiClient.ts must exist');

  const reminderModalContent = fs.readFileSync(reminderModalPath, 'utf8');
  assert.ok(reminderModalContent.includes('Xác nhận gửi nhắc báo cáo'), 'Reminder modal must contain confirmation title');
  assert.ok(reminderModalContent.includes('Gửi nhắc'), 'Reminder modal must contain Gửi nhắc action');
  assert.ok(reminderModalContent.includes('Đang gửi'), 'Reminder modal must contain in-progress state');
  assert.ok(reminderModalContent.includes('idempotency_key'), 'Reminder modal must use idempotency key');

  const apiClientContent = fs.readFileSync(apiClientPath, 'utf8');
  assert.ok(apiClientContent.includes('sendMissingReportReminder'), 'API client must define sendMissingReportReminder');
  assert.ok(apiClientContent.includes('/api/dashboard/team-monitoring/missing-report-reminder'), 'API client must call correct endpoint');

  const managerViewContent = fs.readFileSync(managerViewPath, 'utf8');
  assert.ok(managerViewContent.includes('MissingReportReminderModal'), 'ManagerDashboardView must render MissingReportReminderModal');
  assert.ok(managerViewContent.includes('Gửi nhắc'), 'ManagerDashboardView must render Gửi nhắc button');

  console.log('  [PASS] All C6.3 UI components, API client, and integration points verified successfully');

  console.log('[Self-Test v0.7-C6.3] All Missing Report Reminder UI & Delivery Feedback tests passed successfully.');
}

runTest().catch((err) => {
  console.error('[Self-Test v0.7-C6.3] Test failed:', err);
  process.exit(1);
});
