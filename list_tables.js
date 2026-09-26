const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from("kpi_assignments").select("id").limit(1);
  console.log("Assignments exist:", !!data);
  const { data: d2, error: e2 } = await supabase.rpc("kpi_can_view_assignment", { p_assignment_id: "00000000-0000-0000-0000-000000000000" });
  console.log("RPC exists:", !e2);
  
  // Let's create a temporary function to run any query
  const res = await supabase.rpc('exec_sql', { query: "select 1" });
  console.log(res);
}
run();
