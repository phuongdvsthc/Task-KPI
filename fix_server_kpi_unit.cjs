const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const badStart = content.indexOf("app.all(['/api/rpc/kpi_get_dashboard_kpi_unit_breakdown'");
if (badStart !== -1) {
    let chunkToMove = content.substring(badStart);
    content = content.substring(0, badStart);
    
    // Find Vite block
    const viteIdx = content.indexOf("if (process.env.NODE_ENV !== 'production') {");
    if (viteIdx !== -1) {
        content = content.substring(0, viteIdx) + chunkToMove + "\n" + content.substring(viteIdx);
        fs.writeFileSync('server.ts', content);
        console.log("Moved successfully.");
    }
}
