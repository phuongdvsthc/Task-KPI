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

async function runParallelDelete() {
  console.log("=== PARALLEL AUTH DELETE ===");
  let allAuthUsers = [];
  let page = 1;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (!data || !data.users || data.users.length === 0) break;
    allAuthUsers.push(...data.users);
    if (data.users.length < 200) break;
    page++;
  }

  const allowSet = new Set(ALLOWLIST.map(e => e.toLowerCase().trim()));
  const usersToDelete = allAuthUsers.filter(u => !allowSet.has((u.email || "").toLowerCase().trim()));

  console.log(`Total auth users: ${allAuthUsers.length}, Deleting non-allowlist: ${usersToDelete.length}`);

  const chunkSize = 30;
  for (let i = 0; i < usersToDelete.length; i += chunkSize) {
    const chunk = usersToDelete.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async u => {
      try {
        await supabase.auth.admin.deleteUser(u.id);
      } catch (e) {}
    }));
    console.log(`Progress: deleted up to ${Math.min(i + chunkSize, usersToDelete.length)} / ${usersToDelete.length}`);
  }

  // Ensure allowlist profiles & users
  for (const email of ALLOWLIST) {
    const { data: checkAuth } = await supabase.auth.admin.listUsers();
    let authU = (checkAuth.users || []).find(u => (u.email || "").toLowerCase().trim() === email);
    if (!authU) {
      const { data: created } = await supabase.auth.admin.createUser({
        email: email,
        password: "Password123!",
        email_confirm: true,
        user_metadata: { full_name: email === ADMIN_EMAIL ? "System Admin" : email.split("@")[0].toUpperCase() }
      });
      authU = created?.user;
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

  // Clean profiles and members
  const allowEmailsQuoted = ALLOWLIST.map(e => `'${e}'`).join(",");
  try {
    await supabase.from("profiles").delete().not("email", "in", `(${allowEmailsQuoted})`);
  } catch (e) {}

  console.log("Parallel delete and profile sync completed.");
}

runParallelDelete();
