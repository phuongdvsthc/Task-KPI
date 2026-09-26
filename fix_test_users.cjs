const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

const regex = /const \{ data: adminProfiles \}[\s\S]*?cleanupIds\.users\.push\(uManagerOut\);/;

const newLogic = `
    const password = 'Password123!';
    const { data: u0 } = await supabase.auth.admin.createUser({ email: \`admin_\${Date.now()}@example.com\`, password, email_confirm: true });
    const { data: u1 } = await supabase.auth.admin.createUser({ email: \`mgr_in_\${Date.now()}@example.com\`, password, email_confirm: true });
    const { data: u2 } = await supabase.auth.admin.createUser({ email: \`mgr_out_\${Date.now()}@example.com\`, password, email_confirm: true });
    const { data: u3 } = await supabase.auth.admin.createUser({ email: \`staff_own_\${Date.now()}@example.com\`, password, email_confirm: true });
    const { data: u4 } = await supabase.auth.admin.createUser({ email: \`staff_oth_\${Date.now()}@example.com\`, password, email_confirm: true });

    const uAdmin = u0.user.id;
    const uManagerIn = u1.user.id;
    const uManagerOut = u2.user.id;
    const uStaffOwner = u3.user.id;
    const uStaffOther = u4.user.id;
    cleanupIds.users.push(uAdmin, uManagerIn, uManagerOut, uStaffOwner, uStaffOther);

    await supabase.from('profiles').update({ system_role: 'admin' }).eq('id', uAdmin);
    await supabase.from('profiles').update({ system_role: 'manager' }).eq('id', uManagerIn);
    await supabase.from('profiles').update({ system_role: 'manager' }).eq('id', uManagerOut);
    await supabase.from('profiles').update({ system_role: 'staff' }).eq('id', uStaffOwner);
    await supabase.from('profiles').update({ system_role: 'staff' }).eq('id', uStaffOther);
`;

content = content.replace(regex, newLogic);
fs.writeFileSync('test_v0.4.6-A.cjs', content);
