const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: trig, error: trigErr } = await supabase
    .from('information_schema.triggers')
    .select('*')
    .eq('event_object_table', 'profiles');
  console.log('triggers on profiles:', trig, trigErr);
}
run();
