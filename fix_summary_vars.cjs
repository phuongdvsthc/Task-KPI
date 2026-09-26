const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const replacement = `
    const liveAssignments = finalAssignments.filter(a => a.status !== 'locked');
    const officialAssignments = finalAssignments.filter(a => a.status === 'locked');
    const summaryResponse = {
`;

content = content.replace(/const summaryResponse = \{/g, replacement);
fs.writeFileSync('server.ts', content);
