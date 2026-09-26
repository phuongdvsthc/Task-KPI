const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

// Just remove unique constraint for testing or create multiple users.
// Actually, let's just make uStaffOther and uManagerOut be in unitIn.
// In the setup:
content = content.replace(
  "{ organization_unit_id: unitOut, user_id: uManagerOut, member_role: 'head', is_primary: true },\n      { organization_unit_id: unitOut, user_id: uStaffOther, member_role: 'member', is_primary: true }",
  "{ organization_unit_id: unitIn, user_id: uManagerOut, member_role: 'head', is_primary: true },\n      { organization_unit_id: unitIn, user_id: uStaffOther, member_role: 'member', is_primary: true }"
);

// Then change assignees:
content = content.replace("const asgn2 = await createTestAssignment(uStaffOwner, 'individual', true, false);", "const asgn2 = await createTestAssignment(uStaffOther, 'individual', true, false);");
content = content.replace("const asgn3 = await createTestAssignment(uStaffOwner, 'individual', false, true);", "const asgn3 = await createTestAssignment(uManagerOut, 'individual', false, true);");

fs.writeFileSync('test_v0.4.6-A.cjs', content);
