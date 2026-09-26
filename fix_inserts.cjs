const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

content = content.replace(/await supabase\.from\('([a-z_]+)'\)\.insert\((.*?)\);/g, `const err_$1 = (await supabase.from('$1').insert($2)).error; if (err_$1) throw new Error("Insert $1 failed: " + JSON.stringify(err_$1));`);

fs.writeFileSync('test_v0.4.6-A.cjs', content);
