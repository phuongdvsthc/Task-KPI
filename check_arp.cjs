const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('access_role_permissions').select('*').limit(1);
  console.log('access_role_permissions sample:', data, 'error:', error);
  const { data: roles } = await supabase.from('access_roles').select('*').limit(1);
  console.log('access_roles sample:', roles);
}
check();
