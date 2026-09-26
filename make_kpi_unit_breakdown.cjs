const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

let kpiStart = content.indexOf("app.all(['/api/rpc/kpi_get_dashboard_kpi_breakdown'");
let kpiEnd = content.indexOf("});", kpiStart) + 3;
let chunk = content.substring(kpiStart, kpiEnd);

// Rename to kpi_get_dashboard_kpi_unit_breakdown
chunk = chunk.replace(
    "['/api/rpc/kpi_get_dashboard_kpi_breakdown', '/api/kpi/dashboard/kpi-breakdown', '/rest/v1/rpc/kpi_get_dashboard_kpi_breakdown']",
    "['/api/rpc/kpi_get_dashboard_kpi_unit_breakdown', '/api/kpi/dashboard/kpi-unit-breakdown', '/rest/v1/rpc/kpi_get_dashboard_kpi_unit_breakdown']"
);

// We need to return an array of unit breakdowns for a specific KPI.
// So we require kpiKey.
chunk = chunk.replace(
    "const reqKpiKey = (req.query.kpi_key || req.query.p_kpi_key || req.body?.kpi_key || req.body?.p_kpi_key) as string;",
    "const reqKpiKey = (req.query.kpi_key || req.query.p_kpi_key || req.body?.kpi_key || req.body?.p_kpi_key) as string;\n  if (!reqKpiKey) return res.status(400).json({ error: 'kpi_key is required for unit breakdown' });"
);

// We group by UNIT instead of KPI.
// Inside the loop:
// const kpiKey = it.kpi_definition_id || (it.definition_snapshot?.code ? 'code:' + it.definition_snapshot.code : it.id);
// if (kpiKey !== reqKpiKey) continue;
// const uId = parentAssignment.assignee_type === 'individual' ? (parentAssignment.assignee_unit_id_snapshot || parentAssignment.assignee_organization_unit_id) : (parentAssignment.assignee_organization_unit_id || parentAssignment.assignee_unit_id_snapshot);
// const uName = parentAssignment.assignee_type === 'individual' ? parentAssignment.assignee_unit_name_snapshot : undefined; 
// let group = groupMap.get(uId);

chunk = chunk.replace(
    /let groupMap = new Map<string, any>\(\);[\s\S]+?(?=const resultMap: any = \{\})/,
    `let groupMap = new Map<string, any>();
    
    // Also we need unit data to resolve unit names
    const unitMap = new Map<string, any>();
    if (allUnits) {
       allUnits.forEach((u: any) => unitMap.set(u.id, u));
    }

    for (const it of allItems) {
      const parentAssignment = assignmentMap.get(it.assignment_id);
      if (!parentAssignment) continue;
      
      const kpiKey = it.kpi_definition_id || (it.definition_snapshot?.code ? 'code:' + it.definition_snapshot.code : it.id);
      if (kpiKey !== reqKpiKey) continue;
      
      const uId = parentAssignment.assignee_type === 'individual' 
        ? (parentAssignment.assignee_unit_id_snapshot || parentAssignment.assignee_organization_unit_id) 
        : (parentAssignment.assignee_organization_unit_id || parentAssignment.assignee_unit_id_snapshot);
        
      if (!uId) continue;
      
      let uName = parentAssignment.assignee_type === 'individual' ? parentAssignment.assignee_unit_name_snapshot : undefined;
      if (!uName && unitMap.has(uId)) uName = unitMap.get(uId).name;

      let group = groupMap.get(uId);
      if (!group) {
        group = {
          unit_id: uId,
          unit_name: uName || 'Unknown',
          assignment_ids: new Set<string>(),
          item_count: 0,
          scored_count: 0,
          partial_count: 0,
          unscored_count: 0,
          live_count: 0,
          official_count: 0,
          achievement_percents: [],
          raw_scores: [],
          weighted_scores: [],
          live_scores: [],
          official_scores: []
        };
        groupMap.set(uId, group);
      }

      group.assignment_ids.add(it.assignment_id);
      group.item_count++;

      const isLocked = parentAssignment.status === 'locked';

      if (isLocked) {
        const offRes = officialScores.get(it.id);
        if (offRes && offRes.final_weighted_score !== null && offRes.final_weighted_score !== undefined) {
          group.scored_count++;
          group.official_count++;
          group.achievement_percents.push(offRes.achievement_percent);
          group.raw_scores.push(offRes.raw_score);
          group.weighted_scores.push(offRes.final_weighted_score);
          group.official_scores.push(offRes.final_weighted_score);
        } else {
          group.unscored_count++;
        }
      } else {
        const liveRes = liveScores.get(it.id);
        if (liveRes && (liveRes.status === 'complete' || liveRes.status === 'partial')) {
          if (liveRes.status === 'complete') group.scored_count++;
          if (liveRes.status === 'partial') group.partial_count++;
          group.live_count++;
          group.achievement_percents.push(liveRes.achievement_percent);
          group.raw_scores.push(liveRes.raw_score);
          group.weighted_scores.push(liveRes.final_weighted_score);
          group.live_scores.push(liveRes.final_weighted_score);
        } else {
          group.unscored_count++;
        }
      }
    }
    `
);

chunk = chunk.replace(
    /let sortedBreakdown = Object\.values\(resultMap\);[\s\S]+?(?=return res\.json)/,
    `let sortedBreakdown = Object.values(resultMap);
    sortedBreakdown = sortedBreakdown.sort((a: any, b: any) => b.assignment_count - a.assignment_count);
    `
);

content = content + "\n\n" + chunk;
fs.writeFileSync('server.ts', content);
