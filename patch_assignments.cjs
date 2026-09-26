const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// For Assignments API
const assignFrom = `    let filteredAssignments = Array.from(assignmentMap.values());

    if (search) {
      const s = search.toLowerCase();
      filteredAssignments = filteredAssignments.filter(a => {
        const uName = a.assignee_type === 'individual' ? a.snapshot_unit?.name : a.assignee_unit?.name;
        const userName = a.assignee_user?.full_name || '';
        return (userName && userName.toLowerCase().includes(s)) ||
               (uName && uName.toLowerCase().includes(s));
      });
    }

    const totalCount = filteredAssignments.length;
    const pageAssignments = filteredAssignments.slice(offset, offset + limit);

    // Batch resolve reviews for page
    const pageIds = pageAssignments.map(a => a.id);
    const revMap = new Map<string, any>();
    if (pageIds.length > 0) {
      try {
        const { data: reviews } = await supabaseAdmin
          .from('kpi_assignment_reviews')
          .select('id, assignment_id, status, official_total_score')
          .in('assignment_id', pageIds);
        (reviews || []).forEach((r: any) => revMap.set(r.assignment_id, r));
      } catch {
        // Fallback to a.config.review if table not available
      }
    }

    const liveAssignments = pageAssignments.filter(a => a.status !== 'locked');
    const officialAssignments = pageAssignments.filter(a => a.status === 'locked');

    // Batch resolve scores (No N+1 queries)
    const liveScoreMap = await resolveLiveScoresBatch(supabaseAdmin, liveAssignments);
    const officialScoreMap = await resolveOfficialScoresBatch(supabaseAdmin, officialAssignments);

    const results = pageAssignments.map(a => {
      const isLocked = a.status === 'locked';
      const rev = revMap.get(a.id);
      let reviewStatus: string | null = rev?.status || a.config?.review?.status || null;
      if (!reviewStatus && isLocked) {
        reviewStatus = 'approved';
      }`;

const assignTo = `    let filteredAssignments = Array.from(assignmentMap.values());

    if (search) {
      const s = search.toLowerCase();
      filteredAssignments = filteredAssignments.filter(a => {
        const uName = a.assignee_type === 'individual' ? a.snapshot_unit?.name : a.assignee_unit?.name;
        const userName = a.assignee_user?.full_name || '';
        return (userName && userName.toLowerCase().includes(s)) ||
               (uName && uName.toLowerCase().includes(s));
      });
    }

    const { finalAssignments, liveScoreMap, officialScoreMap, revMap } = await applyAdvancedFiltersAndBatchResolve(supabaseAdmin, filteredAssignments, { reviewStatus, completionStatus });

    const totalCount = finalAssignments.length;
    const pageAssignments = finalAssignments.slice(offset, offset + limit);

    const results = pageAssignments.map(a => {
      const isLocked = a.status === 'locked';
      const rev = revMap.get(a.id);
      let rs = rev?.status || a.config?.review?.status || null;
      if (!rs && isLocked) rs = 'approved';
      if (!rs) rs = 'not_started';
      let reviewStatus: string | null = rs;`;

content = content.replace(assignFrom, assignTo);

// For KPI Breakdown API
const kpiFrom = `    const assignments = Array.from(assignmentMap.values());

    const liveAssignments = assignments.filter(a => a.status !== 'locked');
    const officialAssignments = assignments.filter(a => a.status === 'locked');

    // Resolve scores
    const liveScoreMap = await resolveLiveScoresBatch(supabaseAdmin, liveAssignments);
    const officialScoreMap = await resolveOfficialScoresBatch(supabaseAdmin, officialAssignments);

    // Filter items
    const kpiMap = new Map<string, KpiDashboardKpiBreakdown>();

    for (const a of assignments) {`;

const kpiTo = `    const assignments = Array.from(assignmentMap.values());

    const { finalAssignments, liveScoreMap, officialScoreMap } = await applyAdvancedFiltersAndBatchResolve(supabaseAdmin, assignments, { reviewStatus, completionStatus });

    // Filter items
    const kpiMap = new Map<string, KpiDashboardKpiBreakdown>();

    for (const a of finalAssignments) {`;

content = content.replace(kpiFrom, kpiTo);

fs.writeFileSync('server.ts', content);
