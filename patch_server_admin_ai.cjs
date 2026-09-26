const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const aiAdminRoutes = `
  // --------------------------------------------------------
  // ADMIN AI CONFIG (v0.5-A3)
  // --------------------------------------------------------
  
  app.get('/api/admin/ai-config', authenticateAdmin, async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = res.locals.supabaseAdmin;
      const { aiConfigService } = await import('./src/services/ai/aiConfigService');
      const publicConfig = await aiConfigService.getPublicConfig(supabaseAdmin);
      res.json(publicConfig);
    } catch (err: any) {
      console.error('[API admin ai-config get] Error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  app.put('/api/admin/ai-config', authenticateAdmin, async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = res.locals.supabaseAdmin;
      const { enabled, provider, model, apiKey } = req.body;
      
      if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled boolean required' });
      if (!provider) return res.status(400).json({ error: 'provider required' });
      if (enabled && !model) return res.status(400).json({ error: 'model required when enabled' });

      const { aiConfigService } = await import('./src/services/ai/aiConfigService');
      await aiConfigService.saveConfig(supabaseAdmin, { enabled, provider, model, apiKey });
      
      const publicConfig = await aiConfigService.getPublicConfig(supabaseAdmin);
      res.json(publicConfig);
    } catch (err: any) {
      console.error('[API admin ai-config put] Error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  app.post('/api/admin/ai-config/test', authenticateAdmin, async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = res.locals.supabaseAdmin;
      const { provider, model, apiKey } = req.body;
      
      if (!provider || !model) return res.status(400).json({ error: 'provider and model required' });

      const { aiConfigService } = await import('./src/services/ai/aiConfigService');
      const { createAIProvider, NullAIProvider } = await import('./src/services/ai/aiProvider');

      // Draft config
      let testConfig = await aiConfigService.resolve(supabaseAdmin);
      testConfig.provider = provider;
      testConfig.model = model;
      if (apiKey !== undefined && apiKey.trim() !== '') {
        testConfig.apiKey = apiKey.trim();
      }
      testConfig.enabled = true; // force enabled for test

      const aiProvider = createAIProvider(testConfig);
      
      if (aiProvider instanceof NullAIProvider && !testConfig.apiKey) {
        return res.status(400).json({ error: 'Chưa cấu hình API Key' });
      }

      const isHealthy = await aiProvider.healthCheck();
      if (!isHealthy) {
        return res.status(500).json({ error: 'Không thể kết nối đến nhà cung cấp AI' });
      }

      res.json({ success: true, message: 'Kết nối thành công', provider, model });
    } catch (err: any) {
      console.error('[API admin ai-config test] Error:', err);
      res.status(500).json({ error: err.message || 'Lỗi kiểm tra kết nối' });
    }
  });

`;

if (!content.includes('/api/admin/ai-config')) {
    const insertPos = content.indexOf('app.get(\'/api/admin/settings\'');
    if (insertPos !== -1) {
        content = content.slice(0, insertPos) + aiAdminRoutes + content.slice(insertPos);
        fs.writeFileSync('server.ts', content);
    }
}
