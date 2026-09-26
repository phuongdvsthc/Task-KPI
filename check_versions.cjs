const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');
content = content.replace(
  /await supabase.from\('kpi_template_versions'\).insert\(\[\n      \{ id: testVersionId, template_id: testTemplateId, version_no: 1, status: 'published', created_by: uAdmin \},\n      \{ id: testVersionOrgId, template_id: testTemplateOrgId, version_no: 1, status: 'published', created_by: uAdmin \}\n    \]\);/,
  `const err_v = (await supabase.from('kpi_template_versions').insert([
      { id: testVersionId, template_id: testTemplateId, version_no: 1, status: 'published', created_by: uAdmin },
      { id: testVersionOrgId, template_id: testTemplateOrgId, version_no: 1, status: 'published', created_by: uAdmin }
    ])).error; if (err_v) throw new Error("Versions insert failed: " + JSON.stringify(err_v));`
);
fs.writeFileSync('test_v0.4.6-A.cjs', content);
