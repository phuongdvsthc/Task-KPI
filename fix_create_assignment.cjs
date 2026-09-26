const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

const regex = /async function createTestAssignment[\s\S]*?return assignmentId;\n    \}/;

const newFunc = `async function createTestAssignment(assigneeId, assigneeType, missingActual, isLocked) {
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
        status: isLocked ? 'locked' : 'active',
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        notes: missingActual ? 'partial' : 'complete',
        created_by: uAdmin
      });
      if (asgnErr) throw new Error("Insert asgn failed: " + JSON.stringify(asgnErr));

      const { data: autoItems } = await supabase.from('kpi_assignment_items').select('id, kpi_definition_id').eq('assignment_id', assignmentId);
      if (!autoItems || autoItems.length === 0) throw new Error("autoItems is empty for " + assignmentId);
      
      const itemId1 = autoItems.find(i => i.kpi_definition_id === def1Id).id;
      const itemId2 = autoItems.find(i => i.kpi_definition_id === def2Id).id;

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
        const reviewSnapshot = { id: crypto.randomUUID(), assignment_id: assignmentId, status: 'approved', official_total_score: 80 };
        const items = [
          { score_snapshot: { weight: 60, score_result: { status: 'scored', raw_score: 100, weighted_score: 60 } }, final_weighted_score: 60 },
          { score_snapshot: { weight: 40, score_result: { status: 'scored', raw_score: 50, weighted_score: 20 } }, final_weighted_score: 20 }
        ];
        await supabase.from('kpi_assignments').update({
          config: { review: reviewSnapshot, review_items: items, official_result: { total_score: 80 } }
        }).eq('id', assignmentId);
      }
      return assignmentId;
    }`;

content = content.replace(regex, newFunc);
fs.writeFileSync('test_v0.4.6-A.cjs', content);
