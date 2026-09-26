const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const email = `test_admin_${Date.now()}@example.com`;
  const password = 'Password123!';
  const { data: user, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (userErr) {
    console.error("User create error:", userErr);
    return;
  }
  
  await supabase.from('profiles').update({ system_role: 'admin' }).eq('id', user.user.id);
  
  const sbAnon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data: session, error: sessErr } = await sbAnon.auth.signInWithPassword({
    email,
    password
  });
  if (sessErr) {
    console.error("Sign in error:", sessErr);
    return;
  }
  console.log("JWT:", session.session.access_token.substring(0, 20) + "...");
}
run();
