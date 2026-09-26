const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.VITE_SUPABASE_URL.replace('https://', 'postgres://postgres:').replace('.supabase.co', '') + ':5432/postgres?password=' + process.env.SUPABASE_SERVICE_ROLE_KEY);
// Wait, that's not the DB string. The DB string for Supabase is usually postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// Since I don't know the exact postgres string, I can't easily use the `postgres` driver.
