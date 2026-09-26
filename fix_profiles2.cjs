const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

content = content.replace(
  /await supabase.from\('profiles'\)\.insert\(\[/,
  'const err_prof = (await supabase.from("profiles").insert(['
);
content = content.replace(
  /        \{ id: uStaffOther, email: \`staff_oth_\$\{Date\.now\(\)\}@example\.com\`, display_name: 'Staff Other', system_role: 'staff', is_active: true \}\n    \]\);/,
  `        { id: uStaffOther, email: \`staff_oth_\${Date.now()}@example.com\`, display_name: 'Staff Other', system_role: 'staff', is_active: true }\n    ])).error; if (err_prof) throw new Error("Profiles insert failed: " + JSON.stringify(err_prof));`
);

fs.writeFileSync('test_v0.4.6-A.cjs', content);
