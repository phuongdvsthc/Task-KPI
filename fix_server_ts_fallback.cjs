const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Replace the user client injection
content = content.replace(
  /const supabaseUser = createClient\(process\.env\.VITE_SUPABASE_URL.*?\}\);/gs,
  ''
);

// We want to replace the liveScores logic with the fallback logic in BOTH summary and assignments endpoints.
// Let's just find `liveScores` and replace it entirely for summary.
// Wait, doing this via regex might be messy. Let me just rewrite `server.ts` endpoints.
