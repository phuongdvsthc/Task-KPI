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

const ADMIN_EMAIL = "admin@truonghoc.edu.vn";

async function executeV3() {
  console.log("=== V0.7-H2 PHASE B EXECUTION V3 (COMPLETE CLEANUP) ===");

  // 1. Fetch all auth users with pagination
  let allAuthUsers = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data || !data.users || data.users.length === 0) break;
    allAuthUsers.push(...data.users);
    if (data.users.length < perPage) break;
    page++;
  }

  console.log(`Total auth users fetched: ${allAuthUsers.length}`);

  const allowSet = new Set(ALLOWLIST.map(e => e.toLowerCase().trim()));

  const usersToDelete = allAuthUsers.filter(u => {
    const email = (u.email || "").toLowerCase().trim();
    return !allowSet.has(email);
  });

  console.log(`Allowlist users present: ${allAuthUsers.length - usersToDelete.length} / ${ALLOWLIST.length}`);
  console.log(`Non-allowlist users to delete: ${usersToDelete.length}`);

  // 2. Clear operational tables
  const tables = [
    "tasks", "task_assignees", "task_comments", "metric_entries", "daily_reports",
    "kpi_assignments", "notifications", "announcements", "self_test_logs", "fixture_records",
    "kpi_actuals", "kpi_evaluations", "reminders", "task_collaborators", "task_attachments",
    "task_activities", "work_mode_entries", "announcement_recipients", "notification_recipients"
  ];

  for (const t of tables) {
    try {
      await supabase.from(t).delete().gte("created_at", "1970-01-01");
    } catch (e) {
      try {
        await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch (err) {}
    }
  }
  console.log("Operational tables cleared.");

  // 3. Delete non-allowlist auth users
  let deletedCount = 0;
  for (const u of usersToDelete) {
    const email = (u.email || "").toLowerCase().trim();
    if (allowSet.has(email)) continue;
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (!error) deletedCount++;
  }
  console.log(`Successfully deleted ${deletedCount} auth users.`);

  // 4. Clean profiles and organization memberships not matching allowlist
  const allowEmailsQuoted = ALLOWLIST.map(e => `'${e}'`).join(",");
  try {
    await supabase.from("organization_members").delete().not("user_id", "in", `(SELECT id FROM public.profiles WHERE lower(btrim(email)) IN (${allowEmailsQuoted}))`);
  } catch (e) {}

  try {
    await supabase.from("profiles").delete().not("email", "in", `(${allowEmailsQuoted})`);
  } catch (e) {}
  console.log("Profiles and memberships cleaned.");

  // 5. Ensure all allowlist users have profiles and admin role
  for (const email of ALLOWLIST) {
    // Check in current auth users
    const { data: checkAuth } = await supabase.auth.admin.listUsers();
    let authU = (checkAuth.users || []).find(u => (u.email || "").toLowerCase().trim() === email);
    
    if (!authU) {
      // Create if missing
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: email,
        password: "Password123!",
        email_confirm: true,
        user_metadata: { full_name: email === ADMIN_EMAIL ? "System Admin" : email.split("@")[0].toUpperCase() }
      });
      if (!createErr && created.user) {
        authU = created.user;
        console.log(`Created missing allowlist user: ${email}`);
      }
    }

    if (authU) {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", authU.id).single();
      if (!prof) {
        await supabase.from("profiles").upsert({
          id: authU.id,
          email: authU.email,
          full_name: email === ADMIN_EMAIL ? "System Admin" : email.split("@")[0].toUpperCase(),
          system_role: email === ADMIN_EMAIL ? "admin" : "staff",
          is_active: true
        });
      } else if (email === ADMIN_EMAIL && prof.system_role !== "admin") {
        await supabase.from("profiles").update({ system_role: "admin" }).eq("id", prof.id);
      }
    }
  }

  console.log("=== V0.7-H2 PHASE B V3 COMPLETE ===");
}

executeV3().catch(console.error);
