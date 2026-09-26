const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase.auth.admin.listUsers();
  console.log("Error:", error);
  console.log("Users count:", data?.users?.length);
  console.log("Emails:", data?.users?.map(u => u.email));
}
check();
