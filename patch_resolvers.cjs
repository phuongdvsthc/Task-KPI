const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// 1. Patch resolveLiveScoresBatch signature
content = content.replace(
    /async function resolveLiveScoresBatch\([\s\S]*?\): Promise<Map<string, \{ total_score: number; status: string; total_weight: number; scored_weight: number \}>+> \{/g,
    `async function resolveLiveScoresBatch(
  supabaseAdmin: any,
  liveAssignments: any[]
): Promise<{ 
  liveScoreMap: Map<string, { total_score: number; status: string; total_weight: number; scored_weight: number }>,
  liveItemsMap: Map<string, any[]>
}> {`
);

// 2. Patch live score map return
content = content.replace(
    /const liveScoreMap = new Map<string, \{ total_score: number; status: string; total_weight: number; scored_weight: number \}>\(\);\n  if \(\!liveAssignments \|\| liveAssignments\.length === 0\) return liveScoreMap;/g,
    `const liveScoreMap = new Map<string, { total_score: number; status: string; total_weight: number; scored_weight: number }>();
  const liveItemsMap = new Map<string, any[]>();
  if (!liveAssignments || liveAssignments.length === 0) return { liveScoreMap, liveItemsMap };`
);

content = content.replace(
    /let st = 'complete';\n    if \(sw === 0\) \{/,
    `let st = 'complete';
    liveItemsMap.set(a.id, items);
    if (sw === 0) {`
);

// At the end of resolveLiveScoresBatch loop, it calculates weightedScore. We need to attach ach and weightedScore and rawScore to `it` directly!
// Wait, the inner loop modifies `it` or not? Let's check how `it` is used in resolveLiveScoresBatch.
// We can just add a regex replace to insert `it.resolved_ach = ach; it.resolved_raw = rawScore; it.resolved_weighted = weightedScore; it.resolved_actual = actual;`
content = content.replace(
    /const weightedScore = \(rawScore \* weight\) \/ 100\.0;\n        ts \+= weightedScore;\n      \} else \{/g,
    `const weightedScore = (rawScore * weight) / 100.0;
        ts += weightedScore;
        it.resolved_ach = ach;
        it.resolved_raw = rawScore;
        it.resolved_weighted = weightedScore;
        it.resolved_actual = actual;
        it.resolved_is_scored = true;
      } else {
        it.resolved_is_scored = false;`
);

content = content.replace(
    /return liveScoreMap;\n\}/g,
    `return { liveScoreMap, liveItemsMap };\n}`
);


// 3. Patch resolveOfficialScoresBatch signature
content = content.replace(
    /async function resolveOfficialScoresBatch\([\s\S]*?\): Promise<Map<string, \{ total_score: number \| null; status: string \}>+> \{/g,
    `async function resolveOfficialScoresBatch(
  supabaseAdmin: any,
  officialAssignments: any[]
): Promise<{
  officialScoreMap: Map<string, { total_score: number | null; status: string }>,
  officialItemsMap: Map<string, any[]>
}> {`
);

// 4. Patch official score map return
content = content.replace(
    /const officialScoreMap = new Map<string, \{ total_score: number \| null; status: string \}>\(\);\n  if \(\!officialAssignments \|\| officialAssignments\.length === 0\) return officialScoreMap;/g,
    `const officialScoreMap = new Map<string, { total_score: number | null; status: string }>();
  const officialItemsMap = new Map<string, any[]>();
  if (!officialAssignments || officialAssignments.length === 0) return { officialScoreMap, officialItemsMap };`
);

// Inside resolveOfficialScoresBatch, we need to extract item snapshots. 
content = content.replace(
    /officialScoreMap\.set\(a\.id, \{/g,
    `const resolvedItems = a.config?.review_items || [];
    let itemsFromSnaps = [];
    if (rev?.id) {
       itemsFromSnaps = itemReviews.filter((ir: any) => ir.review_id === rev.id);
    }
    officialItemsMap.set(a.id, resolvedItems.length > 0 ? resolvedItems : itemsFromSnaps);
    officialScoreMap.set(a.id, {`
);

content = content.replace(
    /return officialScoreMap;\n\}/g,
    `return { officialScoreMap, officialItemsMap };\n}`
);

// 5. Update applyAdvancedFiltersAndBatchResolve calls
content = content.replace(
    /const liveScoreMap = await resolveLiveScoresBatch\(supabaseAdmin, liveAssignments\);\n  const officialScoreMap = await resolveOfficialScoresBatch\(supabaseAdmin, officialAssignments\);/g,
    `const { liveScoreMap, liveItemsMap } = await resolveLiveScoresBatch(supabaseAdmin, liveAssignments);
  const { officialScoreMap, officialItemsMap } = await resolveOfficialScoresBatch(supabaseAdmin, officialAssignments);`
);

content = content.replace(
    /return \{ finalAssignments: filtered, liveScoreMap, officialScoreMap, revMap \};/g,
    `return { finalAssignments: filtered, liveScoreMap, officialScoreMap, liveItemsMap, officialItemsMap, revMap };`
);

content = content.replace(
    /const \{ finalAssignments, liveScoreMap, officialScoreMap, revMap \} = await applyAdvancedFiltersAndBatchResolve/g,
    `const { finalAssignments, liveScoreMap, officialScoreMap, liveItemsMap, officialItemsMap, revMap } = await applyAdvancedFiltersAndBatchResolve`
);
content = content.replace(
    /let \{ finalAssignments, liveScoreMap, officialScoreMap \} = await applyAdvancedFiltersAndBatchResolve/g,
    `let { finalAssignments, liveScoreMap, officialScoreMap, liveItemsMap, officialItemsMap } = await applyAdvancedFiltersAndBatchResolve`
);
content = content.replace(
    /const \{ finalAssignments, liveScoreMap, officialScoreMap \} = await applyAdvancedFiltersAndBatchResolve/g,
    `const { finalAssignments, liveScoreMap, officialScoreMap, liveItemsMap, officialItemsMap } = await applyAdvancedFiltersAndBatchResolve`
);

fs.writeFileSync('server.ts', content);
