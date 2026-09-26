const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data } = await supabase.auth.admin.listUsers();
  console.log("All Auth Users:", data.users.map(u => ({ id: u.id, email: u.email })));
}
run();
