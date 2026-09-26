const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

// Undo the draft stuff
content = content.replace("status: 'draft',", "status: isLocked ? 'locked' : 'active',");

const oldLogic = `
      await supabase.from('kpi_assignment_items').delete().eq('assignment_id', assignmentId);
      const itemId1 = crypto.randomUUID();
      const itemId2 = crypto.randomUUID();
      const err_items = (await supabase.from("kpi_assignment_items").insert([
        { id: itemId1, assignment_id: assignmentId, kpi_definition_id: def1Id, weight: 60, target_config: { target_value: 100 } },
        { id: itemId2, assignment_id: assignmentId, kpi_definition_id: def2Id, weight: 40, target_config: { target_value: 50 } }
      ])).error; if (err_items) throw new Error("Items insert failed: " + JSON.stringify(err_items));
      
      const err_upd = (await supabase.from("kpi_assignments").update({ status: isLocked ? 'locked' : 'active' }).eq('id', assignmentId)).error;
      if (err_upd) throw new Error("Update status failed: " + JSON.stringify(err_upd));
`;

const newLogic = `
      const { data: autoItems } = await supabase.from('kpi_assignment_items').select('id, kpi_definition_id').eq('assignment_id', assignmentId);
      if (!autoItems || autoItems.length === 0) throw new Error("autoItems is empty! " + JSON.stringify(autoItems));
      const itemId1 = autoItems.find(i => i.kpi_definition_id === def1Id).id;
      const itemId2 = autoItems.find(i => i.kpi_definition_id === def2Id).id;
`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('test_v0.4.6-A.cjs', content);
