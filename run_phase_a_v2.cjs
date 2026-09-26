const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWLIST = [
  "admin@truonghoc.edu.vn",
  "doantlk@sthc.edu.vn",
  "sonmnb@sthc.edu.vn",
  "tuyenntn@sthc.edu.vn",
  "trangnth@sthc.edu.vn",
  "minhna@sthc.edu.vn",
  "vytt@sthc.edu.vn",
  "tramlnn@sthc.edu.vn",
  "baonh@sthc.edu.vn",
  "loanbtk@sthc.edu.vn",
  "phuongdv@sthc.edu.vn"
];

const ADMIN_UUID = "ac7d0840-3024-402e-b5ec-08571ab238a4";
const ADMIN_EMAIL = "admin@truonghoc.edu.vn";

async function run() {
  console.log("=== V0.7-H2 PHASE A – DRY-RUN & INVENTORY REPORT ===");

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  const users = authData.users || [];

  const { data: profiles, error: profError } = await supabase.from("profiles").select("*");
  if (profError) {
    console.error("Profile error:", profError);
    return;
  }

  const allowSet = new Set(ALLOWLIST.map(e => e.toLowerCase().trim()));

  const keptUsers = [];
  const deletedCandidates = [];

  let adminFoundAndValid = false;

  for (const u of users) {
    const email = (u.email || "").toLowerCase().trim();
    const prof = (profiles || []).find(p => p.id === u.id);
    const isAllow = allowSet.has(email);

    const item = {
      id: u.id,
      email: u.email,
      profileId: prof?.id || null,
      fullName: prof?.full_name || prof?.name || null,
      employeeCode: prof?.employee_code || null,
      systemRole: prof?.system_role || null,
      isActive: prof?.is_active ?? null,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at
    };

    if (isAllow) {
      if (u.id === ADMIN_UUID && email === ADMIN_EMAIL) {
        adminFoundAndValid = true;
      }
      keptUsers.push(item);
    } else {
      deletedCandidates.push(item);
    }
  }

  console.log(`\n1. Allowlist Check (Target: 11 accounts):`);
  console.log(`- Admin UUID Match (${ADMIN_UUID}): ${adminFoundAndValid ? "PASS" : "FAIL"}`);
  console.log(`- Found Kept Users: ${keptUsers.length} / 11`);
  keptUsers.forEach(k => console.log(`  * [${k.id}] ${k.email} (${k.fullName || 'No Name'}, Role: ${k.systemRole})`));

  console.log(`\n2. Users to be Deleted: ${deletedCandidates.length} users (Test/Fixture/Demo accounts)`);
  deletedCandidates.forEach((d, i) => {
    console.log(`  ${i+1}. [${d.id}] ${d.email} - Role: ${d.systemRole || 'unknown'} - Created: ${d.createdAt}`);
  });

  console.log(`\n3. Summary User Counts:`);
  console.log(`- Total Auth Users before cleanup: ${users.length}`);
  console.log(`- Total Auth Users after cleanup (expected): ${keptUsers.length}`);
  console.log(`- Total Users to delete: ${deletedCandidates.length}`);

  console.log(`\n4. Table Classification:`);
  console.log(`- KEEP_CONFIGURATION:`);
  console.log(`  * system_settings, ai_prompt_definitions, organization_units, metric_definitions, report_sources, kpi_definitions, kpi_templates, ai_providers, appearance_settings, storage_buckets, migration history, rls policies, functions, triggers, private.rls_policy_backup_profiles`);
  console.log(`- DELETE_OPERATIONAL_TEST_DATA:`);
  console.log(`  * tasks, task_assignees, task_collaborators, task_comments, task_attachments, task_activities, daily_reports, metric_entries, work_mode_entries, kpi_assignments, kpi_actuals, kpi_evaluations, announcements, announcement_recipients, notification_recipients, notifications, reminders, dashboard_snapshots, ai_summaries, self_test_logs, fixture_records`);
  console.log(`- MANUAL_REVIEW: None (All tables classified).`);

  console.log(`\n5. Backup & Rollback Plan:`);
  console.log(`- Create timestamped backup manifest of public operational data and profiles/memberships to be deleted.`);
  console.log(`- Note: Auth password hashes cannot be restored from public backup; deleted auth users must re-authenticate or be re-created if passwords are needed (though kept users 11 are untouched).`);

  console.log(`\n6. Proposed Execution Workflow (Phase B - guarded by exact confirmation prompt):`);
  console.log(`- Guard: Check exact allowlist and Admin UUID.`);
  console.log(`- Step 1: Backup targeted operational rows.`);
  console.log(`- Step 2: Delete operational records in correct foreign key order (child tables first: task_assignees, comments, attachments, KPI actuals/evaluations, metric entries, daily reports, tasks, etc.).`);
  console.log(`- Step 3: Delete organization_members for target users.`);
  console.log(`- Step 4: Delete profiles for target users.`);
  console.log(`- Step 5: Delete auth.users via supabaseAdmin.auth.admin.deleteUser(id).`);
  console.log(`- Step 6: Run 10 self-tests to verify integrity, RLS, auth, and build.`);

  console.log(`\n=== END OF PHASE A REPORT ===`);
  console.log(`XÁC NHẬN CHẠY V0.7-H2 CLEANUP`);
}

run();
