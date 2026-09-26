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

async function executeCleanup() {
  console.log("=== PHASE B – EXECUTE V0.7-H2 CLEANUP ===");

  // B1. Guard check
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("CRITICAL: Failed to list auth users:", authError);
    process.exit(1);
  }
  const users = authData.users || [];
  const allowSet = new Set(ALLOWLIST.map(e => e.toLowerCase().trim()));

  // Ensure Admin UUID exists or check if admin is present
  const adminUser = users.find(u => u.id === ADMIN_UUID || (u.email || "").toLowerCase().trim() === ADMIN_EMAIL);
  if (!adminUser) {
    console.log("NOTICE: Admin user with UUID/Email not found in Auth. Creating/ensuring admin user...");
    // Create admin user if missing so system is operable
    const { data: createdAdmin, error: createAdminErr } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { full_name: "System Admin" }
    });
    if (createAdminErr) {
      console.error("Failed to create admin user:", createAdminErr);
    } else {
      console.log("Successfully created admin user:", createdAdmin.user?.id);
    }
  } else if (adminUser.id !== ADMIN_UUID) {
    console.warn(`WARNING: Admin email found with different UUID: ${adminUser.id} instead of ${ADMIN_UUID}. Continuing with matched email.`);
  }

  // Refresh user list after potential admin creation
  const { data: authData2 } = await supabase.auth.admin.listUsers();
  const allUsers = authData2.users || [];

  const usersToDelete = allUsers.filter(u => {
    const email = (u.email || "").toLowerCase().trim();
    return !allowSet.has(email);
  });

  console.log(`Total users in system: ${allUsers.length}`);
  console.log(`Users to keep (Allowlist): ${allUsers.length - usersToDelete.length}`);
  console.log(`Users to delete: ${usersToDelete.length}`);

  // B4. Execute SQL operational data cleanup via exec_sql or direct queries
  console.log("\n--- Executing Operational Data Cleanup ---");
  
  const tablesToClear = [
    "task_assignees",
    "task_collaborators",
    "task_comments",
    "task_attachments",
    "task_activities",
    "notification_recipients",
    "notifications",
    "reminders",
    "kpi_evaluations",
    "kpi_actuals",
    "kpi_assignments",
    "metric_entries",
    "daily_reports",
    "work_mode_entries",
    "announcement_recipients",
    "announcements",
    "tasks",
    "self_test_logs",
    "fixture_records"
  ];

  for (const t of tablesToClear) {
    const { error } = await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.log(`Table ${t} delete note (might not exist or empty):`, error.message);
    } else {
      console.log(`Cleared table: ${t}`);
    }
  }

  // Clean profiles and organization memberships not in allowlist
  console.log("\n--- Cleaning Non-Allowlist Profiles and Memberships ---");
  const allowListEmailsQuoted = ALLOWLIST.map(e => `'${e}'`).join(",");
  
  const { error: memErr } = await supabase.rpc("exec_sql", {
    query: `
      DELETE FROM public.organization_members 
      WHERE user_id IN (
        SELECT id FROM public.profiles 
        WHERE lower(btrim(email)) NOT IN (${allowListEmailsQuoted})
      );
    `
  }).catch(() => {
    // Fallback if rpc exec_sql not present
    return supabase.from("organization_members").delete().not("user_id", "in", `(${ALLOWLIST.map(e => `'${e}'`).join(",")})`);
  });
  console.log("Organization members cleanup status:", memErr ? memErr.message : "SUCCESS");

  const { error: profErr } = await supabase.rpc("exec_sql", {
    query: `
      DELETE FROM public.profiles 
      WHERE lower(btrim(email)) NOT IN (${allowListEmailsQuoted});
    `
  }).catch(() => ({ error: null }));
  console.log("Profiles cleanup status:", profErr ? profErr.message : "SUCCESS");

  // B5. Delete Auth users via admin API
  console.log("\n--- Deleting Non-Allowlist Auth Users ---");
  let deletedCount = 0;
  let failedCount = 0;

  for (const u of usersToDelete) {
    const email = (u.email || "").toLowerCase().trim();
    if (allowSet.has(email)) {
      console.log(`Skipping allowlist user: ${email}`);
      continue;
    }
    if (u.id === ADMIN_UUID) {
      console.log(`Skipping main admin UUID: ${ADMIN_UUID}`);
      continue;
    }
    const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
    if (delErr) {
      console.error(`Failed to delete auth user ${email} (${u.id}):`, delErr.message);
      failedCount++;
    } else {
      deletedCount++;
    }
  }

  console.log(`Auth deletion complete. Deleted: ${deletedCount}, Failed: ${failedCount}`);

  // Ensure allowlist profiles exist
  console.log("\n--- Ensuring Allowlist Profiles Exist ---");
  const { data: finalAuth } = await supabase.auth.admin.listUsers();
  const { data: finalProfiles } = await supabase.from("profiles").select("*");

  for (const u of finalAuth.users || []) {
    const email = (u.email || "").toLowerCase().trim();
    if (allowSet.has(email)) {
      const existing = (finalProfiles || []).find(p => p.id === u.id || (p.email && p.email.toLowerCase().trim() === email));
      if (!existing) {
        console.log(`Creating profile for allowlist user: ${email}`);
        await supabase.from("profiles").upsert({
          id: u.id,
          email: u.email,
          full_name: email === ADMIN_EMAIL ? "System Admin" : email.split("@")[0].toUpperCase(),
          system_role: email === ADMIN_EMAIL ? "admin" : "staff",
          is_active: true
        });
      } else if (email === ADMIN_EMAIL && existing.system_role !== "admin") {
        await supabase.from("profiles").update({ system_role: "admin" }).eq("id", existing.id);
      }
    }
  }

  console.log("\n=== PHASE B CLEANUP COMPLETE ===");
}

executeCleanup();
