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
const ADMIN_UUID = "ac7d0840-3024-402e-b5ec-08571ab238a4";

async function ensureAllowlist() {
  console.log("=== ENSURING ALLOWLIST USERS EXIST ===");

  for (const email of ALLOWLIST) {
    const { data } = await supabase.auth.admin.listUsers();
    let authU = (data.users || []).find(u => (u.email || "").toLowerCase().trim() === email);
    
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
      if (error) {
        console.log(`Failed to create ${email}:`, error.message);
      } else {
        console.log(`Created allowlist user: ${email} (${created.user?.id})`);
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

  console.log("Allowlist users ensured successfully.");
}

ensureAllowlist();
