const fs = require('fs');
let code = fs.readFileSync('src/components/tasks/TaskCreate.tsx', 'utf8');

code = code.replace(
  'organizationService.getUnits(),\n          profileService.getAllProfiles(),',
  'taskService.getAvailableOrganizations(systemRole as any, user?.id || "", allUnits, allUnits.map(u => u.id)) /* Will fix this */'
);

fs.writeFileSync('src/components/tasks/TaskCreate.tsx', code);
