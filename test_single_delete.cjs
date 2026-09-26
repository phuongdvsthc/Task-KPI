const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSingle() {
  let { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10 });
  const target = (data?.users || []).find(u => !u.email.includes("truonghoc.edu.vn") && !u.email.includes("sthc.edu.vn"));
  if (!target) {
    console.log("No non-allowlist user found");
    return;
  }
  console.log("Attempting to delete target:", target.email, target.id);
  const res = await supabase.auth.admin.deleteUser(target.id);
  console.log("Result:", res);
}
testSingle();
