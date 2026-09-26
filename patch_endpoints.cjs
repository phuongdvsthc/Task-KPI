const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// SUMMARY
let summaryStart = content.indexOf("app.all(['/api/rpc/kpi_get_dashboard_summary'");
if (summaryStart !== -1) {
    let summaryEnd = content.indexOf("});", summaryStart) + 3;
    let chunk = content.substring(summaryStart, summaryEnd);
    if (!chunk.includes("reqKpiKey")) {
        chunk = chunk.replace(
            /const effectiveTo = \(req\.query\.effective_to[^\n]+;/,
            "$&" + "\n    const reqKpiKey = (req.query.kpi_key || req.query.p_kpi_key || req.body?.kpi_key || req.body?.p_kpi_key) as string;"
        );
        chunk = chunk.replace(
            /const \{ finalAssignments, liveScoreMap, officialScoreMap \} = await applyAdvancedFiltersAndBatchResolve\(supabaseAdmin, assignments, \{ reviewStatus, completionStatus \}\);/,
            "let { finalAssignments, liveScoreMap, officialScoreMap } = await applyAdvancedFiltersAndBatchResolve(supabaseAdmin, assignments, { reviewStatus, completionStatus });\n    if (reqKpiKey) finalAssignments = await filterAssignmentsByKpiKey(supabaseAdmin, finalAssignments, reqKpiKey);"
        );
        content = content.substring(0, summaryStart) + chunk + content.substring(summaryEnd);
    }
}

// UNIT BREAKDOWN
let unitStart = content.indexOf("app.all(['/api/rpc/kpi_get_dashboard_unit_breakdown'");
if (unitStart !== -1) {
    let unitEnd = content.indexOf("});", unitStart) + 3;
    let chunk = content.substring(unitStart, unitEnd);
    if (!chunk.includes("reqKpiKey")) {
        chunk = chunk.replace(
            /const effectiveTo = \(req\.query\.effective_to[^\n]+;/,
            "$&" + "\n    const reqKpiKey = (req.query.kpi_key || req.query.p_kpi_key || req.body?.kpi_key || req.body?.p_kpi_key) as string;"
        );
        chunk = chunk.replace(
            /const \{ finalAssignments, liveScoreMap, officialScoreMap \} = await applyAdvancedFiltersAndBatchResolve\(supabaseAdmin, filteredAssignments, \{ reviewStatus, completionStatus \}\);/,
            "let { finalAssignments, liveScoreMap, officialScoreMap } = await applyAdvancedFiltersAndBatchResolve(supabaseAdmin, filteredAssignments, { reviewStatus, completionStatus });\n    if (reqKpiKey) finalAssignments = await filterAssignmentsByKpiKey(supabaseAdmin, finalAssignments, reqKpiKey);"
        );
        content = content.substring(0, unitStart) + chunk + content.substring(unitEnd);
    }
}

// ASSIGNMENTS
let asgStart = content.indexOf("app.all(['/api/rpc/kpi_get_dashboard_assignments'");
if (asgStart !== -1) {
    let asgEnd = content.indexOf("});", asgStart) + 3;
    let chunk = content.substring(asgStart, asgEnd);
    if (!chunk.includes("reqKpiKey")) {
        chunk = chunk.replace(
            /const effectiveTo = \(req\.query\.effective_to[^\n]+;/,
            "$&" + "\n    const reqKpiKey = (req.query.kpi_key || req.query.p_kpi_key || req.body?.kpi_key || req.body?.p_kpi_key) as string;"
        );
        chunk = chunk.replace(
            /const \{ finalAssignments, liveScoreMap, officialScoreMap, revMap \} = await applyAdvancedFiltersAndBatchResolve\(supabaseAdmin, filteredAssignments, \{ reviewStatus, completionStatus \}\);/,
            "let { finalAssignments, liveScoreMap, officialScoreMap, revMap } = await applyAdvancedFiltersAndBatchResolve(supabaseAdmin, filteredAssignments, { reviewStatus, completionStatus });\n    if (reqKpiKey) finalAssignments = await filterAssignmentsByKpiKey(supabaseAdmin, finalAssignments, reqKpiKey);"
        );
        content = content.substring(0, asgStart) + chunk + content.substring(asgEnd);
    }
}

// KPI BREAKDOWN
let kpiStart = content.indexOf("app.all(['/api/rpc/kpi_get_dashboard_kpi_breakdown'");
if (kpiStart !== -1) {
    let kpiEnd = content.indexOf("});", kpiStart) + 3;
    let chunk = content.substring(kpiStart, kpiEnd);
    if (!chunk.includes("reqKpiKey")) {
        chunk = chunk.replace(
            /const effectiveTo = \(req\.query\.effective_to[^\n]+;/,
            "$&" + "\n    const reqKpiKey = (req.query.kpi_key || req.query.p_kpi_key || req.body?.kpi_key || req.body?.p_kpi_key) as string;"
        );
        chunk = chunk.replace(
            /const sortedBreakdown = Object\.values\(resultMap\).sort/,
            "let sortedBreakdown = Object.values(resultMap);\n    if (reqKpiKey) sortedBreakdown = sortedBreakdown.filter(b => b.kpi_key === reqKpiKey);\n    sortedBreakdown = sortedBreakdown.sort"
        );
        content = content.substring(0, kpiStart) + chunk + content.substring(kpiEnd);
    }
}

fs.writeFileSync('server.ts', content);
