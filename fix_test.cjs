const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

content = content.replace("template_id: assigneeType === 'organization' ? testTemplateOrgId : testTemplateId", "template_id: testTemplateId");
content = content.replace("template_version_id: assigneeType === 'organization' ? testVersionOrgId : testVersionId", "template_version_id: testVersionId");

content = content.replace(
  "template_id: testTemplateId,",
  "template_id: assigneeType === 'organization' ? testTemplateOrgId : testTemplateId,"
);
content = content.replace(
  "template_version_id: testVersionId,",
  "template_version_id: assigneeType === 'organization' ? testVersionOrgId : testVersionId,"
);

fs.writeFileSync('test_v0.4.6-A.cjs', content);
