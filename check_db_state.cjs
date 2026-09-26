const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const tables = ['access_modules', 'access_roles', 'access_permissions', 'access_role_permissions', 'access_user_roles', 'access_audit_logs', 'profiles'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`${t}: count=${count}, error=${error ? error.message : 'none'}`);
  }

  const { data: roles } = await supabase.from('access_roles').select('*');
  console.log('Roles:', roles);

  const { data: aur } = await supabase.from('access_user_roles').select('*, access_roles(code), profiles(system_role)').limit(5);
  console.log('access_user_roles sample:', aur);

  const { data: aal } = await supabase.from('access_audit_logs').select('*').limit(5);
  console.log('access_audit_logs sample:', aal);
}
run();
