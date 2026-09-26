const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
    /const off = \(officialScoreMap\.get \? officialScoreMap : officialScoreMap\.officialScoreMap\)\?\.get\(a\.id\);/g,
    `const off = officialScoreMap.get(a.id);`
);
content = content.replace(
    /const live = \(liveScoreMap\.get \? liveScoreMap : liveScoreMap\.liveScoreMap\)\?\.get\(a\.id\);/g,
    `const live = liveScoreMap.get(a.id);`
);

fs.writeFileSync('server.ts', content);
