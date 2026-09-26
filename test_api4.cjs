require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Update password for manager
  await supabaseAdmin.auth.admin.updateUserById(
    'dfb1b53f-2e6e-4ddd-a6f3-676d900f9b31', // loanbtk@sthc.edu.vn
    { password: 'password123' }
  );

  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey);

  const { data: { session }, error: authErr } = await supabaseUser.auth.signInWithPassword({
    email: 'loanbtk@sthc.edu.vn',
    password: 'password123'
  });

  if (authErr) {
    console.log("Failed to login manager:", authErr.message);
    return;
  }

  const token = session.access_token;
  
  // Create payload
  const payload = {
    title: "TEST PUBLISH v0.2.2-D (Manager)",
    description: "Nội dung test",
    priority: "normal",
    acknowledgement_required: false,
    publication_status: "draft",
    audience_mode: "selected_users",
    selected_user_ids: ["4151768c-41c9-40cd-a145-1be160eb0fec", "237a3bc6-7021-4f8a-8f87-b9b4fb035152"] // Minh and Tram
  };

  const res = await fetch('http://localhost:3000/api/announcements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const resData = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", resData);

  if (res.status === 200 || res.status === 201) {
    const taskId = resData.id;
    const { data: users } = await supabaseAdmin.from('task_announcement_audience_users').select('*').eq('task_id', taskId);
    console.log(`Audience users for ${taskId}:`, users);
  }
}
run();
