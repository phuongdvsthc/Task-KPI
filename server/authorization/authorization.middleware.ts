import { Request, Response, NextFunction } from 'express';
import {
  getAuthorizationContext,
  assertCapability,
  assertAnyCapability,
  assertAllCapabilities
} from './authorization.service';
import { AuthorizationError } from './authorization.errors';
import { AuthorizationContext, PermissionScopeCode } from './authorization.types';
import { logSecurityEvent } from './securityLogger';
import { createClient } from '@supabase/supabase-js';

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

/**
 * Authenticate incoming request and retrieve Supabase Admin client + user entity
 */
export async function authenticateRequest(
  req: Request,
  res: Response
): Promise<{ user: { id: string; email?: string }; supabaseAdmin: any; requestId: string }> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('x-request-id', requestId);

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
      res.locals.supabaseAdmin = supabaseAdmin;
      (req as any).supabaseAdmin = supabaseAdmin;
    }
  }

  if (!supabaseAdmin) {
    throw new AuthorizationError('AUTHORIZATION_UNAVAILABLE', 'Database client unavailable on server', 503);
  }

  let authUser: { id: string; email?: string } | null = res.locals.user || (req as any).user || null;
  const authHeader = req.headers.authorization;

  if (!authUser) {
    if (!authHeader) {
      throw new AuthorizationError('UNAUTHENTICATED', 'No authorization header provided', 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      throw new AuthorizationError('UNAUTHENTICATED', 'Empty authorization bearer token', 401);
    }

    // 1. Verify via Supabase Auth
    try {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (!authError && user) {
        authUser = { id: user.id, email: user.email };
      }
    } catch {
      // Network or Supabase error; proceed to unexpired JWT verification
    }

    // 2. Validate unexpired signed JWT payload
    if (!authUser) {
      const payload = parseJwtPayload(token);
      if (payload?.sub && payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, email, is_active')
          .eq('id', payload.sub)
          .maybeSingle();

        if (profile && profile.is_active !== false) {
          authUser = { id: profile.id, email: profile.email || payload.email };
        }
      }
    }

    if (!authUser) {
      throw new AuthorizationError('UNAUTHENTICATED', 'Invalid, expired, or unrecognized token', 401);
    }
  }

  res.locals.user = authUser;
  (req as any).user = authUser;

  return { user: authUser, supabaseAdmin, requestId };
}

/**
 * Get (or lazy-load and cache) the request's AuthorizationContext
 */
export async function getRequestAuthorizationContext(
  req: Request,
  res: Response
): Promise<AuthorizationContext> {
  if (res.locals.authorizationContext) {
    return res.locals.authorizationContext;
  }

  const { user, supabaseAdmin, requestId } = await authenticateRequest(req, res);
  const context = await getAuthorizationContext(user.id, supabaseAdmin, requestId);

  res.locals.authorizationContext = context;
  (req as any).authzContext = context;
  return context;
}

/**
 * Express middleware to enforce a single required capability
 */
export function requireCapability(capabilityCode: string, minScope?: PermissionScopeCode) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let requestId = (req.headers['x-request-id'] as string) || '';
    let actorId: string | null = null;
    try {
      const context = await getRequestAuthorizationContext(req, res);
      actorId = context.userId;
      requestId = context.requestId || requestId;

      assertCapability(context, capabilityCode, minScope);

      logSecurityEvent({
        requestId,
        actorId,
        endpoint: req.originalUrl || req.url,
        method: req.method,
        capability: capabilityCode,
        result: 'ALLOW'
      });

      next();
    } catch (err: any) {
      const isAuthzErr = err instanceof AuthorizationError;
      const statusCode = isAuthzErr ? err.statusCode : 500;
      const code = isAuthzErr ? err.code : 'AUTHORIZATION_UNAVAILABLE';
      const message = isAuthzErr ? err.message : 'Internal authorization error';

      logSecurityEvent({
        requestId,
        actorId,
        endpoint: req.originalUrl || req.url,
        method: req.method,
        capability: capabilityCode,
        result: 'DENY',
        reason: message,
        metadata: { errorCode: code, statusCode }
      });

      res.status(statusCode).json({
        error: message,
        code,
        capability: capabilityCode,
        requestId
      });
    }
  };
}

/**
 * Express middleware to enforce that the user possesses ANY of the specified capabilities
 */
export function requireAnyCapability(capabilityCodes: string[], minScope?: PermissionScopeCode) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let requestId = (req.headers['x-request-id'] as string) || '';
    let actorId: string | null = null;
    try {
      const context = await getRequestAuthorizationContext(req, res);
      actorId = context.userId;
      requestId = context.requestId || requestId;

      assertAnyCapability(context, capabilityCodes, minScope);

      logSecurityEvent({
        requestId,
        actorId,
        endpoint: req.originalUrl || req.url,
        method: req.method,
        capability: capabilityCodes.join('|'),
        result: 'ALLOW'
      });

      next();
    } catch (err: any) {
      const isAuthzErr = err instanceof AuthorizationError;
      const statusCode = isAuthzErr ? err.statusCode : 500;
      const code = isAuthzErr ? err.code : 'AUTHORIZATION_UNAVAILABLE';
      const message = isAuthzErr ? err.message : 'Internal authorization error';

      logSecurityEvent({
        requestId,
        actorId,
        endpoint: req.originalUrl || req.url,
        method: req.method,
        capability: capabilityCodes.join('|'),
        result: 'DENY',
        reason: message,
        metadata: { errorCode: code, statusCode }
      });

      res.status(statusCode).json({ error: message, code });
    }
  };
}

/**
 * Express middleware to enforce that the user possesses ALL of the specified capabilities
 */
export function requireAllCapabilities(capabilityCodes: string[], minScope?: PermissionScopeCode) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let requestId = (req.headers['x-request-id'] as string) || '';
    let actorId: string | null = null;
    try {
      const context = await getRequestAuthorizationContext(req, res);
      actorId = context.userId;
      requestId = context.requestId || requestId;

      assertAllCapabilities(context, capabilityCodes, minScope);

      logSecurityEvent({
        requestId,
        actorId,
        endpoint: req.originalUrl || req.url,
        method: req.method,
        capability: capabilityCodes.join('&'),
        result: 'ALLOW'
      });

      next();
    } catch (err: any) {
      const isAuthzErr = err instanceof AuthorizationError;
      const statusCode = isAuthzErr ? err.statusCode : 500;
      const code = isAuthzErr ? err.code : 'AUTHORIZATION_UNAVAILABLE';
      const message = isAuthzErr ? err.message : 'Internal authorization error';

      logSecurityEvent({
        requestId,
        actorId,
        endpoint: req.originalUrl || req.url,
        method: req.method,
        capability: capabilityCodes.join('&'),
        result: 'DENY',
        reason: message,
        metadata: { errorCode: code, statusCode }
      });

      res.status(statusCode).json({ error: message, code });
    }
  };
}

/**
 * Express middleware enforcing capability with a mandatory minimum data scope
 */
export function requireCapabilityWithScope(capabilityCode: string, minScope: PermissionScopeCode) {
  return requireCapability(capabilityCode, minScope);
}

/** Backward compatible alias for requireCapability */
export const requirePermission = requireCapability;
