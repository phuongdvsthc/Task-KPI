const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

content = content.replace(
  /await supabase\.from\('kpi_assignment_items'\)\.insert\(\[/,
  'const err_items = (await supabase.from("kpi_assignment_items").insert(['
);
content = content.replace(
  /        \{ id: itemId2, assignment_id: assignmentId, kpi_definition_id: def2Id, weight: 40, target_config: { target_value: 50 } \}\n      \]\);/,
  '        { id: itemId2, assignment_id: assignmentId, kpi_definition_id: def2Id, weight: 40, target_config: { target_value: 50 } }\n      ])).error; if (err_items) throw new Error("Items insert failed: " + JSON.stringify(err_items));'
);

fs.writeFileSync('test_v0.4.6-A.cjs', content);
