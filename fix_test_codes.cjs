const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

content = content.replace(
  /code: 'DM1'/g,
  "code: 'DM1-' + def1Id.substring(0,4)"
);
content = content.replace(
  /code: 'DM2'/g,
  "code: 'DM2-' + def2Id.substring(0,4)"
);

fs.writeFileSync('test_v0.4.6-A.cjs', content);
