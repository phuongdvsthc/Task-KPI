import { Express, Request, Response, NextFunction } from 'express';
import { usageController } from './usage.controller';
import { requireCapability } from '../../../../server/authorization/authorization.middleware';

export function registerUsageRoutes(app: Express, authenticateUser: (req: Request, res: Response, next: NextFunction) => void) {
  // Middleware to attach supabaseAdmin to res.locals if not present
  const attachSupabaseAdmin = (req: Request, res: Response, next: NextFunction) => {
    const customUrl = req.headers['x-supabase-url'] as string | undefined;
    const customKey = req.headers['x-supabase-key'] as string | undefined;
    const supabaseUrl = customUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || customKey || (req.headers['apikey'] as string) || process.env.VITE_SUPABASE_ANON_KEY || '';
    
    if (supabaseUrl && supabaseServiceKey) {
      const { createClient } = require('@supabase/supabase-js');
      res.locals.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
    }
    next();
  };

  // Personal usage endpoint
  app.get('/api/ai/usage/me', authenticateUser, attachSupabaseAdmin, usageController.getPersonalUsage);

  // Admin summary statistics (requires ai.usage.view)
  app.get(
    '/api/admin/ai/usage/summary',
    authenticateUser,
    attachSupabaseAdmin,
    requireCapability('ai.usage.view'),
    usageController.getAdminSummary
  );

  // Admin settings endpoints (requires ai.config.manage)
  app.get(
    '/api/admin/ai/usage-settings',
    authenticateUser,
    attachSupabaseAdmin,
    requireCapability('ai.config.manage'),
    usageController.getSettings
  );

  app.patch(
    '/api/admin/ai/usage-settings',
    authenticateUser,
    attachSupabaseAdmin,
    requireCapability('ai.config.manage'),
    usageController.updateSettings
  );
}
