import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

async function run() {
  if (!connectionString) {
    console.log('No DATABASE_URL found in env');
    return;
  }
  const sql = postgres(connectionString);
  try {
    console.log('Applying database patch for source_type constraint...');
    await sql`
      ALTER TABLE admission_change_history 
      DROP CONSTRAINT IF EXISTS admission_change_history_source_type_check;
    `;
    await sql`
      ALTER TABLE admission_change_history 
      ADD CONSTRAINT admission_change_history_source_type_check 
      CHECK (source_type IN ('user', 'manual', 'excel_import', 'migration', 'system'));
    `;
    console.log('Successfully updated admission_change_history check constraint!');
  } catch (err) {
    console.error('Patch error:', err);
  } finally {
    await sql.end();
  }
}

run();
