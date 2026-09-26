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

async function runDirectSqlDelete() {
  console.log("=== SQL DIRECT CLEANUP ===");
  const allowEmailsQuoted = ALLOWLIST.map(e => `'${e}'`).join(",");

  // Delete from auth.users via SQL if permitted
  const { data, error } = await supabase.rpc("exec_sql", {
    query: `
      DELETE FROM auth.users 
      WHERE lower(btrim(email)) NOT IN (${allowEmailsQuoted});
    `
  }).catch(err => ({ data: null, error: err }));

  console.log("SQL auth.users delete result:", error ? error.message : "SUCCESS", data);

  // Clean profiles and members
  await supabase.rpc("exec_sql", {
    query: `
      DELETE FROM public.profiles 
      WHERE lower(btrim(email)) NOT IN (${allowEmailsQuoted});
    `
  }).catch(() => {});

  // Run self test after SQL delete
  let allAuthUsers = [];
  let page = 1;
  while (true) {
    const { data: res } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (!res || !res.users || res.users.length === 0) break;
    allAuthUsers.push(...res.users);
    if (res.users.length < 200) break;
    page++;
  }

  const allowSet = new Set(ALLOWLIST.map(e => e.toLowerCase().trim()));
  const nonAllow = allAuthUsers.filter(u => !allowSet.has((u.email || "").toLowerCase().trim()));
  const foundAllow = allAuthUsers.filter(u => allowSet.has((u.email || "").toLowerCase().trim()));

  console.log(`Remaining non-allowlist auth users: ${nonAllow.length}`);
  console.log(`Found allowlist auth users: ${foundAllow.length} / 11`);
}

runDirectSqlDelete();
