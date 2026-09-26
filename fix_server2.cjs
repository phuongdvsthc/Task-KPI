const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
    /const \{ data: \{ user \}, error: authError \} = await supabaseAdmin\.auth\.getUser\(token\);/g,
    `const supabaseAdmin = getSupabaseAdminClient(req);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);`
);

fs.writeFileSync('server.ts', content);
