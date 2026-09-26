const fs = require('fs');

let serverTs = fs.readFileSync('server.ts', 'utf8');

const regex = /async function resolveOfficialScoresBatch[\s\S]*?return \{ officialScoreMap, officialItemsMap \};\n\}/;
const match = serverTs.match(regex);

if (match) {
  let resolverCode = fs.readFileSync('src/services/kpiDashboardResolver.ts', 'utf8');
  resolverCode += `\nexport ` + match[0].replace(/async function/g, 'async function');
  
  // Actually wait, I need to fix the first one because it had a syntax error.
  fs.writeFileSync('src/services/kpiDashboardResolver.ts', resolverCode);

  serverTs = serverTs.replace(regex, "");
  fs.writeFileSync('server.ts', serverTs);
} else {
  console.log("No match found for resolveOfficialScoresBatch");
}
