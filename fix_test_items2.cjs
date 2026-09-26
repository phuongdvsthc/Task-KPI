const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

const oldLogic = `
      const itemId1 = autoItems.find(i => i.kpi_definition_id === def1Id).id;
      const itemId2 = autoItems.find(i => i.kpi_definition_id === def2Id).id;
`;

const newLogic = `
      if (!autoItems || autoItems.length === 0) throw new Error("autoItems is empty! " + JSON.stringify(autoItems));
      const itemId1 = autoItems.find(i => i.kpi_definition_id === def1Id).id;
      const itemId2 = autoItems.find(i => i.kpi_definition_id === def2Id).id;
`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('test_v0.4.6-A.cjs', content);
