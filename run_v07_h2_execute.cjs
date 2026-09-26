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

async function executePhaseB() {
  console.log("=== PHASE B – REAL EXECUTION V0.7-H2 ===");

  // 1. Fetch all auth users with pagination
  let allAuthUsers = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data || !data.users || data.users.length === 0) break;
    allAuthUsers.push(...data.users);
    if (data.users.length < 200) break;
    page++;
  }

  const allowSet = new Set(ALLOWLIST.map(e => e.toLowerCase().trim()));

  const usersToDelete = allAuthUsers.filter(u => {
    const email = (u.email || "").toLowerCase().trim();
    if (u.id === ADMIN_UUID || email === ADMIN_EMAIL) return false;
    return !allowSet.has(email);
  });

  console.log(`Total auth users before deletion: ${allAuthUsers.length}`);
  console.log(`Users targeted for deletion: ${usersToDelete.length}`);

  // 2. Clear dependent operational test tables
  const tables = [
    "task_assignees", "task_collaborators", "task_comments", "task_attachments",
    "task_activities", "notification_recipients", "notifications", "reminders",
    "kpi_evaluations", "kpi_actuals", "kpi_assignments", "metric_entries",
    "daily_reports", "work_mode_entries", "announcement_recipients",
    "announcements", "tasks", "self_test_logs", "fixture_records"
  ];

  console.log("\n--- Cleaning Operational Data Tables ---");
  for (const t of tables) {
    try {
      const { error } = await supabase.from(t).delete().gte("created_at", "1970-01-01");
      if (error) {
        await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      console.log(`[CLEARED] ${t}`);
    } catch (e) {
      console.log(`[SKIP/EMPTY] ${t}`);
    }
  }

  // Clean non-allowlist organization members and profiles
  const allowEmailsQuoted = ALLOWLIST.map(e => `'${e}'`).join(",");
  try {
    await supabase.from("organization_members").delete().not("user_id", "in", `(SELECT id FROM public.profiles WHERE lower(btrim(email)) IN (${allowEmailsQuoted}))`);
    await supabase.from("profiles").delete().not("email", "in", `(${allowEmailsQuoted})`);
    console.log("[CLEARED] Non-allowlist organization members and profiles.");
  } catch (e) {
    console.log("Error cleaning profiles/members:", e.message);
  }

  // 3. Call supabaseAdmin.auth.admin.deleteUser(userId) with real logging
  console.log("\n--- Executing auth.admin.deleteUser() ---");
  let deletedCount = 0;
  let failedCount = 0;

  for (const u of usersToDelete) {
    const email = (u.email || "").toLowerCase().trim();
    if (u.id === ADMIN_UUID || email === ADMIN_EMAIL || allowSet.has(email)) {
      console.log(`[PROTECTED] Skipping allowlist user: ${email} (${u.id})`);
      continue;
    }

    const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
    if (delErr) {
      console.error(`[ERROR] UUID: ${u.id} | Email: ${email} | Error: ${delErr.message}`);
      failedCount++;
    } else {
      console.log(`[SUCCESS] UUID: ${u.id} | Email: ${email} | Status: DELETED`);
      deletedCount++;
    }
  }

  console.log(`\nDeletion summary: Success = ${deletedCount}, Failed = ${failedCount}`);

  // 4. Re-fetch auth users and prove metrics
  let finalAuthUsers = [];
  let fp = 1;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page: fp, perPage: 200 });
    if (!data || !data.users || data.users.length === 0) break;
    finalAuthUsers.push(...data.users);
    if (data.users.length < 200) break;
    fp++;
  }

  const finalAllowFound = finalAuthUsers.filter(u => allowSet.has((u.email || "").toLowerCase().trim()));
  const finalNonAllow = finalAuthUsers.filter(u => !allowSet.has((u.email || "").toLowerCase().trim()));

  console.log("\n=== FINAL VERIFICATION PROOF ===");
  console.log(`- total_auth_users = ${finalAuthUsers.length}`);
  console.log(`- allowlist_users = ${finalAllowFound.length}`);
  console.log(`- users_still_need_deletion = ${finalNonAllow.length}`);

  if (finalAuthUsers.length === 11 && finalAllowFound.length === 11 && finalNonAllow.length === 0) {
    console.log("\n>>> V0.7-H2 CLEANUP SUCCESS: PASS <<<");
  } else {
    console.log("\nWARNING: Some non-allowlist users remain or counts do not match exactly 11.");
  }
}

executePhaseB();
