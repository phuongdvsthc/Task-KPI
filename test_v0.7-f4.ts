/**
 * v0.7-F4 Automated Acceptance Test Suite
 * Manager Dashboard Redesign Audit
 */

import fs from 'fs';
import path from 'path';

console.log('=== STARTING v0.7-F4 MANAGER DASHBOARD REDESIGN AUDIT ===');

let passed = 0;
let failed = 0;

const assert = function(condition: boolean, category: string, description: string, details?: string) {
  if (condition) {
    passed++;
    console.log(`[PASS] [${category}] ${description}`);
  } else {
    failed++;
    console.error(`[FAIL] [${category}] ${description}${details ? ` - ${details}` : ''}`);
  }
};

// 1. Check documentation
const docPath = path.join(process.cwd(), 'docs', 'v0.7-f4-manager-dashboard-redesign.md');
assert(fs.existsSync(docPath), 'DOC_AUDIT', 'v0.7-F4 acceptance document exists');

// 2. Check ManagerDashboardView.tsx existence and content
const managerViewPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'ManagerDashboardView.tsx');
assert(fs.existsSync(managerViewPath), 'COMPONENT_AUDIT', 'ManagerDashboardView.tsx exists');

const managerContent = fs.readFileSync(managerViewPath, 'utf-8');
assert(managerContent.includes('Tổng quan đơn vị'), 'COMPONENT_AUDIT', 'Header displays "Tổng quan đơn vị" title');
assert(managerContent.includes('Cần chú ý'), 'COMPONENT_AUDIT', 'Attention section exists');
assert(managerContent.includes('Theo dõi nhân viên'), 'COMPONENT_AUDIT', 'Team monitoring section exists');
assert(!managerContent.includes('Supabase status'), 'PURITY_AUDIT', 'No technical database health on Manager Dashboard');

console.log(`\n=== v0.7-F4 AUDIT SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed} ===`);
if (failed > 0) {
  console.error('>>> SOME F4 CHECKS FAILED <<<');
  process.exit(1);
} else {
  console.log('>>> ALL v0.7-F4 MANAGER DASHBOARD CHECKS PASSED (EXIT CODE 0) <<<');
}
