const postgres = require('postgres');
require('dotenv').config();

const fs = require('fs');
const path = require('path');

async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    const file = fs.readFileSync(path.join(__dirname, 'migrations', 'v0.4.3-D_kpi_manual_trace.sql'), 'utf8');
    await sql.unsafe(file);
    console.log('Migration v0.4.3-D applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}
run();
