const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// First, remove the malformed endpoint
const startStr = "app.all(['/api/rpc/kpi_get_dashboard_kpi_unit_breakdown'";
let start = content.indexOf(startStr);
if (start !== -1) {
    let end = content.indexOf("if (process.env.NODE_ENV !== 'production') {", start);
    content = content.substring(0, start) + content.substring(end);
}

// Ensure the startServer is closed correctly if not already
// it seems it was:

const newEndpoint = `
app.all(['/api/rpc/kpi_get_dashboard_kpi_unit_breakdown', '/api/kpi/dashboard/kpi-unit-breakdown', '/rest/v1/rpc/kpi_get_dashboard_kpi_unit_breakdown'], authenticateUser, async (req: Request, res: Response) => {
  const periodId = req.query.period_id || req.query.p_period_id || req.body?.period_id || req.body?.p_period_id;
  const unitId = req.query.unit_id || req.query.p_unit_id || req.body?.unit_id || req.body?.p_unit_id;
  const assignmentStatus = req.query.assignment_status || req.query.p_assignment_status || req.body?.assignment_status || req.body?.p_assignment_status;
  const resultMode = (req.query.result_mode || req.query.p_result_mode || req.body?.result_mode || req.body?.p_result_mode || 'all').toString().toLowerCase();    
  const assigneeType = (req.query.assignee_type || req.query.p_assignee_type || req.body?.assignee_type || req.body?.p_assignee_type) as string;
  const reviewStatus = (req.query.review_status || req.query.p_review_status || req.body?.review_status || req.body?.p_review_status) as string;
  const completionStatus = (req.query.completion_status || req.query.p_completion_status || req.body?.completion_status || req.body?.p_completion_status) as string;
  const effectiveFrom = (req.query.effective_from || req.query.p_effective_from || req.body?.effective_from || req.body?.p_effective_from) as string;
  const effectiveTo = (req.query.effective_to || req.query.p_effective_to || req.body?.effective_to || req.body?.p_effective_to) as string;
  const reqKpiKey = (req.query.kpi_key || req.query.p_kpi_key || req.body?.kpi_key || req.body?.p_kpi_key) as string;

  if (!reqKpiKey) return res.status(400).json({ error: 'kpi_key is required for unit breakdown' });
  if (!periodId) return res.status(400).json({ error: 'period_id is required' });

  try {
    const supabaseAdmin = res.locals.supabaseAdmin || getSupabaseAdminClient(req);
    const userId = res.locals.user?.id;
    const profile = res.locals.profile;
    if (!supabaseAdmin) return res.status(500).json({ error: 'Database unavailable' });

    const userRole = profile?.system_role;
    if (userRole !== 'manager' && userRole !== 'admin' && userRole !== 'executive') {
      return res.status(403).json({ error: 'access_denied', message: 'Staff users are not authorized to access Manager Dashboard' });
    }

    const scopeData = await resolveManagerScopeUnits(supabaseAdmin, userId, userRole);
    if (!scopeData) return res.status(403).json({ error: 'access_denied' });

    let allowedUnitIds = scopeData.scopeUnitIds;
    if (unitId) {
      if (!allowedUnitIds.has(unitId as string)) {
        return res.status(403).json({ error: 'access_denied', message: 'Requested unit is outside your scope' });
      }
      const { data: allUnits } = await supabaseAdmin.from('organization_units').select('id, parent_id');
      const requestedScope = getDescendantUnitIds(allUnits || [], unitId as string);
      allowedUnitIds = new Set([...allowedUnitIds].filter(x => requestedScope.has(x)));
    }
    const allowedUnitsArr = Array.from(allowedUnitIds);
    if (allowedUnitsArr.length === 0) return res.json([]);

    let query = supabaseAdmin.from('kpi_assignments')
      .select(\`
        id, period_id, template_id, status, assignee_type, assignee_user_id, assignee_organization_unit_id,
        assignee_unit_name_snapshot, assignee_unit_id_snapshot,
        effective_from, effective_to,
        config
      \`)
      .eq('period_id', periodId)
      .or(\`assignee_unit_id_snapshot.in.(\${allowedUnitsArr.join(',')}),assignee_organization_unit_id.in.(\${allowedUnitsArr.join(',')})\`);

    if (assigneeType && assigneeType !== 'all') query = query.eq('assignee_type', assigneeType);
    if (assignmentStatus && assignmentStatus !== 'all') {
      query = query.eq('status', assignmentStatus);
    } else {
      query = query.not('status', 'eq', 'draft');
    }
    if (resultMode === 'live') query = query.not('status', 'eq', 'locked');
    else if (resultMode === 'official') query = query.eq('status', 'locked');
    if (effectiveFrom) query = query.or(\`effective_to.gte.\${effectiveFrom},effective_to.is.null\`);
    if (effectiveTo) query = query.or(\`effective_from.lte.\${effectiveTo},effective_from.is.null\`);

    const { data: rawAssignments, error: asgnErr } = await query;
    if (asgnErr) throw asgnErr;

    const assignmentMap = new Map<string, any>();
    for (const a of (rawAssignments || [])) {
      const targetUnitId = a.assignee_type === 'individual'
        ? (a.assignee_unit_id_snapshot || a.assignee_organization_unit_id)
        : (a.assignee_organization_unit_id || a.assignee_unit_id_snapshot);
      if (!targetUnitId || !allowedUnitIds.has(targetUnitId)) continue;
      assignmentMap.set(a.id, a);
    }

    let assignments = Array.from(assignmentMap.values());
    if (assignments.length === 0) return res.json([]);
    
    // Filter assignments that have reviews if necessary
    let { finalAssignments, liveScoreMap, officialScoreMap } = await applyAdvancedFiltersAndBatchResolve(supabaseAdmin, assignments, { reviewStatus, completionStatus });
    assignments = finalAssignments;
    if (assignments.length === 0) return res.json([]);

    const assignmentIds = assignments.map(a => a.id);
    const { data: allItems, error: itemsErr } = await supabaseAdmin
      .from('kpi_assignment_items')
      .select(\`
        id, assignment_id, kpi_definition_id, weight, cap_percent, target_config, scoring_config, definition_snapshot,
        definition:kpi_definition_id(id, code, name, unit_code, measurement_type, direction, default_scoring_method)
      \`)
      .in('assignment_id', assignmentIds);
    if (itemsErr) throw itemsErr;
    if (!allItems || allItems.length === 0) return res.json([]);

    const { data: allUnits } = await supabaseAdmin.from('organization_units').select('id, name');
    const unitMap = new Map<string, any>();
    (allUnits || []).forEach((u: any) => unitMap.set(u.id, u));

    let groupMap = new Map<string, any>();

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
      
      const reviewItem = parentAssignment.config?.review_items?.find((ri: any) => ri.assignment_item_id === it.id);
      const configReviewItem = parentAssignment.config?.review?.items?.find((ri: any) => ri.assignment_item_id === it.id);
      
      let rawScore: number | null = null;
      let weightedScore: number | null = null;
      let achPercent: number | null = null;
      let isScored = false;

      // Extremely simplified scorer resolver for dashboard (similar to kpi_breakdown)
      if (reviewItem) {
        if (reviewItem.final_raw_score !== null && reviewItem.final_raw_score !== undefined) {
          rawScore = Number(reviewItem.final_raw_score);
          weightedScore = Number(reviewItem.final_weighted_score ?? (rawScore * (Number(it.weight) || 0)) / 100);
          achPercent = reviewItem.final_achievement_percent !== null && reviewItem.final_achievement_percent !== undefined ? Number(reviewItem.final_achievement_percent) : rawScore;
          isScored = true;
        } else if (reviewItem.score_snapshot?.score_result?.raw_score !== undefined) {
          rawScore = Number(reviewItem.score_snapshot.score_result.raw_score);
          weightedScore = Number(reviewItem.score_snapshot.score_result.weighted_score ?? (rawScore * (Number(it.weight) || 0)) / 100);
          achPercent = Number(reviewItem.score_snapshot.score_result.achievement_percent ?? rawScore);
          isScored = true;
        }
      }
      if (!isScored && configReviewItem) {
        const snapScore = configReviewItem.score_snapshot?.score_result;
        if (configReviewItem.final_raw_score !== null && configReviewItem.final_raw_score !== undefined) {
          rawScore = Number(configReviewItem.final_raw_score);
          weightedScore = Number(configReviewItem.final_weighted_score ?? (rawScore * (Number(it.weight) || 0)) / 100);
          achPercent = Number(configReviewItem.final_achievement_percent ?? rawScore);
          isScored = true;
        } else if (snapScore && snapScore.raw_score !== undefined) {
          rawScore = Number(snapScore.raw_score);
          weightedScore = Number(snapScore.weighted_score ?? (rawScore * (Number(it.weight) || 0)) / 100);
          achPercent = Number(snapScore.achievement_percent ?? rawScore);
          isScored = true;
        }
      }

      if (isScored && rawScore !== null) {
        if (isLocked) {
          group.scored_count++;
          group.official_count++;
          group.official_scores.push(rawScore);
        } else {
          group.live_count++;
          group.scored_count++; // Simplifying for dashboard unit coverage
          group.live_scores.push(rawScore);
        }
      } else {
        group.unscored_count++;
      }
    }

    let sortedBreakdown = Object.values(Object.fromEntries(groupMap)).map((g: any) => {
        const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
        g.live_average_score = avg(g.live_scores);
        g.official_average_score = avg(g.official_scores);
        g.assignment_count = g.assignment_ids.size;
        delete g.assignment_ids;
        delete g.live_scores;
        delete g.official_scores;
        delete g.achievement_percents;
        delete g.raw_scores;
        delete g.weighted_scores;
        return g;
    });

    sortedBreakdown = sortedBreakdown.sort((a: any, b: any) => b.assignment_count - a.assignment_count);
    return res.json(sortedBreakdown);

  } catch (err: any) {
    console.error('[API kpi_get_dashboard_kpi_unit_breakdown] Error:', err);
    res.status(500).json({ error: err.message });
  }
});
`;

const viteIdx = content.indexOf("if (process.env.NODE_ENV !== 'production') {");
content = content.substring(0, viteIdx) + newEndpoint + "\n" + content.substring(viteIdx);

fs.writeFileSync('server.ts', content);
