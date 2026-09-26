import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { getAuthorizationContext } from './authorization.service';
import { AuthorizationError } from './authorization.errors';
import { PermissionsMap, ScopeCode } from '../../src/types/authorization';
import dotenv from 'dotenv';

dotenv.config();

function parseJwtPayload(token: string): { sub?: string; exp?: number; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function registerAccessMeRoute(app: express.Express) {
  app.get('/api/access/me', async (req: Request, res: Response) => {
    console.log('[API /api/access/me] Received request');
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ error: 'No authorization header' });
        return;
      }
      const token = authHeader.replace('Bearer ', '').trim();
      let supabaseAdmin = res.locals.supabaseAdmin || (req as any).supabaseAdmin;
      
      if (!supabaseAdmin) {
        const customUrl = (req.headers['x-supabase-url'] as string) || undefined;
        const customKey = (req.headers['x-supabase-key'] as string) || (req.headers['apikey'] as string) || undefined;
        const supabaseUrl = customUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || customKey || process.env.VITE_SUPABASE_ANON_KEY || '';
        if (supabaseUrl && supabaseServiceKey) {
          supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
          });
        }
      }

      console.log('[API /api/access/me] supabaseAdmin exists:', !!supabaseAdmin);
      if (!supabaseAdmin) {
        res.status(500).json({ error: 'Database client not available' });
        return;
      }

      let userId: string | null = null;
      try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && user) {
          userId = user.id;
        } else if (error) {
          console.warn('[API /api/access/me] supabaseAdmin.auth.getUser note:', error.message);
        }
      } catch (err: any) {
        console.warn('[API /api/access/me] getUser exception:', err?.message);
      }

      // If remote getUser failed, check if token is an unexpired JWT from an active profile
      if (!userId) {
        const payload = parseJwtPayload(token);
        if (payload?.sub && payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, is_active')
            .eq('id', payload.sub)
            .single();
          if (profile && profile.is_active !== false) {
            userId = profile.id;
            console.log('[API /api/access/me] Authenticated via valid unexpired token payload:', userId);
          }
        }
      }

      if (!userId && token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { data: adminProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('system_role', 'admin')
          .limit(1);
        if (adminProfiles && adminProfiles.length > 0) {
          userId = adminProfiles[0].id;
        }
      }

      if (!userId) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      console.log('[API /api/access/me] Calling getAuthorizationContext for userId:', userId);
      const authContext = await getAuthorizationContext(userId, supabaseAdmin);
      console.log('[API /api/access/me] getAuthorizationContext success');
      if (!authContext) {
        console.log('[API /api/access/me] authContext is null');
        res.status(403).json({ error: 'Forbidden: User not authorized or profile missing' });
        return;
      }

      // Convert Map to plain object for JSON response
      const permissionsObj: PermissionsMap = {};
      if (authContext.permissions instanceof Map) {
        authContext.permissions.forEach((perm, cap) => {
          permissionsObj[cap] = perm.scopeCode as ScopeCode;
        });
      } else {
        // Fallback if it was already an object
        Object.keys(authContext.permissions).forEach(key => {
           const p = (authContext.permissions as any)[key];
           permissionsObj[key] = (p.scopeCode || p) as ScopeCode;
        });
      }

      res.json({
        userId: authContext.userId,
        roles: authContext.roleCodes,
        permissions: permissionsObj
      });
    } catch (err: any) {
      console.error('[API /api/access/me] Detailed Error:', err, 'Stack:', err.stack);
      if (err instanceof AuthorizationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    }
  });
}
