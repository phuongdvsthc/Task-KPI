const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

const replacement = `
    const testTemplateId = crypto.randomUUID();
    const testTemplateOrgId = crypto.randomUUID();
    cleanupIds.templates.push(testTemplateId, testTemplateOrgId);
    await supabase.from('kpi_templates').insert([
      { id: testTemplateId, name: 'Dash Template', code: 'DTMP', scope_type: 'individual', status: 'active', created_by: uAdmin },
      { id: testTemplateOrgId, name: 'Dash Org Template', code: 'DTMPORG', scope_type: 'organization', status: 'active', created_by: uAdmin }
    ]);

    const testVersionId = crypto.randomUUID();
    const testVersionOrgId = crypto.randomUUID();
    cleanupIds.versions.push(testVersionId, testVersionOrgId);
    await supabase.from('kpi_template_versions').insert([
      { id: testVersionId, template_id: testTemplateId, version_no: 1, status: 'published', created_by: uAdmin },
      { id: testVersionOrgId, template_id: testTemplateOrgId, version_no: 1, status: 'published', created_by: uAdmin }
    ]);
    await supabase.from('kpi_template_items').insert([
      { template_version_id: testVersionId, kpi_definition_id: def1Id, weight: 60, sort_order: 1 },
      { template_version_id: testVersionId, kpi_definition_id: def2Id, weight: 40, sort_order: 2 },
      { template_version_id: testVersionOrgId, kpi_definition_id: def1Id, weight: 60, sort_order: 1 },
      { template_version_id: testVersionOrgId, kpi_definition_id: def2Id, weight: 40, sort_order: 2 }
    ]);
`;

content = content.replace(/const testTemplateId = crypto\.randomUUID\(\);\s*cleanupIds\.templates\.push\(testTemplateId\);\s*await supabase\.from\('kpi_templates'\)\.insert\([^)]+\);\s*const testVersionId = crypto\.randomUUID\(\);\s*cleanupIds\.versions\.push\(testVersionId\);\s*await supabase\.from\('kpi_template_versions'\)\.insert\([^)]+\);\s*await supabase\.from\('kpi_template_items'\)\.insert\([\s\S]*?\]\);/, replacement);

content = content.replace("template_id: testTemplateId,", "template_id: assigneeType === 'organization' ? testTemplateOrgId : testTemplateId,");
content = content.replace("template_version_id: testVersionId,", "template_version_id: assigneeType === 'organization' ? testVersionOrgId : testVersionId,");

fs.writeFileSync('test_v0.4.6-A.cjs', content);
