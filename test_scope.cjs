require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const managerId = 'dfb1b53f-2e6e-4ddd-a6f3-676d900f9b31'; // loanbtk
  
  const { data: member } = await supabaseAdmin.from('organization_members').select('*').eq('user_id', managerId);
  console.log("Manager memberships:", member);

  if (member && member.length > 0) {
    const orgId = member[0].organization_unit_id;
    const { data: staff } = await supabaseAdmin.from('organization_members').select('user_id, profiles(full_name)').eq('organization_unit_id', orgId);
    console.log("Staff in manager unit:", staff);
  }
}
run();
