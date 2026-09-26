/**
 * Standalone Migration Runner for v0.8-A2
 * Applies /migrations/v0.8-A2_admission_plans_and_results.sql
 *
 * Usage:
 * DATABASE_URL="postgres://user:pass@host:5432/db" node run_admission_a2_migration.cjs
 */

const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required to run migration directly.');
    console.error('Usage: DATABASE_URL="postgresql://..." node run_admission_a2_migration.cjs');
    process.exit(1);
  }

  const migrationFile = path.join(__dirname, 'migrations', 'v0.8-A2_admission_plans_and_results.sql');
  if (!fs.existsSync(migrationFile)) {
    console.error(`ERROR: Migration file not found at: ${migrationFile}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(migrationFile, 'utf8');
  console.log(`Connecting to database and running migration: v0.8-A2_admission_plans_and_results.sql...`);

  const sql = postgres(dbUrl, { max: 1 });
  try {
    await sql.unsafe(sqlContent);
    console.log('SUCCESS: Migration v0.8-A2 applied successfully!');
  } catch (err) {
    console.error('ERROR: Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
