const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config();

async function run() {
  const sqlFile = path.join(__dirname, 'v0.8-E1-google-sheets-config.sql');
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('DATABASE_URL not set. Skipping live DB execution of migration.');
    return;
  }
  const sql = postgres(dbUrl, { max: 1 });
  try {
    await sql.unsafe(sqlContent);
    console.log('v0.8-E1 migration executed successfully!');
  } catch (err) {
    console.error('v0.8-E1 migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}
run();
