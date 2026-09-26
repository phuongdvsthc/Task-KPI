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

async function runPhaseA() {
  console.log("=== PHASE A – DRY-RUN & INVENTORY ===");

  // 1. Get auth users via admin API
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("Error listing auth users:", authError);
    return;
  }
  const authUsers = authData.users || [];

  // 2. Get public profiles
  const { data: profilesData, error: profilesError } = await supabase.from("profiles").select("*");
  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    return;
  }
  const profiles = profilesData || [];

  console.log(`\nTotal Auth Users: ${authUsers.length}`);
  console.log(`Total Profiles: ${profiles.length}`);

  // Normalize allowlist
  const allowSet = new Set(ALLOWLIST.map(e => e.toLowerCase().trim()));

  let foundAdmin = false;
  const allowlistCheck = [];
  const deleteCandidates = [];

  for (const user of authUsers) {
    const email = (user.email || "").toLowerCase().trim();
    const profile = profiles.find(p => p.id === user.id);
    const isAllow = allowSet.has(email);

    const info = {
      id: user.id,
      email: user.email,
      profileId: profile ? profile.id : null,
      profileEmail: profile ? profile.email : null,
      fullName: profile ? (profile.full_name || profile.name) : null,
      employeeCode: profile ? profile.employee_code : null,
      systemRole: profile ? profile.system_role : null,
      isActive: profile ? profile.is_active : null,
      hasWhitespace: user.email !== email || (user.email && user.email.includes(" "))
    };

    if (isAllow) {
      if (user.id === ADMIN_UUID && email === ADMIN_EMAIL) {
        foundAdmin = true;
      }
      allowlistCheck.push({ ...info, status: "FOUND" });
    } else {
      deleteCandidates.push({
        ...info,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
        reason: "Not in allowlist (test/fixture/demo user)"
      });
    }
  }

  // Check missing allowlist
  const missingAllow = ALLOWLIST.filter(email => !authUsers.some(u => (u.email || "").toLowerCase().trim() === email));
  
  console.log("\n--- A1. Allowlist Check ---");
  console.log(`Admin UUID match (${ADMIN_UUID} / ${ADMIN_EMAIL}):`, foundAdmin ? "PASS" : "FAIL / MISMATCH");
  console.log(`Missing allowlist emails:`, missingAllow.length > 0 ? missingAllow : "None (All present)");
  console.log(`Allowlist users found: ${allowlistCheck.length} / ${ALLOWLIST.length}`);

  console.log("\n--- A2. Users to be Deleted (${deleteCandidates.length}) ---");
  deleteCandidates.forEach((u, i) => {
    console.log(`${i+1}. [${u.id}] ${u.email} - Name: ${u.fullName}, Role: ${u.systemRole}, Created: ${u.createdAt}`);
  });

  // 3. Inspect Foreign Keys and Table counts via SQL query or rpc if available
  const { data: fkData, error: fkError } = await supabase.rpc("exec_sql", {
    query: `
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.constraint_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (ccu.table_name IN ('users', 'profiles', 'organization_members') OR ccu.table_schema = 'auth')
      ORDER BY tc.table_name;
    `
  }).catch(err => ({ data: null, error: err }));

  console.log("\n--- A3. Foreign Keys referencing auth/profiles/members ---");
  if (fkError) {
    console.log("Could not query foreign keys via exec_sql (rpc might not exist or need definition):", fkError.message);
  } else {
    console.log(`Found ${fkData?.length || 0} foreign key relations.`);
    if (fkData && fkData.length > 0) {
      fkData.forEach(fk => {
        console.log(`- ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (${fk.delete_rule})`);
      });
    }
  }

  // 4. Get list of tables and row counts
  const { data: tablesData, error: tablesError } = await supabase.rpc("exec_sql", {
    query: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
  }).catch(err => ({ data: null, error: err }));

  console.log("\n--- A4 & A6. Table Row Counts & Classification ---");
  const tableRows = {};
  if (tablesData && Array.isArray(tablesData)) {
    for (const row of tablesData) {
      const tName = row.table_name;
      try {
        const { count, error: countErr } = await supabase.from(tName).select("*", { count: 'exact', head: true });
        tableRows[tName] = countErr ? 'Error' : count;
      } catch (e) {
        tableRows[tName] = 'N/A';
      }
    }
  } else {
    console.log("Could not fetch table list via exec_sql. Falling back to known tables or direct query.");
  }

  console.log("Table Row Counts Summary:", tableRows);

  console.log("\n=== PHASE A COMPLETE (DRY-RUN) ===");
  console.log("XÁC NHẬN CHẠY V0.7-H2 CLEANUP");
}

runPhaseA();
