/**
 * Self-Test Script for v0.7-C4.3 – Missing Daily Report Detail
 */

import { dashboardApiClient } from './services/dashboardApiClient';
import { teamMonitoringService } from './services/teamMonitoringService';

async function runTest() {
  console.log('[Test v0.7-C4.3] Starting Missing Daily Report Detail tests...');

  // Verify dashboardApiClient methods exist
  if (typeof dashboardApiClient.getMissingReportsDetail !== 'function') {
    throw new Error('dashboardApiClient.getMissingReportsDetail is not defined');
  }

  // Verify teamMonitoringService methods exist
  if (typeof teamMonitoringService.getMissingReportsDetail !== 'function') {
    throw new Error('teamMonitoringService.getMissingReportsDetail is not defined');
  }

  console.log('[Test v0.7-C4.3] All client & service checks passed successfully.');
}

runTest().catch((err) => {
  console.error('[Test v0.7-C4.3] Test failed:', err);
  process.exit(1);
});
