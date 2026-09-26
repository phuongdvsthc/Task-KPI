const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('/api/ai/summary')) {
    const aiRoute = `
// ==========================================
// AI MODULE (v0.5-A1)
// ==========================================
app.post('/api/ai/summary', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing authorization' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (!profile) return res.status(401).json({ error: 'No profile' });

    // The AI Service orchestrates building context and calling the Provider.
    // We do NOT pass the raw database to the AI Provider, only sanitized structured context.
    const { aiService } = await import('./src/services/ai/aiService.js');
    
    const aiResponse = await aiService.generateSummary(supabaseAdmin, {
      userId: user.id,
      userRole: profile.role,
      featureKey: 'kpi_summary'
    });

    res.json(aiResponse);
  } catch (err: any) {
    console.error('[API ai_summary] Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

`;

    const insertPos = content.indexOf('if (process.env.NODE_ENV !== "production")');
    content = content.slice(0, insertPos) + aiRoute + content.slice(insertPos);
    
    // Add export for TypeScript to compile correctly with dynamic import
    // Wait, the dynamic import uses `.js` which might fail in TS compilation if not handled. Let's use static import.
}
fs.writeFileSync('server.ts', content);
