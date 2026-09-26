const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

// The test script creates users like:
// const uManagerIn = crypto.randomUUID();
// Let's replace the user creation with actual auth users.

const oldUserCreation = `    const uManagerIn = crypto.randomUUID();
    const uManagerOut = crypto.randomUUID();
    const uStaffOwner = crypto.randomUUID();
    const uStaffOther = crypto.randomUUID();
    cleanupIds.users.push(uManagerIn, uManagerOut, uStaffOwner, uStaffOther);

    await supabase.from('profiles').insert([
      { id: uManagerIn, email: 'mgr_in@example.com', display_name: 'Mgr In', system_role: 'manager', is_active: true },
      { id: uManagerOut, email: 'mgr_out@example.com', display_name: 'Mgr Out', system_role: 'manager', is_active: true },
      { id: uStaffOwner, email: 'staff_own@example.com', display_name: 'Staff Owner', system_role: 'staff', is_active: true },
      { id: uStaffOther, email: 'staff_oth@example.com', display_name: 'Staff Other', system_role: 'staff', is_active: true }
    ]);`;

const newUserCreation = `
    const password = 'Password123!';
    const { data: u1 } = await supabase.auth.admin.createUser({ email: \`mgr_in_\${Date.now()}@example.com\`, password, email_confirm: true });
    const { data: u2 } = await supabase.auth.admin.createUser({ email: \`mgr_out_\${Date.now()}@example.com\`, password, email_confirm: true });
    const { data: u3 } = await supabase.auth.admin.createUser({ email: \`staff_own_\${Date.now()}@example.com\`, password, email_confirm: true });
    const { data: u4 } = await supabase.auth.admin.createUser({ email: \`staff_oth_\${Date.now()}@example.com\`, password, email_confirm: true });
    
    const uManagerIn = u1.user.id;
    const uManagerOut = u2.user.id;
    const uStaffOwner = u3.user.id;
    const uStaffOther = u4.user.id;
    cleanupIds.users.push(uManagerIn, uManagerOut, uStaffOwner, uStaffOther);

    await supabase.from('profiles').update({ system_role: 'manager' }).eq('id', uManagerIn);
    await supabase.from('profiles').update({ system_role: 'manager' }).eq('id', uManagerOut);
    await supabase.from('profiles').update({ system_role: 'staff' }).eq('id', uStaffOwner);
    await supabase.from('profiles').update({ system_role: 'staff' }).eq('id', uStaffOther);
    
    const sbAnon = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    const { data: session } = await sbAnon.auth.signInWithPassword({ email: u1.user.email, password });
    const sbAuth = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: \`Bearer \${session.session.access_token}\` } }
    });
`;

content = content.replace(oldUserCreation, newUserCreation);

// Also remove the admin user creation I added earlier
content = content.replace(/const email = \`test_admin_.*?global: \{ headers: \{ Authorization: \\\`Bearer \$\{session\.session\.access_token\}\\\` \} \}\n    \}\);\n/gs, '');

// Also I should update createTestAssignment to use `adminUser.user.id` to `uManagerIn` for manual actual entries
content = content.replace(/adminUser\.user\.id/g, 'uManagerIn');

fs.writeFileSync('test_v0.4.6-A.cjs', content);
