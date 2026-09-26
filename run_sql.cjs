const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.rpc("exec_sql", { query: "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'kpi_can_view_assignment'" });
  console.log("data:", data, "error:", error);
}
run();
