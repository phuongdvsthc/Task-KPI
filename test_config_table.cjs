const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testTable() {
  const { data, error } = await supabase.from('admission_google_sheets_config').select('*').limit(1);
  console.log('Test table query result:', { data, error });
}
testTable();
