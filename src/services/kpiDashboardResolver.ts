
export async function resolveLiveScoresBatch(
  supabaseAdmin: any,
  liveAssignments: any[]
): Promise<{ 
  liveScoreMap: Map<string, { total_score: number; status: string; total_weight: number; scored_weight: number }>,
  liveItemsMap: Map<string, any[]>
}> {
  const liveScoreMap = new Map<string, { total_score: number; status: string; total_weight: number; scored_weight: number }>();
  const liveItemsMap = new Map<string, any[]>();
  if (!liveAssignments || liveAssignments.length === 0) return { liveScoreMap, liveItemsMap };

  const liveAssignmentIds = liveAssignments.map(a => a.id);

  const { data: allItems, error: itemsErr } = await supabaseAdmin
    .from('kpi_assignment_items')
    .select('*, definition:kpi_definition_id(measurement_type, direction, default_scoring_method)')
    .in('assignment_id', liveAssignmentIds);

  if (itemsErr) throw itemsErr;

  const itemsByAssignment = new Map<string, any[]>();
  const allItemIds: string[] = [];

  for (const it of (allItems || [])) {
    allItemIds.push(it.id);
    const list = itemsByAssignment.get(it.assignment_id) || [];
    list.push(it);
    itemsByAssignment.set(it.assignment_id, list);
  }

  const actualsMap = new Map<string, number>();
  if (allItemIds.length > 0) {
    const { data: actualEntries, error: actErr } = await supabaseAdmin
      .from('kpi_manual_actual_entries')
      .select('assignment_item_id, value_numeric, entered_at')
      .in('assignment_item_id', allItemIds)
      .order('entered_at', { ascending: false });

    if (!actErr && actualEntries) {
      for (const entry of actualEntries) {
        if (!actualsMap.has(entry.assignment_item_id) && entry.value_numeric !== null && entry.value_numeric !== undefined) {
          actualsMap.set(entry.assignment_item_id, Number(entry.value_numeric));
        }
      }
    }
  }

  for (const a of liveAssignments) {
    const items = itemsByAssignment.get(a.id) || [];
    let tw = 0;
    let sw = 0;
    let ts = 0;
    let hasMissing = false;

    for (const it of items) {
      const weight = Number(it.weight) || 0;
      tw += weight;

      const direction = it.direction || it.definition?.direction || 'higher_is_better';
      const method = it.scoring_method || it.definition?.default_scoring_method || 'linear';
      const measurementType = it.measurement_type || it.definition?.measurement_type || 'number';
      it.direction = direction;
      it.scoring_method = method;
      it.measurement_type = measurementType;

      const rawTargetVal = it.target_config?.target_value;
      const isTargetConfigInvalid = it.target_config?.status === 'invalid_target' ||
        it.config?.status === 'invalid_target' ||
        (measurementType !== 'boolean' && (rawTargetVal === undefined || rawTargetVal === null || rawTargetVal === '' || isNaN(Number(rawTargetVal))));
      const scoringConfig = it.scoring_config || (it.bands_config ? { bands: it.bands_config } : null);
      const isScoringConfigInvalid = it.scoring_config?.status === 'invalid_config' || 
        it.config?.status === 'invalid_config' ||
        (method === 'bands' && (!Array.isArray(scoringConfig?.bands) || scoringConfig.bands.length === 0));
      const isMethodUnsupported = method === 'unsupported_method' || it.scoring_config?.method === 'unsupported_method';

      if (isTargetConfigInvalid) {
        it.resolved_is_scored = false;
        it.scoring_status = 'invalid_target';
        it.status_reason = 'invalid_target';
        it.attainment_state = 'invalid_target';
        it.resolved_gap = null;
        it.resolved_ach = null;
        it.resolved_raw = null;
        it.resolved_weighted = null;
        it.resolved_actual = actualsMap.get(it.id) ?? null;
        hasMissing = true;
        continue;
      }

      if (isScoringConfigInvalid) {
        it.resolved_is_scored = false;
        it.scoring_status = 'invalid_config';
        it.status_reason = 'invalid_config';
        it.attainment_state = 'invalid_config';
        it.resolved_gap = null;
        it.resolved_ach = null;
        it.resolved_raw = null;
        it.resolved_weighted = null;
        it.resolved_actual = actualsMap.get(it.id) ?? null;
        hasMissing = true;
        continue;
      }

      if (isMethodUnsupported) {
        it.resolved_is_scored = false;
        it.scoring_status = 'unsupported_method';
        it.status_reason = 'unsupported_method';
        it.attainment_state = 'unsupported_method';
        it.resolved_gap = null;
        it.resolved_ach = null;
        it.resolved_raw = null;
        it.resolved_weighted = null;
        it.resolved_actual = actualsMap.get(it.id) ?? null;
        hasMissing = true;
        continue;
      }

      if (actualsMap.has(it.id)) {
        sw += weight;
        const target = Number(rawTargetVal);
        const actual = actualsMap.get(it.id)!;
        let rawAch = 0;
        if (measurementType === 'boolean') {
          rawAch = (actual === 1 || (actual as any) === true || String(actual) === '1' || String(actual).toLowerCase() === 'true') ? 100 : 0;
        } else if (direction === 'lower_is_better') {
          rawAch = actual === 0 ? 100 : (target / actual) * 100;
        } else if (direction === 'exact_target') {
          rawAch = actual === target ? 100 : 0;
        } else {
          rawAch = (actual / (target === 0 ? 1 : target)) * 100;
        }

        let ach = rawAch;
        if (it.cap_percent !== null && it.cap_percent !== undefined) {
          ach = Math.min(rawAch, Number(it.cap_percent));
        }

        let rawScore = ach;
        const scoringConfig = it.scoring_config;
        if (method === 'bands' && Array.isArray(scoringConfig?.bands)) {
          let matchedBand: any = null;
          for (const b of scoringConfig.bands) {
            const bMin = Number(b.min_percent);
            if (ach >= bMin) {
              if (!matchedBand || bMin > Number(matchedBand.min_percent)) {
                matchedBand = b;
              }
            }
          }
          rawScore = matchedBand ? Number(matchedBand.score) : 0;
        }

        const weightedScore = (rawScore * weight) / 100.0;
        ts += weightedScore;
        it.resolved_ach = ach;
        it.resolved_raw = rawScore;
        it.resolved_weighted = weightedScore;
        it.resolved_actual = actual;
        it.resolved_is_scored = true;
        it.scoring_status = 'scored';
        it.status_reason = null;

        // Authoritative attainment state and gap
        let attainmentState: 'achieved' | 'exceeded' | 'under_target' = 'under_target';
        let gap: number | null = null;

        if (measurementType === 'boolean') {
          attainmentState = rawScore >= 100 ? 'achieved' : 'under_target';
          gap = null;
        } else if (direction === 'lower_is_better') {
          if (actual <= target) {
            attainmentState = actual < target ? 'exceeded' : 'achieved';
            gap = 0;
          } else {
            attainmentState = 'under_target';
            gap = actual - target;
          }
        } else if (direction === 'exact_target') {
          if (actual === target) {
            attainmentState = 'achieved';
            gap = 0;
          } else {
            attainmentState = 'under_target';
            gap = Math.abs(actual - target);
          }
        } else {
          if (actual >= target) {
            attainmentState = actual > target ? 'exceeded' : 'achieved';
            gap = 0;
          } else {
            attainmentState = 'under_target';
            gap = target - actual;
          }
        }

        it.attainment_state = attainmentState;
        it.resolved_gap = gap;
      } else {
        it.resolved_is_scored = false;
        it.scoring_status = 'not_scored';
        it.status_reason = 'actual_not_available';
        it.attainment_state = 'not_scored';
        it.resolved_actual = null;
        it.resolved_gap = null;
        it.resolved_ach = null;
        it.resolved_raw = null;
        it.resolved_weighted = null;
        hasMissing = true;
      }
    }

    let st = 'complete';
    liveItemsMap.set(a.id, items);
    if (sw === 0) {
      st = 'not_scored';
    } else if (hasMissing || sw < tw) {
      st = 'partial';
    }

    liveScoreMap.set(a.id, {
      total_score: Math.round(ts * 10000) / 10000,
      status: st,
      total_weight: tw,
      scored_weight: sw
    });
  }

  return { liveScoreMap, liveItemsMap };
}



export async function filterAssignmentsByKpiKey(supabaseAdmin: any, assignments: any[], kpiKey: string) {
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

export async function applyAdvancedFiltersAndBatchResolve(supabaseAdmin: any, assignments: any[], filters: any) {
  let filtered = [...assignments];
  const { reviewStatus, completionStatus } = filters;

  const allIds = filtered.map(a => a.id);
  const revMap = new Map<string, any>();
  if (allIds.length > 0) {
    try {
      // Chunking to be safe if large, but we'll do 1 query for now
      const { data: reviews } = await supabaseAdmin
        .from('kpi_assignment_reviews')
        .select('id, assignment_id, status, official_total_score')
        .in('assignment_id', allIds);
      (reviews || []).forEach((r: any) => revMap.set(r.assignment_id, r));
    } catch (e) {
      // Fallback
    }
  }

  if (reviewStatus && reviewStatus !== 'all') {
    filtered = filtered.filter(a => {
      const isLocked = a.status === 'locked';
      const rev = revMap.get(a.id);
      let rs = rev?.status || a.config?.review?.status || null;
      if (!rs && isLocked) rs = 'approved';
      if (!rs) rs = 'not_started';
      return rs === reviewStatus;
    });
  }

  const liveAssignments = filtered.filter(a => a.status !== 'locked');
  const officialAssignments = filtered.filter(a => a.status === 'locked');
  
  const { liveScoreMap, liveItemsMap } = await resolveLiveScoresBatch(supabaseAdmin, liveAssignments);
  const { officialScoreMap, officialItemsMap } = await resolveOfficialScoresBatch(supabaseAdmin, officialAssignments);

  if (completionStatus && completionStatus !== 'all') {
    filtered = filtered.filter(a => {
      const isLocked = a.status === 'locked';
      let resStatus = 'not_scored';
      if (isLocked) {
        const off = officialScoreMap.get(a.id);
        if (off && off.status) resStatus = off.status;
      } else {
        const live = liveScoreMap.get(a.id);
        if (live && live.total_score !== null) {
           resStatus = live.status === 'partial' ? 'partial' : 'complete';
        }
      }
      if (completionStatus === 'unscored' && resStatus === 'not_scored') return true;
      return resStatus === completionStatus;
    });
  }

  return { finalAssignments: filtered, liveScoreMap, officialScoreMap, liveItemsMap, officialItemsMap, revMap };
}

export async function resolveOfficialScoresBatch(
  supabaseAdmin: any,
  officialAssignments: any[]
): Promise<{
  officialScoreMap: Map<string, { total_score: number | null; status: string; total_weight?: number; scored_weight?: number }>,
  officialItemsMap: Map<string, any[]>
}> {
  const officialScoreMap = new Map<string, { total_score: number | null; status: string; total_weight?: number; scored_weight?: number }>();
  const officialItemsMap = new Map<string, any[]>();
  if (!officialAssignments || officialAssignments.length === 0) return { officialScoreMap, officialItemsMap };

  const officialIds = officialAssignments.map(a => a.id);
  const { data: reviews } = await supabaseAdmin
    .from('kpi_assignment_reviews')
    .select('id, assignment_id, status, official_total_score')
    .in('assignment_id', officialIds);

  const revMap = new Map<string, any>();
  (reviews || []).forEach((r: any) => revMap.set(r.assignment_id, r));

  const reviewIds = (reviews || []).map((r: any) => r.id);
  let itemReviews: any[] = [];
  if (reviewIds.length > 0) {
    const { data: ir } = await supabaseAdmin
      .from('kpi_assignment_item_reviews')
      .select('id, review_id, assignment_item_id, final_actual_value, final_achievement_percent, final_weighted_score, final_raw_score, final_comments')
      .in('review_id', reviewIds);
    itemReviews = ir || [];
  }

  for (const a of officialAssignments) {
    const rev = revMap.get(a.id);
    let officialScore: number | null = null;

    if (rev?.official_total_score !== undefined && rev?.official_total_score !== null) {
      officialScore = Number(rev.official_total_score);
    } else if (a.config?.official_result?.total_score !== undefined && a.config?.official_result?.total_score !== null) {
      officialScore = Number(a.config.official_result.total_score);
    } else if (a.config?.review?.official_total_score !== undefined && a.config?.review?.official_total_score !== null) {
      officialScore = Number(a.config.review.official_total_score);
    } else if (rev?.id) {
      const snaps = itemReviews.filter((ir: any) => ir.review_id === rev.id);
      if (snaps.length > 0) {
        officialScore = snaps.reduce((sum: number, it: any) => sum + (Number(it.final_weighted_score) || 0), 0);
      }
    } else if (Array.isArray(a.config?.review_items) && a.config.review_items.length > 0) {
      officialScore = a.config.review_items.reduce((sum: number, it: any) => sum + (Number(it.final_weighted_score) || 0), 0);
    }

    const resolvedItems = a.config?.review_items || [];
    let itemsFromSnaps = [];
    if (rev?.id) {
       itemsFromSnaps = itemReviews.filter((ir: any) => ir.review_id === rev.id);
    }
    officialItemsMap.set(a.id, resolvedItems.length > 0 ? resolvedItems : itemsFromSnaps);
    let officialTw = 0;
    let officialSw = 0;
    if (officialScore !== null) {
      officialTw = resolvedItems.length > 0 ? resolvedItems.reduce((acc: number, it: any) => acc + (Number(it.weight || it.score_snapshot?.weight) || 0), 0) : itemsFromSnaps.reduce((acc: number, it: any) => acc + (Number(it.weight || it.score_snapshot?.weight) || 0), 0);
      officialSw = officialTw; // if it has a score, we assume fully scored in official
    }
    officialScoreMap.set(a.id, {
      total_score:  officialScore !== null ? Math.round(officialScore * 10000) / 10000 : null,
      status:  officialScore !== null ? 'complete' : 'not_scored',
      total_weight: officialTw || 100,
      scored_weight: officialSw
    });
  }

  return { officialScoreMap, officialItemsMap };
}