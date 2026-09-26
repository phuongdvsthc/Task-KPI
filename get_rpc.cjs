const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: "SELECT prosrc FROM pg_proc WHERE proname = 'set_announcement_audience';" });
  console.log(data, error);
}
run();
