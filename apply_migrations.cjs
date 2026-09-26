const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigrations() {
  console.log('=== Applying Access Control Migrations via exec_sql (sql_query) ===');

  const a2File = path.join(__dirname, '20260918_v0_9_a2_access_control_foundation.sql');
  const a3File = path.join(__dirname, '20260918_v0_9_a3_migrate_user_roles.sql');

  if (fs.existsSync(a2File)) {
    console.log('Executing A2 migration...');
    const a2Sql = fs.readFileSync(a2File, 'utf8');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: a2Sql });
    if (error) {
      console.error('A2 migration execution error:', error);
    } else {
      console.log('A2 migration executed successfully:', data);
    }
  }

  if (fs.existsSync(a3File)) {
    console.log('Executing A3 migration...');
    const a3Sql = fs.readFileSync(a3File, 'utf8');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: a3Sql });
    if (error) {
      console.error('A3 migration execution error:', error);
    } else {
      console.log('A3 migration executed successfully:', data);
    }
  }

  console.log('=== Migration process completed ===');
}

applyMigrations();
