const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('access_roles').select('*');
  // Check pg_proc via a query if possible, or check if we can query pg_proc using a view or function.
  // Actually, let's check if there is any function we can call or if postgres introspection works.
  console.log('roles:', data);
}
run();
