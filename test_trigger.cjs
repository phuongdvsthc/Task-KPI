const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await sb.from('kpi_template_versions').select('*, kpi_templates(*)').limit(5);
  console.log(JSON.stringify(data, null, 2));
}
run();
