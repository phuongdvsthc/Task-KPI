const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const anchor = "app.all(['/api/rpc/kpi_get_official_assignment_result'";

const dashboardCode = `
// ==========================================
// V0.4.6-A KPI DASHBOARD AGGREGATION APIs
// ==========================================

function getDescendantUnitIds(allUnits: any[], rootUnitId: string): Set<string> {
  const scopeUnitIds = new Set<string>([rootUnitId]);
  let added = true;
  while (added) {
    added = false;
    for (const u of allUnits) {
      if (u.parent_id && scopeUnitIds.has(u.parent_id) && !scopeUnitIds.has(u.id)) {
        scopeUnitIds.add(u.id);
        added = true;
      }
    }
  }
  return scopeUnitIds;
}

app.get(['/api/rpc/kpi_get_dashboard_summary', '/api/kpi/dashboard/summary'], authenticateUser, async (req: Request, res: Response) => {
  try {
    const { period_id, unit_id, assignee_type } = req.query;
    if (!period_id) return res.status(400).json({ error: 'Missing period_id' });

    const supabaseAdmin = res.locals.supabaseAdmin;
    const userId = res.locals.user.id;
    const profile = res.locals.profile;

    const scopeData = await resolveManagerScopeUnits(supabaseAdmin, userId, profile.system_role);
    if (!scopeData) return res.status(403).json({ error: 'access_denied' });
    let allowedUnitIds = scopeData.scopeUnitIds;

    if (unit_id) {
      if (!allowedUnitIds.has(unit_id as string)) {
        return res.status(403).json({ error: 'access_denied', message: 'Requested unit is outside your scope' });
      }
      const { data: allUnits } = await supabaseAdmin.from('organization_units').select('id, parent_id');
      const requestedScope = getDescendantUnitIds(allUnits || [], unit_id as string);
      allowedUnitIds = new Set([...allowedUnitIds].filter(x => requestedScope.has(x)));
    }

    const allowedUnitsArr = Array.from(allowedUnitIds);
    if (allowedUnitsArr.length === 0) {
      return res.json({
        assignment_count: 0, active_count: 0, locked_count: 0,
        complete_count: 0, partial_count: 0, no_data_count: 0,
        live_average_score: 0, official_average_score: 0
      });
    }

    let query = supabaseAdmin.from('kpi_assignments')
      .select('*')
      .eq('period_id', period_id)
      .not('status', 'eq', 'draft')
      .or(\`assignee_unit_id_snapshot.in.(\${allowedUnitsArr.join(',')}),assignee_organization_unit_id.in.(\${allowedUnitsArr.join(',')})\`);

    if (assignee_type) {
      query = query.eq('assignee_type', assignee_type);
    }

    const { data: assignments, error } = await query;
    if (error) throw error;

    let active_count = 0;
    let locked_count = 0;
    let complete_count = 0;
    let partial_count = 0;
    let no_data_count = 0;
    
    let liveSum = 0;
    let liveCount = 0;
    let officialSum = 0;
    let officialCount = 0;

    // Batch resolve live scores in parallel backend calls
    const liveAssignments = assignments.filter(a => a.status !== 'locked');
    const liveScores = await Promise.all(liveAssignments.map(a => 
      supabaseAdmin.rpc('kpi_resolve_assignment_score', { p_assignment_id: a.id })
    ));

    const liveScoreMap = new Map();
    liveAssignments.forEach((a, i) => liveScoreMap.set(a.id, liveScores[i].data));

    for (const a of assignments) {
      let isLocked = a.status === 'locked';
      if (isLocked) locked_count++; else active_count++;

      let totalScore = 0;
      let totalW = 0;
      let scoredW = 0;

      if (isLocked) {
        // Read from official config snapshot
        totalScore = a.config?.official_result?.total_score || 0;
        officialSum += totalScore;
        officialCount++;
        
        const reviewItems = a.config?.review_items || [];
        totalW = reviewItems.reduce((acc: number, item: any) => acc + (item.score_snapshot?.weight || 0), 0);
        scoredW = reviewItems.reduce((acc: number, item: any) => acc + (item.score_snapshot?.score_result?.status === 'scored' ? item.score_snapshot.weight : 0), 0);
      } else {
        const liveRes = liveScoreMap.get(a.id);
        if (liveRes && liveRes.status !== 'error') {
          totalScore = liveRes.total_score || 0;
          totalW = liveRes.total_weight || 0;
          scoredW = liveRes.scored_weight || 0;
          
          liveSum += totalScore;
          liveCount++;
        }
      }

      if (scoredW === 0 && totalW > 0) {
        no_data_count++;
      } else if (scoredW > 0 && scoredW < totalW) {
        partial_count++;
      } else if (scoredW > 0 && scoredW === totalW) {
        complete_count++;
      } else if (totalW === 0) {
        no_data_count++;
      }
    }

    res.json({
      assignment_count: assignments.length,
      active_count,
      locked_count,
      complete_count,
      partial_count,
      no_data_count,
      live_average_score: liveCount > 0 ? liveSum / liveCount : 0,
      official_average_score: officialCount > 0 ? officialSum / officialCount : 0
    });
  } catch (err: any) {
    console.error('[API kpi_get_dashboard_summary] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/rpc/kpi_get_dashboard_assignments', '/api/kpi/dashboard/assignments'], authenticateUser, async (req: Request, res: Response) => {
  try {
    const { period_id, unit_id, assignee_type } = req.query;
    if (!period_id) return res.status(400).json({ error: 'Missing period_id' });

    const supabaseAdmin = res.locals.supabaseAdmin;
    const userId = res.locals.user.id;
    const profile = res.locals.profile;

    const scopeData = await resolveManagerScopeUnits(supabaseAdmin, userId, profile.system_role);
    if (!scopeData) return res.status(403).json({ error: 'access_denied' });
    let allowedUnitIds = scopeData.scopeUnitIds;

    if (unit_id) {
      if (!allowedUnitIds.has(unit_id as string)) {
        return res.status(403).json({ error: 'access_denied', message: 'Requested unit is outside your scope' });
      }
      const { data: allUnits } = await supabaseAdmin.from('organization_units').select('id, parent_id');
      const requestedScope = getDescendantUnitIds(allUnits || [], unit_id as string);
      allowedUnitIds = new Set([...allowedUnitIds].filter(x => requestedScope.has(x)));
    }

    const allowedUnitsArr = Array.from(allowedUnitIds);
    if (allowedUnitsArr.length === 0) return res.json([]);

    let query = supabaseAdmin.from('kpi_assignments')
      .select('*, assignee_user:assignee_user_id(full_name), assignee_unit:assignee_organization_unit_id(name), snapshot_unit:assignee_unit_id_snapshot(name)')
      .eq('period_id', period_id)
      .not('status', 'eq', 'draft')
      .or(\`assignee_unit_id_snapshot.in.(\${allowedUnitsArr.join(',')}),assignee_organization_unit_id.in.(\${allowedUnitsArr.join(',')})\`);

    if (assignee_type) {
      query = query.eq('assignee_type', assignee_type);
    }

    const { data: assignments, error } = await query;
    if (error) throw error;

    const liveAssignments = assignments.filter(a => a.status !== 'locked');
    const liveScores = await Promise.all(liveAssignments.map(a => 
      supabaseAdmin.rpc('kpi_resolve_assignment_score', { p_assignment_id: a.id })
    ));
    const liveScoreMap = new Map();
    liveAssignments.forEach((a, i) => liveScoreMap.set(a.id, liveScores[i].data));

    const results = assignments.map(a => {
      const isLocked = a.status === 'locked';
      let totalScore = 0;
      let totalW = 0;
      let scoredW = 0;
      
      if (isLocked) {
        totalScore = a.config?.official_result?.total_score || 0;
        const reviewItems = a.config?.review_items || [];
        totalW = reviewItems.reduce((acc: number, item: any) => acc + (item.score_snapshot?.weight || 0), 0);
        scoredW = reviewItems.reduce((acc: number, item: any) => acc + (item.score_snapshot?.score_result?.status === 'scored' ? item.score_snapshot.weight : 0), 0);
      } else {
        const liveRes = liveScoreMap.get(a.id);
        if (liveRes && liveRes.status !== 'error') {
          totalScore = liveRes.total_score || 0;
          totalW = liveRes.total_weight || 0;
          scoredW = liveRes.scored_weight || 0;
        }
      }

      let resStatus = 'no_data';
      if (scoredW > 0 && scoredW < totalW) resStatus = 'partial';
      if (scoredW > 0 && scoredW === totalW) resStatus = 'complete';

      let assigneeName = '';
      if (a.assignee_type === 'individual') assigneeName = a.assignee_user?.full_name || '';
      else if (a.assignee_type === 'organization') assigneeName = a.assignee_unit?.name || '';

      let unitName = a.assignee_type === 'individual' ? a.snapshot_unit?.name : a.assignee_unit?.name;

      return {
        id: a.id,
        period_id: a.period_id,
        assignee_type: a.assignee_type,
        assignee_name: assigneeName,
        unit_name: unitName,
        status: a.status,
        review_status: a.config?.review?.status || null,
        result_mode: isLocked ? 'official' : 'live',
        total_score: totalScore,
        total_weight: totalW,
        scored_weight: scoredW,
        unscored_weight: totalW - scoredW,
        result_status: resStatus
      };
    });

    res.json(results);
  } catch (err: any) {
    console.error('[API kpi_get_dashboard_assignments] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

`;

const newContent = content.replace(anchor, dashboardCode + "\n" + anchor);
fs.writeFileSync('server.ts', newContent);
console.log("Injected");
