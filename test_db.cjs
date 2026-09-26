const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.VITE_SUPABASE_URL.replace('https://', 'postgres://postgres:' + process.env.SUPABASE_SERVICE_ROLE_KEY + '@') // wait, that's not the DB URL
  });
  console.log(process.env.DATABASE_URL);
}
run();
