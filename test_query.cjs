require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: assignments, error } = await sb.from('kpi_assignments')
      .select('id, status, assignee_type, assignee_unit_id_snapshot, assignee_organization_unit_id')
      .not('status', 'eq', 'draft')
      .limit(10);
  console.log(assignments, error);
}
run();
