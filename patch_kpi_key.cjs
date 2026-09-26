const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// Insert the helper function
const helperFn = `
async function filterAssignmentsByKpiKey(supabaseAdmin: any, assignments: any[], kpiKey: string) {
  if (!kpiKey || !assignments || assignments.length === 0) return assignments;
  const assignmentIds = assignments.map(a => a.id);
  const { data: matchedItems } = await supabaseAdmin
    .from('kpi_assignment_items')
    .select('assignment_id, kpi_definition_id, id, definition_snapshot')
    .in('assignment_id', assignmentIds);
  const matchedAsgIds = new Set();
  (matchedItems || []).forEach((it: any) => {
    const key = it.kpi_definition_id || (it.definition_snapshot?.code ? 'code:' + it.definition_snapshot.code : it.id);
    if (key === kpiKey) matchedAsgIds.add(it.assignment_id);
  });
  return assignments.filter(a => matchedAsgIds.has(a.id));
}
`;

if (!content.includes('filterAssignmentsByKpiKey')) {
    content = content.replace(
        "async function applyAdvancedFiltersAndBatchResolve",
        helperFn + "\nasync function applyAdvancedFiltersAndBatchResolve"
    );
}

// Update summary
content = content.replace(
    /const effectiveTo = \(req\.query\.effective_to \|\| req\.query\.p_effective_to \|\| req\.body\?\.effective_to \|\| req\.body\?\.p_effective_to\) as string;/,
    `const effectiveTo = (req.query.effective_to || req.query.p_effective_to || req.body?.effective_to || req.body?.p_effective_to) as string;
    const reqKpiKey = (req.query.kpi_key || req.query.p_kpi_key || req.body?.kpi_key || req.body?.p_kpi_key) as string;`
);

// We need to be careful with the replacements. Let's do it individually for each endpoint.
fs.writeFileSync('server.ts', content);
