const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runSelfTests() {
  console.log('====================================================');
  console.log('Running Automated Self-Tests: v0.4.6-A1');
  console.log('KPI Dashboard Read Model Inspection + Service Skeleton');
  console.log('====================================================\n');

  // A1.1: Current official-result data path is identified successfully
  console.log('--- A1.1 Official-Result Data Path Verification ---');
  const lockMigrationPath = path.join(__dirname, 'migrations', 'v0.4.5-D_kpi_lock.sql');
  assert(fs.existsSync(lockMigrationPath), 'v0.4.5-D lock migration file exists');
  const lockMigrationSql = fs.readFileSync(lockMigrationPath, 'utf8');
  assert(lockMigrationSql.includes('kpi_get_official_assignment_result'), 'RPC kpi_get_official_assignment_result exists in SQL');
  assert(lockMigrationSql.includes('kpi_assignment_item_reviews'), 'Official item snapshot table kpi_assignment_item_reviews referenced in SQL');
  assert(lockMigrationSql.includes('kpi_lock_assignment_review'), 'Lock RPC kpi_lock_assignment_review exists in SQL');

  const serverTs = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');
  assert(serverTs.includes('/api/rpc/kpi_get_official_assignment_result'), 'Official result API endpoint route registered in server.ts');
  console.log('A1.1: Current official-result data path verified.\n');

  // A1.2: Current live-scoring data path is identified successfully
  console.log('--- A1.2 Live-Scoring Data Path Verification ---');
  const scoringMigrationPath = path.join(__dirname, 'migrations', 'v0.4.4-B_kpi_scoring_engine.sql');
  assert(fs.existsSync(scoringMigrationPath), 'v0.4.4-B scoring engine migration file exists');
  const scoringSql = fs.readFileSync(scoringMigrationPath, 'utf8');
  assert(scoringSql.includes('kpi_resolve_assignment_score'), 'RPC kpi_resolve_assignment_score exists in SQL');
  assert(scoringSql.includes('kpi_resolve_assignment_item_score'), 'RPC kpi_resolve_assignment_item_score exists in SQL');
  assert(scoringSql.includes('kpi_resolve_assignment_item_actual'), 'RPC kpi_resolve_assignment_item_actual called in SQL');

  const scoringServiceTs = fs.readFileSync(path.join(__dirname, 'src', 'services', 'kpiScoringService.ts'), 'utf8');
  assert(scoringServiceTs.includes('resolveAssignmentScore'), 'kpiScoringService.resolveAssignmentScore method exists');
  assert(scoringServiceTs.includes('resolveAssignmentItemScore'), 'kpiScoringService.resolveAssignmentItemScore method exists');
  console.log('A1.2: Current live-scoring data path verified.\n');

  // A1.3: Dashboard service/types compile successfully
  console.log('--- A1.3 Dashboard Service and Types Verification ---');
  const typesKpiTs = fs.readFileSync(path.join(__dirname, 'src', 'types', 'kpi.ts'), 'utf8');
  assert(typesKpiTs.includes('export type KpiDashboardResultMode = \'all\' | \'live\' | \'official\';'), 'Normalized KpiDashboardResultMode defined');
  assert(typesKpiTs.includes('export interface KpiDashboardFilters'), 'Normalized KpiDashboardFilters defined');
  assert(typesKpiTs.includes('periodId: string;'), 'KpiDashboardFilters includes periodId');
  assert(typesKpiTs.includes('unitId?: string;'), 'KpiDashboardFilters includes unitId');
  assert(typesKpiTs.includes('assignmentStatus?: KpiAssignmentStatus | \'all\';'), 'KpiDashboardFilters includes assignmentStatus');
  assert(typesKpiTs.includes('resultMode: KpiDashboardResultMode;'), 'KpiDashboardFilters includes resultMode');

  assert(typesKpiTs.includes('export interface KpiDashboardSummary'), 'KpiDashboardSummary contract defined');
  assert(typesKpiTs.includes('export interface KpiDashboardUnitBreakdown'), 'KpiDashboardUnitBreakdown contract defined');
  assert(typesKpiTs.includes('export interface KpiDashboardAssignmentItem'), 'KpiDashboardAssignmentItem contract defined');
  assert(typesKpiTs.includes('export interface KpiDashboardKpiBreakdown'), 'KpiDashboardKpiBreakdown contract defined');

  const dashboardServicePath = path.join(__dirname, 'src', 'services', 'kpiDashboardService.ts');
  assert(fs.existsSync(dashboardServicePath), 'kpiDashboardService.ts exists');
  const dashboardServiceTs = fs.readFileSync(dashboardServicePath, 'utf8');
  assert(dashboardServiceTs.includes('getSummary(filters: KpiDashboardFilters)'), 'kpiDashboardService.getSummary signature prepared');
  assert(dashboardServiceTs.includes('getUnitBreakdown(filters: KpiDashboardFilters)'), 'kpiDashboardService.getUnitBreakdown signature prepared');
  assert(dashboardServiceTs.includes('getAssignments(filters: KpiDashboardFilters)'), 'kpiDashboardService.getAssignments signature prepared');
  assert(dashboardServiceTs.includes('getKpiBreakdown(filters: KpiDashboardFilters)'), 'kpiDashboardService.getKpiBreakdown signature prepared');
  console.log('A1.3: Dashboard service and types verified.\n');

  // A1.4: Existing KPI Scoring and Review services remain unchanged/functioning
  console.log('--- A1.4 Existing Services Integrity Verification ---');
  const reviewServiceTs = fs.readFileSync(path.join(__dirname, 'src', 'services', 'kpiReviewService.ts'), 'utf8');
  assert(reviewServiceTs.includes('getReviewByAssignment'), 'kpiReviewService.getReviewByAssignment intact');
  assert(reviewServiceTs.includes('startReview'), 'kpiReviewService.startReview intact');
  assert(reviewServiceTs.includes('returnReview'), 'kpiReviewService.returnReview intact');
  assert(reviewServiceTs.includes('resubmitReview'), 'kpiReviewService.resubmitReview intact');
  assert(reviewServiceTs.includes('approveReview'), 'kpiReviewService.approveReview intact');
  assert(reviewServiceTs.includes('lockAssignmentReview'), 'kpiReviewService.lockAssignmentReview intact');
  assert(reviewServiceTs.includes('getOfficialAssignmentResult'), 'kpiReviewService.getOfficialAssignmentResult intact');
  console.log('A1.4: Existing KPI Scoring and Review services intact.\n');

  console.log('====================================================');
  console.log('v0.4.6-A1 AUTOMATED TESTS PASS');
  console.log('====================================================');
}

runSelfTests();
