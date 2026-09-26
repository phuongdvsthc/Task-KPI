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

async function preview() {
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

  const usersToKeep = allAuthUsers.filter(u => allowSet.has((u.email || "").toLowerCase().trim()));
  const usersToDelete = allAuthUsers.filter(u => {
    const email = (u.email || "").toLowerCase().trim();
    return !allowSet.has(email) && u.id !== ADMIN_UUID;
  });

  console.log("=== V0.7-H2 PREVIEW (PHASE A) ===");
  console.log(`- Số user hiện có: ${allAuthUsers.length}`);
  console.log(`- Số user sẽ giữ: ${usersToKeep.length}`);
  console.log(`- Số user sẽ xóa: ${usersToDelete.length}`);
  console.log(`\nDanh sách user sẽ giữ (Allowlist):`);
  usersToKeep.forEach(u => console.log(`  * [${u.id}] ${u.email}`));

  console.log(`\nDanh sách email/UUID sẽ xóa (${usersToDelete.length} users):`);
  usersToDelete.forEach((u, i) => {
    console.log(`  ${i+1}. [${u.id}] ${u.email}`);
  });
}

preview();
