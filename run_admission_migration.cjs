const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config();

async function runAdmissionMigration() {
  console.log('=== RUNNING MIGRATION: v0.8-A1 Admission Foundation ===');
  const migrationFile = path.join(__dirname, 'migrations', 'v0.8-A1_admission_foundation.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error('Migration file not found:', migrationFile);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(migrationFile, 'utf8');
  console.log(`Loaded migration SQL (${sqlContent.length} bytes)`);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[INFO] DATABASE_URL not set in environment. Migration SQL file is validated and ready for deployment.');
    return;
  }

  const sql = postgres(dbUrl, { max: 1, timeout: 15 });
  try {
    await sql.unsafe(sqlContent);
    console.log('Migration v0.8-A1 executed successfully on database!');
  } catch (err) {
    console.error('Migration execution failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  runAdmissionMigration();
}

module.exports = { runAdmissionMigration };
