const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sbAnon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const email = `test_admin_${Date.now()}@example.com`;
  const password = 'Password123!';
  const { data: user } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  await supabaseAdmin.from('profiles').update({ system_role: 'admin' }).eq('id', user.user.id);
  
  const { data: session } = await sbAnon.auth.signInWithPassword({ email, password });
  
  const sbAuth = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${session.session.access_token}` } }
  });
  
  const { data: templates } = await supabaseAdmin.from('kpi_templates').select('id').limit(1);
  const { data: versions } = await supabaseAdmin.from('kpi_template_versions').select('id').limit(1);
  
  const res = await sbAuth.rpc('kpi_create_assignment_from_template', {
    p_period_id: '11111111-1111-1111-1111-111111111111',
    p_template_version_id: versions[0].id,
    p_assignee_type: 'individual',
    p_assignee_user_id: user.user.id,
    p_assignee_organization_unit_id: null,
    p_effective_from: '2026-01-01',
    p_effective_to: '2026-12-31',
    p_notes: 'test'
  });
  
  console.log("RPC result:", res);
}
run();
