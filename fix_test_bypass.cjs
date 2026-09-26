const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

const regex = /async function createTestAssignment[\s\S]*?return assignmentId;\n    \}/;

const newFunc = `
    async function createTestAssignment(assigneeId, assigneeType, missingActual, isLocked) {
      const assignmentId = crypto.randomUUID();
      cleanupIds.assignments.push(assignmentId);
      const { data: assignmentData, error: asgnErr } = await supabase.from('kpi_assignments').insert({
        id: assignmentId,
        period_id: testPeriodId,
        template_id: assigneeType === 'organization' ? testTemplateOrgId : testTemplateId,
        template_version_id: assigneeType === 'organization' ? testVersionOrgId : testVersionId,
        assignee_type: assigneeType,
        assignee_user_id: assigneeType === 'individual' ? assigneeId : null,
        assignee_organization_unit_id: assigneeType === 'organization' ? assigneeId : null,
        assignee_unit_id_snapshot: assigneeType === 'individual' ? unitIn : null,
        status: 'draft',
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        notes: missingActual ? 'partial' : 'complete',
        created_by: uAdmin
      });
      if (asgnErr) throw new Error("Insert asgn failed: " + JSON.stringify(asgnErr));

      const itemId1 = crypto.randomUUID();
      const itemId2 = crypto.randomUUID();
      const err_items = (await supabase.from("kpi_assignment_items").insert([
        { id: itemId1, assignment_id: assignmentId, kpi_definition_id: def1Id, weight: 60, target_config: { target_value: 100 } },
        { id: itemId2, assignment_id: assignmentId, kpi_definition_id: def2Id, weight: 40, target_config: { target_value: 50 } }
      ])).error; if (err_items) throw new Error("Items insert failed: " + JSON.stringify(err_items));

      // Transition to assigned
      let err_upd = (await supabase.from("kpi_assignments").update({ status: 'assigned' }).eq('id', assignmentId)).error;
      if (err_upd) throw new Error("Update status to assigned failed: " + JSON.stringify(err_upd));
      
      // Transition to active
      err_upd = (await supabase.from("kpi_assignments").update({ status: 'active' }).eq('id', assignmentId)).error;
      if (err_upd) throw new Error("Update status to active failed: " + JSON.stringify(err_upd));

      await supabase.from('kpi_assignment_item_bindings').insert([
        { assignment_item_id: itemId1, source_type: 'manual' },
        { assignment_item_id: itemId2, source_type: 'manual' }
      ]);
      await supabase.from('kpi_manual_actual_entries').insert([
        { assignment_item_id: itemId1, actual_value: 100, record_date: '2026-01-10', entered_by: uAdmin, status: 'approved' }
      ]);
      if (!missingActual) {
        await supabase.from('kpi_manual_actual_entries').insert([
          { assignment_item_id: itemId2, actual_value: 50, record_date: '2026-01-11', entered_by: uAdmin, status: 'approved' }
        ]);
      }
      
      if (isLocked) {
        // We can just update it to locked since we are admin? Wait, maybe transition needs to be 'reviewing' -> 'locked'?
        // Let's try direct to locked first
        const reviewSnapshot = { id: crypto.randomUUID(), assignment_id: assignmentId, status: 'approved', official_total_score: 80 };
        const items = [
          { score_snapshot: { weight: 60, score_result: { status: 'scored', raw_score: 100, weighted_score: 60 } }, final_weighted_score: 60 },
          { score_snapshot: { weight: 40, score_result: { status: 'scored', raw_score: 50, weighted_score: 20 } }, final_weighted_score: 20 }
        ];
        err_upd = (await supabase.from('kpi_assignments').update({
          config: { review: reviewSnapshot, review_items: items, official_result: { total_score: 80 } },
          status: 'locked'
        }).eq('id', assignmentId)).error;
        if (err_upd) {
           // try reviewing -> locked
           await supabase.from('kpi_assignments').update({ status: 'reviewing' }).eq('id', assignmentId);
           err_upd = (await supabase.from('kpi_assignments').update({
             config: { review: reviewSnapshot, review_items: items, official_result: { total_score: 80 } },
             status: 'locked'
           }).eq('id', assignmentId)).error;
           if (err_upd) throw new Error("Update status to locked failed: " + JSON.stringify(err_upd));
        }
      }
      return assignmentId;
    }`;

content = content.replace(regex, newFunc);
fs.writeFileSync('test_v0.4.6-A.cjs', content);
