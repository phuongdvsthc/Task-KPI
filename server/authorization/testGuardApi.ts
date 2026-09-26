import { Express, Request, Response } from 'express';
import {
  requireCapability,
  requireAnyCapability,
  requireAllCapabilities,
  getRequestAuthorizationContext
} from './authorization.middleware';
import {
  resolveEffectiveScope
} from './authorization.service';
import {
  applyScopeToQuery,
  assertResourceInScope
} from './dataScope';

/**
 * Register verification endpoints for E3.1 Backend Capability Guard & Data Scope Foundation
 */
export function registerTestGuardRoutes(app: Express): void {
  // 1. Single capability guard test
  app.get(
    '/api/test/authz/single-capability',
    requireCapability('admissions.view'),
    async (req: Request, res: Response) => {
      const context = await getRequestAuthorizationContext(req, res);
      res.json({
        status: 'authorized',
        user_id: context.userId,
        capability: 'admissions.view',
        scope: context.permissions.get('admissions.view')?.scopeCode
      });
    }
  );

  // 2. Require any capability guard test
  app.get(
    '/api/test/authz/any-capability',
    requireAnyCapability(['admissions.sheet_sync_confirm', 'admissions.sheet_configure']),
    async (req: Request, res: Response) => {
      const context = await getRequestAuthorizationContext(req, res);
      res.json({
        status: 'authorized',
        user_id: context.userId,
        matched: true
      });
    }
  );

  // 3. Require all capabilities guard test
  app.get(
    '/api/test/authz/all-capabilities',
    requireAllCapabilities(['user_org.users.manage', 'user_org.units.manage']),
    async (req: Request, res: Response) => {
      const context = await getRequestAuthorizationContext(req, res);
      res.json({
        status: 'authorized',
        user_id: context.userId,
        matched: true
      });
    }
  );

  // 4. Data scope resolution & PostgREST query building test
  app.get(
    '/api/test/authz/data-scope-test',
    requireCapability('task.view'),
    async (req: Request, res: Response) => {
      const context = await getRequestAuthorizationContext(req, res);
      const supabaseAdmin = res.locals.supabaseAdmin;
      const scope = await resolveEffectiveScope(context, 'task.view', supabaseAdmin);

      // Build scoped query
      let query = supabaseAdmin.from('tasks').select('id, title, created_by, department_id').limit(10);
      query = applyScopeToQuery(query, scope, {
        userColumn: 'created_by',
        unitColumn: 'department_id'
      });

      const { data, error } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({
        status: 'ok',
        resolved_scope: scope,
        record_count: data?.length || 0,
        sample: data || []
      });
    }
  );

  // 5. In-memory resource asserting test
  app.post(
    '/api/test/authz/resource-scope-assert',
    requireCapability('admissions.view'),
    async (req: Request, res: Response) => {
      const context = await getRequestAuthorizationContext(req, res);
      const supabaseAdmin = res.locals.supabaseAdmin;
      const scope = await resolveEffectiveScope(context, 'admissions.view', supabaseAdmin);
      const resource = req.body.resource;

      try {
        assertResourceInScope(
          resource,
          scope,
          {
            userColumn: 'created_by',
            unitColumn: 'unit_id'
          },
          'AdmissionPlan'
        );

        res.json({
          status: 'granted',
          scope_kind: scope.kind,
          resource_id: resource?.id
        });
      } catch (err: any) {
        res.status(err.statusCode || 403).json({
          error: err.message,
          code: err.code || 'RESOURCE_OUT_OF_SCOPE'
        });
      }
    }
  );
}
