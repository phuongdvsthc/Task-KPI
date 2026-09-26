const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config();

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const migrationFile = path.join(__dirname, '20260918_v0_9_a3_migrate_user_roles.sql');
  if (!fs.existsSync(migrationFile)) {
    console.error(`ERROR: Migration file not found at: ${migrationFile}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(migrationFile, 'utf8');
  console.log('Connecting to database and running migration v0.9-A3...');

  const sql = postgres(dbUrl, { max: 1 });
  try {
    await sql.unsafe(sqlContent);
    console.log('SUCCESS: Migration v0.9-A3 applied successfully!');
  } catch (err) {
    console.error('ERROR: Migration v0.9-A3 failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
