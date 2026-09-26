const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('pg_proc').select('proname, prosrc').eq('proname', 'kpi_create_assignment_from_template').then(r => console.log(r.data, r.error));
