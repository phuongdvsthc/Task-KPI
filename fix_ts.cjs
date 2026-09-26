const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace(
    /const liveScoreMap = await resolveLiveScoresBatch\(supabaseAdmin, liveAssignments\);/g,
    `const { liveScoreMap, liveItemsMap } = await resolveLiveScoresBatch(supabaseAdmin, liveAssignments);`
);
content = content.replace(
    /const officialScoreMap = await resolveOfficialScoresBatch\(supabaseAdmin, officialAssignments\);/g,
    `const { officialScoreMap, officialItemsMap } = await resolveOfficialScoresBatch(supabaseAdmin, officialAssignments);`
);
fs.writeFileSync('server.ts', content);
