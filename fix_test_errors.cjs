const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

content = content.replace(
  /await supabase.from\('kpi_templates'\).insert\(\[\n      \{ id: testTemplateId, name: 'Dash Template', code: 'DTMP', scope_type: 'individual', is_active: true, created_by: uAdmin \},\n      \{ id: testTemplateOrgId, name: 'Dash Org Template', code: 'DTMPORG', scope_type: 'organization', is_active: true, created_by: uAdmin \}\n    \]\);/,
  `const err_t = (await supabase.from('kpi_templates').insert([
      { id: testTemplateId, name: 'Dash Template', code: 'DTMP-' + testTemplateId.substring(0,4), scope_type: 'individual', is_active: true, created_by: uAdmin },
      { id: testTemplateOrgId, name: 'Dash Org Template', code: 'DTMPORG-' + testTemplateOrgId.substring(0,4), scope_type: 'organization', is_active: true, created_by: uAdmin }
    ])).error; if (err_t) throw new Error("Templates insert failed: " + JSON.stringify(err_t));`
);

fs.writeFileSync('test_v0.4.6-A.cjs', content);
