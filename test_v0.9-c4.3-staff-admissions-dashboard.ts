import dotenv from 'dotenv';
dotenv.config();

async function runTest() {
  console.log('====================================================');
  console.log('HOTFIX v0.9-C4.3 VERIFICATION: Staff Admissions Dashboard');
  console.log('====================================================\n');

  // 1. Authenticate Staff via real backend login endpoint
  console.log('Step 1: Authenticating Staff account (phuongdv@sthc.edu.vn)...');
  const staffLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'phuongdv@sthc.edu.vn', password: 'STHC@123456' })
  });
  if (!staffLoginRes.ok) {
    throw new Error(`Staff login failed: ${staffLoginRes.status}`);
  }
  const staffLogin = await staffLoginRes.json();
  const staffToken = staffLogin.session?.access_token || staffLogin.access_token;
  console.log('Staff authenticated successfully. Token length:', staffToken.length);

  // 2. Authenticate Admin via real backend login endpoint
  console.log('\nStep 2: Authenticating Admin account (admin@sthc.edu.vn)...');
  const adminLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sthc.edu.vn', password: 'STHC@123456' })
  });
  if (!adminLoginRes.ok) {
    throw new Error(`Admin login failed: ${adminLoginRes.status}`);
  }
  const adminLogin = await adminLoginRes.json();
  const adminToken = adminLogin.session?.access_token || adminLogin.access_token;
  console.log('Admin authenticated successfully. Token length:', adminToken.length);

  // 3. Verify Staff permissions via /api/access/me
  console.log('\nStep 3: Checking effective permissions for Staff via /api/access/me...');
  const staffMeRes = await fetch('http://localhost:3000/api/access/me', {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  const staffMe = await staffMeRes.json();
  console.log('Staff system_role:', staffMe.system_role);
  console.log('Staff roles:', staffMe.roles);
  const admViewScope = staffMe.permissions?.['admissions.view'];
  console.log('Staff admissions.view scope:', admViewScope);
  if (admViewScope !== 'all') {
    throw new Error(`Staff does not have capability admissions.view with scope all! Got: ${admViewScope}`);
  }

  // 4. Query Admissions Dashboard with Staff JWT
  console.log('\nStep 4: Calling GET /api/admissions/dashboard with Staff JWT (year 2026)...');
  const staffDashRes = await fetch('http://localhost:3000/api/admissions/dashboard?year=2026', {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  console.log('Staff HTTP status:', staffDashRes.status);
  if (!staffDashRes.ok) {
    const err = await staffDashRes.text();
    throw new Error(`Staff dashboard call failed: ${staffDashRes.status} - ${err}`);
  }
  const staffData = await staffDashRes.json();
  console.log('Staff Dashboard KPIs:');
  console.log('  - annualPlan:', staffData.kpis?.annualPlan);
  console.log('  - allocatedPlan:', staffData.kpis?.allocatedPlan);
  console.log('  - registeredCount:', staffData.kpis?.registeredCount);
  console.log('  - paidCount:', staffData.kpis?.paidCount);
  console.log('  - conversionRate:', staffData.kpis?.conversionRate + '%');
  console.log('  - fulfillmentRate:', staffData.kpis?.fulfillmentRate + '%');
  console.log('  - Group performance count:', staffData.groupPerformance?.length);
  console.log('  - Campaign progress count:', staffData.campaignProgress?.length);
  console.log('  - Program items count:', staffData.programItems?.length);

  // 5. Query Admissions Dashboard with Admin JWT for side-by-side parity check
  console.log('\nStep 5: Calling GET /api/admissions/dashboard with Admin JWT (year 2026)...');
  const adminDashRes = await fetch('http://localhost:3000/api/admissions/dashboard?year=2026', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('Admin HTTP status:', adminDashRes.status);
  const adminData = await adminDashRes.json();
  console.log('Admin Dashboard KPIs:');
  console.log('  - annualPlan:', adminData.kpis?.annualPlan);
  console.log('  - allocatedPlan:', adminData.kpis?.allocatedPlan);
  console.log('  - registeredCount:', adminData.kpis?.registeredCount);
  console.log('  - paidCount:', adminData.kpis?.paidCount);
  console.log('  - conversionRate:', adminData.kpis?.conversionRate + '%');
  console.log('  - fulfillmentRate:', adminData.kpis?.fulfillmentRate + '%');

  // Assert non-zero values for Staff
  if (staffData.kpis.annualPlan === 0 || staffData.kpis.paidCount === 0) {
    throw new Error('FAIL: Staff still sees all zeros!');
  }

  // Assert exact parity with Admin
  if (
    staffData.kpis.annualPlan !== adminData.kpis.annualPlan ||
    staffData.kpis.allocatedPlan !== adminData.kpis.allocatedPlan ||
    staffData.kpis.registeredCount !== adminData.kpis.registeredCount ||
    staffData.kpis.paidCount !== adminData.kpis.paidCount ||
    staffData.kpis.conversionRate !== adminData.kpis.conversionRate ||
    staffData.kpis.fulfillmentRate !== adminData.kpis.fulfillmentRate
  ) {
    throw new Error('FAIL: Staff KPIs do not match Admin KPIs!');
  }
  console.log('PASS: Staff and Admin see IDENTICAL data values!');

  // 6. Security verification: Verify Staff is blocked from unauthorized actions
  console.log('\nStep 6: Verifying Security Controls for Staff...');

  // 6a. Attempt to access Google Sheets config
  console.log('Testing Staff access to GET /api/admissions/google-sheets/config:');
  const sheetsRes = await fetch('http://localhost:3000/api/admissions/google-sheets/config', {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  console.log('Staff Sheets config response status:', sheetsRes.status);
  if (sheetsRes.status !== 403) {
    throw new Error(`Security breach: Staff should receive 403, got ${sheetsRes.status}`);
  }

  // 6b. Attempt to finalize admission result
  console.log('Testing Staff access to POST /api/admissions/results/:id/finalize:');
  const finalizeRes = await fetch('http://localhost:3000/api/admissions/results/dummy-id/finalize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  console.log('Staff Finalize result response status:', finalizeRes.status);
  if (finalizeRes.status !== 403) {
    throw new Error(`Security breach: Staff should receive 403, got ${finalizeRes.status}`);
  }

  // 6c. Attempt unauthenticated request
  console.log('Testing Unauthenticated access to GET /api/admissions/dashboard:');
  const unauthRes = await fetch('http://localhost:3000/api/admissions/dashboard?year=2026');
  console.log('Unauthenticated response status:', unauthRes.status);
  if (unauthRes.status !== 401) {
    throw new Error(`Security breach: Unauthenticated request should receive 401, got ${unauthRes.status}`);
  }

  console.log('\n====================================================');
  console.log('HOTFIX v0.9-C4.3: ALL CHECKS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runTest().catch((err) => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
