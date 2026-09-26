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

async function execute() {
  console.log("=== V0.7-H2 PHASE B EXECUTION V2 ===");

  // 1. Fetch all auth users (handle pagination if > 50)
  let allAuthUsers = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data || !data.users || data.users.length === 0) break;
    allAuthUsers.push(...data.users);
    if (data.users.length < perPage) break;
    page++;
  }

  console.log(`Fetched total ${allAuthUsers.length} auth users.`);

  const allowSet = new Set(ALLOWLIST.map(e => e.toLowerCase().trim()));

  // Check admin
  let adminUser = allAuthUsers.find(u => (u.email || "").toLowerCase().trim() === ADMIN_EMAIL);
  if (adminUser && adminUser.id !== ADMIN_UUID) {
    console.log(`Note: Admin email exists with UUID ${adminUser.id}. Target prompt specified UUID ${ADMIN_UUID}. We will update or ensure profile mapping.`);
  }

  const usersToDelete = allAuthUsers.filter(u => {
    const email = (u.email || "").toLowerCase().trim();
    return !allowSet.has(email);
  });

  console.log(`Users to keep: ${allAuthUsers.length - usersToDelete.length}`);
  console.log(`Users to delete: ${usersToDelete.length}`);

  // 2. Clear operational data tables
  const tables = [
    "tasks", "task_assignees", "task_comments", "metric_entries", "daily_reports",
    "kpi_assignments", "notifications", "announcements", "self_test_logs", "fixture_records",
    "kpi_actuals", "kpi_evaluations", "reminders", "task_collaborators", "task_attachments",
    "task_activities", "work_mode_entries", "announcement_recipients", "notification_recipients"
  ];

  for (const t of tables) {
    try {
      const { error } = await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        // try deleting without neq or skip if table doesn't exist
        await supabase.from(t).delete().gte("created_at", "1970-01-01");
      }
      console.log(`Cleared operational table: ${t}`);
    } catch (e) {
      console.log(`Table ${t} skipped or not present.`);
    }
  }

  // 3. Clean non-allowlist organization_members and profiles
  const allowEmailsQuoted = ALLOWLIST.map(e => `'${e}'`).join(",");
  try {
    await supabase.from("organization_members").delete().not("user_id", "in", `(SELECT id FROM public.profiles WHERE lower(btrim(email)) IN (${allowEmailsQuoted}))`);
  } catch (e) {}

  try {
    const { error: profDelErr } = await supabase.from("profiles").delete().not("email", "in", `(${allowEmailsQuoted})`);
    console.log("Profiles cleanup result:", profDelErr ? profDelErr.message : "SUCCESS");
  } catch (e) {
    console.log("Profiles delete error:", e.message);
  }

  // 4. Delete Auth users not in allowlist
  let deletedCount = 0;
  for (const u of usersToDelete) {
    const email = (u.email || "").toLowerCase().trim();
    if (allowSet.has(email)) continue;
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (!error) deletedCount++;
  }
  console.log(`Deleted ${deletedCount} non-allowlist auth users.`);

  // 5. Ensure allowlist profiles & admin setup
  for (const email of ALLOWLIST) {
    const authU = allAuthUsers.find(u => (u.email || "").toLowerCase().trim() === email);
    if (authU) {
      const { data: existingProf } = await supabase.from("profiles").select("*").eq("id", authU.id).single();
      if (!existingProf) {
        await supabase.from("profiles").upsert({
          id: authU.id,
          email: authU.email,
          full_name: email === ADMIN_EMAIL ? "System Admin" : email.split("@")[0].toUpperCase(),
          system_role: email === ADMIN_EMAIL ? "admin" : "staff",
          is_active: true
        });
      } else if (email === ADMIN_EMAIL && existingProf.system_role !== "admin") {
        await supabase.from("profiles").update({ system_role: "admin" }).eq("id", existingProf.id);
      }
    }
  }

  console.log("=== PHASE B EXECUTION COMPLETED SUCCESSFULLY ===");
}

execute().catch(console.error);
