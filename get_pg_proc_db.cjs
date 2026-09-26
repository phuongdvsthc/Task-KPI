const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.VITE_SUPABASE_URL.replace('https://', 'postgresql://postgres:' + process.env.SUPABASE_DB_PASSWORD + '@db.') + ':5432/postgres'
});

async function run() {
  const res = await pool.query("SELECT prosrc FROM pg_proc WHERE proname = 'kpi_create_assignment_from_template'");
  console.log(res.rows[0].prosrc);
  pool.end();
}
run();
