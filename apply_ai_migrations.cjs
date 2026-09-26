const postgres = require('postgres');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found in environment');
    process.exit(1);
  }

  const sql = postgres(connectionString);
  try {
    console.log('Applying migration v0.10-AI-D3-B...');
    const migrationB = fs.readFileSync(path.join(__dirname, 'migrations', 'v0.10-AI-D3-B_multi_provider_config.sql'), 'utf8');
    await sql.unsafe(migrationB);
    console.log('Migration v0.10-AI-D3-B applied successfully.');

    console.log('Applying migration v0.10-AI-D3-D...');
    const migrationD = fs.readFileSync(path.join(__dirname, 'migrations', 'v0.10-AI-D3-D_provider_versioning.sql'), 'utf8');
    await sql.unsafe(migrationD);
    console.log('Migration v0.10-AI-D3-D applied successfully.');
  } catch (err) {
    console.error('Migration application failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
