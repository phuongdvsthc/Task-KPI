const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const rpcCallAdmin = "supabaseAdmin.rpc('kpi_resolve_assignment_score'";
const setupClient = `
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUser = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.authorization } }
    });
    const liveScores = await Promise.all(liveAssignments.map(a => 
      supabaseUser.rpc('kpi_resolve_assignment_score', { p_assignment_id: a.id })
    ));
`;

content = content.replace(
  /const liveScores = await Promise\.all\(liveAssignments\.map\(a => \s*supabaseAdmin\.rpc\('kpi_resolve_assignment_score', { p_assignment_id: a\.id }\)\s*\)\);/g,
  setupClient
);

fs.writeFileSync('server.ts', content);
