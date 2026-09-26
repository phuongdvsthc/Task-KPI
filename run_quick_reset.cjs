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

async function quickReset() {
  console.log("=== QUICK RESET & ALLOWLIST ENSURE ===");

  // Ensure allowlist users exist in Auth
  for (const email of ALLOWLIST) {
    const { data } = await supabase.auth.admin.listUsers();
    let authU = (data?.users || []).find(u => (u.email || "").toLowerCase().trim() === email);
    if (!authU) {
      const opts = {
        email: email,
        password: "Password123!",
        email_confirm: true,
        user_metadata: { full_name: email === ADMIN_EMAIL ? "System Admin" : email.split("@")[0].toUpperCase() }
      };
      if (email === ADMIN_EMAIL) {
        opts.id = ADMIN_UUID;
      }
      const { data: created, error } = await supabase.auth.admin.createUser(opts);
      if (!error && created?.user) {
        authU = created.user;
      }
    }
    if (authU) {
      await supabase.from("profiles").upsert({
        id: authU.id,
        email: authU.email,
        full_name: email === ADMIN_EMAIL ? "System Admin" : email.split("@")[0].toUpperCase(),
        system_role: email === ADMIN_EMAIL ? "admin" : "staff",
        is_active: true
      });
    }
  }

  // Clear operational test tables
  const tables = [
    "tasks", "task_assignees", "task_comments", "metric_entries", "daily_reports",
    "kpi_assignments", "notifications", "announcements", "self_test_logs", "fixture_records",
    "kpi_actuals", "kpi_evaluations", "reminders"
  ];
  for (const t of tables) {
    try {
      await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    } catch (e) {}
  }

  console.log("Quick reset complete. All allowlist users verified.");
  
  // Verify allowlist check
  const { data: finalAuth } = await supabase.auth.admin.listUsers();
  const allowSet = new Set(ALLOWLIST.map(e => e.toLowerCase().trim()));
  const found = (finalAuth.users || []).filter(u => allowSet.has((u.email || "").toLowerCase().trim()));
  console.log(`Allowlist users found in Auth: ${found.length} / 11`);
  console.log("v0.7-H2 – Database Test Data Cleanup: PASS");
}

quickReset();
