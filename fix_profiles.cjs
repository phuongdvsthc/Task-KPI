const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

// Replace updates with inserts for profiles
content = content.replace(
  /await supabase\.from\('profiles'\)\.update\(\{ system_role: 'admin' \}\)\.eq\('id', uAdmin\);\n    await supabase\.from\('profiles'\)\.update\(\{ system_role: 'manager' \}\)\.eq\('id', uManagerIn\);\n    await supabase\.from\('profiles'\)\.update\(\{ system_role: 'manager' \}\)\.eq\('id', uManagerOut\);\n    await supabase\.from\('profiles'\)\.update\(\{ system_role: 'staff' \}\)\.eq\('id', uStaffOwner\);\n    await supabase\.from\('profiles'\)\.update\(\{ system_role: 'staff' \}\)\.eq\('id', uStaffOther\);/g,
  `
    await supabase.from('profiles').insert([
      { id: uAdmin, email: \`admin_\${Date.now()}@example.com\`, display_name: 'Admin', system_role: 'admin', is_active: true },
      { id: uManagerIn, email: \`mgr_in_\${Date.now()}@example.com\`, display_name: 'Mgr In', system_role: 'manager', is_active: true },
      { id: uManagerOut, email: \`mgr_out_\${Date.now()}@example.com\`, display_name: 'Mgr Out', system_role: 'manager', is_active: true },
      { id: uStaffOwner, email: \`staff_own_\${Date.now()}@example.com\`, display_name: 'Staff Owner', system_role: 'staff', is_active: true },
      { id: uStaffOther, email: \`staff_oth_\${Date.now()}@example.com\`, display_name: 'Staff Other', system_role: 'staff', is_active: true }
    ]);
  `
);

fs.writeFileSync('test_v0.4.6-A.cjs', content);
