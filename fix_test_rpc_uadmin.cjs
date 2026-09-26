const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

const regex = /const emailAdmin =.*?global: \{ headers: \{ Authorization: \\\`Bearer \$\{sessionAdmin\.session\.access_token\}\\\` \} \}\n    \}\);\n/gs;

content = content.replace(regex, `
    const sbAnonAdmin = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    const { data: sessionAdmin } = await sbAnonAdmin.auth.signInWithPassword({ email: u0.user.email, password });
    const sbAuthAdmin = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: \`Bearer \${sessionAdmin.session.access_token}\` } }
    });
`);

// Also fix entered_by: realAdmin.user.id to uAdmin
content = content.replace(/realAdmin\.user\.id/g, 'uAdmin');

fs.writeFileSync('test_v0.4.6-A.cjs', content);
