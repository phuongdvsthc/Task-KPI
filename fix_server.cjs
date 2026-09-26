const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Remove the AI block at the end
const aiIndex = content.lastIndexOf('// ==========================================');
if (aiIndex > 8100) {
    const aiBlock = content.slice(aiIndex);
    content = content.slice(0, aiIndex);
    
    // Find the correct insertion point
    const insertPos = content.indexOf('if (process.env.NODE_ENV !== \'production\')');
    if (insertPos !== -1) {
        content = content.slice(0, insertPos) + aiBlock + '\n  ' + content.slice(insertPos);
    } else {
        console.log("Could not find insertion point!");
    }
}
fs.writeFileSync('server.ts', content);
