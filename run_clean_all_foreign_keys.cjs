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

async function cleanForeignKeysAndUsers() {
  console.log("=== CLEANING FOREIGN KEYS & AUTH USERS ===");

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
  const usersToDelete = allAuthUsers.filter(u => {
    const email = (u.email || "").toLowerCase().trim();
    if (u.id === ADMIN_UUID || email === "admin@truonghoc.edu.vn") return false;
    return !allowSet.has(email);
  });

  console.log(`Found ${usersToDelete.length} non-allowlist users to delete.`);

  const deleteIds = usersToDelete.map(u => u.id);

  // 1. Delete from public.profiles and organization_members for these IDs
  if (deleteIds.length > 0) {
    console.log("Deleting dependent profiles and organization members...");
    for (let i = 0; i < deleteIds.length; i += 50) {
      const chunk = deleteIds.slice(i, i + 50);
      await supabase.from("organization_members").delete().in("user_id", chunk);
      await supabase.from("profiles").delete().in("id", chunk);
    }
  }

  // 2. Delete auth users one by one with logging
  let successCount = 0;
  let failCount = 0;

  for (const u of usersToDelete) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) {
      console.log(`[ERROR] UUID: ${u.id} | Email: ${u.email} | Error: ${error.message}`);
      failCount++;
    } else {
      console.log(`[SUCCESS] UUID: ${u.id} | Email: ${u.email} | Status: DELETED`);
      successCount++;
    }
  }

  console.log(`\nDeletion result: Success = ${successCount}, Failed = ${failCount}`);

  // 3. Final verification
  let finalAuth = [];
  let p = 1;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page: p, perPage: 200 });
    if (!data || !data.users || data.users.length === 0) break;
    finalAuth.push(...data.users);
    if (data.users.length < 200) break;
    p++;
  }

  const finalAllow = finalAuth.filter(u => allowSet.has((u.email || "").toLowerCase().trim()));
  const finalNonAllow = finalAuth.filter(u => !allowSet.has((u.email || "").toLowerCase().trim()));

  console.log("\n=== FINAL VERIFICATION PROOF ===");
  console.log(`- total_auth_users = ${finalAuth.length}`);
  console.log(`- allowlist_users = ${finalAllow.length}`);
  console.log(`- users_still_need_deletion = ${finalNonAllow.length}`);
}

cleanForeignKeysAndUsers();
