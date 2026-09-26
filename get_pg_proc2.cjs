const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabaseAdmin.rpc('get_rpc_source', { func_name: 'set_announcement_audience' });
  if (error) {
     console.log("no get_rpc_source", error.message);
  } else {
     console.log(data);
  }
}
run();
