const fs = require('fs');
let code = fs.readFileSync('src/services/ai/aiPromptRegistry.ts', 'utf-8');

// Find the last valid executive.overview expectedSchema and remove duplicates
const startIndex = code.indexOf("'executive.overview':");
if (startIndex !== -1) {
    let before = code.substring(0, startIndex);
    let after = code.substring(startIndex);
    // Replace duplicate expectedSchema logic by resetting the block manually
    // Actually, I'll just rewrite the end of the file
}
