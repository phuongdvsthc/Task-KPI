const fs = require('fs');

['src/components/admin/organizations/OrganizationListView.tsx', 'src/components/admin/organizations/OrganizationFormView.tsx'].forEach(file => {
  let code = fs.readFileSync(file, 'utf-8');
  code = code.replace(/\\`/g, '`');
  code = code.replace(/\\\$/g, '$');
  fs.writeFileSync(file, code);
});
