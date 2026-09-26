const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStatus() {
  const { data, error } = await supabase.from('kpi_assignments').select('status');
  console.log('Unique statuses in kpi_assignments:', [...new Set((data || []).map(d => d.status))]);
}
checkStatus();
