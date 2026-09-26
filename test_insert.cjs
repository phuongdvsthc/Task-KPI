const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
    const tid = crypto.randomUUID();
    const e1 = await supabase.from('kpi_templates').insert({ id: tid, name: 'T', code: 'T', scope_type: 'individual', status: 'active' });
    console.log("Template:", e1.error);
    const vid = crypto.randomUUID();
    const e2 = await supabase.from('kpi_template_versions').insert({ id: vid, template_id: tid, version_no: 1, status: 'published' });
    console.log("Version:", e2.error);
}
run();
