import { Router, Request, Response } from 'express';
import {
  authenticateRequest,
  getRequestAuthorizationContext,
  requireCapability,
  requireAnyCapability
} from '../authorization/authorization.middleware';
import {
  resolveEffectiveScope,
  assertCapability
} from '../authorization/authorization.service';
import {
  applyScopeToQuery,
  assertResourceInScope,
  canAccessResource
} from '../authorization/dataScope';
import { AuthorizationError } from '../authorization/authorization.errors';
import { CAPABILITIES } from '../../src/types/authorization';
import { admissionDashboardBackendService } from './admissionDashboardBackendService';
import { googleSheetsBackendService } from '../../src/services/googleSheetsBackendService';
import { validateSheetsData } from '../../src/services/googleSheetsValidationService';
import { executeSyncBatch } from '../../src/services/googleSheetsSyncExecutionService';

export const admissionsRouter = Router();

import { createClient } from '@supabase/supabase-js';

// Helper to get supabaseAdmin from request context
function getSupabaseAdmin(req: Request, res: Response) {
  if (res.locals?.supabaseAdmin) return res.locals.supabaseAdmin;
  if ((req as any)?.supabaseAdmin) return (req as any).supabaseAdmin;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key);
}

// Helper to record immutable audit log
async function logAdmissionAudit(
  supabaseAdmin: any,
  params: {
    entityType: string;
    entityId: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'FINALIZE' | 'REOPEN' | 'RECALCULATE';
    unitId?: string | null;
    campaignId?: string | null;
    oldData?: any;
    newData?: any;
    changedFields?: string[];
    changeReason?: string | null;
    changedBy: string;
    requestId?: string;
    sourceType?: 'user' | 'excel_import' | 'migration' | 'system';
  }
) {
  try {
    await supabaseAdmin.from('admission_change_history').insert({
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      unit_id: params.unitId || null,
      campaign_id: params.campaignId || null,
      old_data: params.oldData || null,
      new_data: params.newData || null,
      changed_fields: params.changedFields || null,
      change_reason: params.changeReason || null,
      changed_by: params.changedBy,
      changed_at: new Date().toISOString(),
      request_id: params.requestId || null,
      source_type: params.sourceType || 'user'
    });
  } catch (auditErr) {
    console.warn('[AdmissionsAudit] Warning recording audit history:', auditErr);
  }
}

// ============================================================================
// 1. ADMISSIONS DASHBOARD & OVERVIEW
// ============================================================================
admissionsRouter.get(
  ['/dashboard', '/overview'],
  requireCapability(CAPABILITIES.ADMISSIONS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_VIEW, supabaseAdmin);

      const filters = {
        year: req.query.year ? Number(req.query.year) : undefined,
        groupId: (req.query.groupId as string) || undefined,
        campaignId: (req.query.campaignId as string) || undefined,
        status: (req.query.status as any) || 'all',
        dataMode: (req.query.dataMode as any) || 'current',
        timeRange: (req.query.timeRange as any) || 'all',
        assigneeId: (req.query.assigneeId as string) || undefined,
      };

      const result = await admissionDashboardBackendService.getDashboardData(
        supabaseAdmin,
        filters,
        scope
      );
      res.json(result);
    } catch (err: any) {
      console.error('[Admissions API GET dashboard] Error:', err);
      const status = err.statusCode || err.status || 500;
      res.status(status).json({
        error: status === 500 ? (err.message || 'Internal server error') : err.message,
        code: err.code || undefined
      });
    }
  }
);

// ============================================================================
// 2. CATALOG: GROUPS & PROGRAMS (Nhiệm vụ 3)
// ============================================================================
admissionsRouter.get(
  '/groups',
  requireCapability(CAPABILITIES.ADMISSIONS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      let query = supabaseAdmin
        .from('admission_groups')
        .select('*')
        .order('sort_order', { ascending: true });

      if (req.query.is_active !== undefined) {
        query = query.eq('is_active', req.query.is_active === 'true');
      }

      const { data, error } = await query;
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.get(
  '/programs',
  requireCapability(CAPABILITIES.ADMISSIONS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      let query = supabaseAdmin
        .from('admission_programs')
        .select('*, group:admission_groups(*)')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (req.query.group_id && req.query.group_id !== 'all') {
        query = query.eq('group_id', req.query.group_id);
      }
      if (req.query.training_level) {
        query = query.eq('training_level', req.query.training_level);
      }
      if (req.query.is_active !== undefined) {
        query = query.eq('is_active', req.query.is_active === 'true');
      }

      const { data, error } = await query;
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.post(
  '/programs',
  requireCapability(CAPABILITIES.ADMISSIONS_CATALOG_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const { code, name, group_id, training_level, duration, sort_order, is_active, description } = req.body;

      const cleanCode = String(code || '').trim().toUpperCase();
      const cleanName = String(name || '').trim();

      if (!cleanCode || cleanCode.length < 2) {
        return res.status(400).json({ error: 'Mã ngành/lớp phải có ít nhất 2 ký tự.' });
      }
      if (!cleanName || cleanName.length < 2) {
        return res.status(400).json({ error: 'Tên ngành/lớp phải có ít nhất 2 ký tự.' });
      }
      if (!group_id) {
        return res.status(400).json({ error: 'Vui lòng chọn nhóm tuyển sinh.' });
      }

      const { data, error } = await supabaseAdmin
        .from('admission_programs')
        .insert({
          group_id,
          code: cleanCode,
          name: cleanName,
          description: description ? String(description).trim() : null,
          training_level: training_level || 'trung_cap',
          duration: duration ? String(duration).trim() : null,
          sort_order: sort_order !== undefined ? Number(sort_order) : 0,
          is_active: is_active !== undefined ? Boolean(is_active) : true,
          created_by: authContext.userId,
          updated_by: authContext.userId,
        })
        .select('*, group:admission_groups(*)')
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ error: `Mã ngành/lớp "${cleanCode}" đã tồn tại trên hệ thống.` });
        }
        throw error;
      }

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_program',
        entityId: data.id,
        action: 'INSERT',
        newData: data,
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.status(201).json(data);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.put(
  '/programs/:id',
  requireCapability(CAPABILITIES.ADMISSIONS_CATALOG_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const programId = req.params.id;

      const { data: existing, error: getErr } = await supabaseAdmin
        .from('admission_programs')
        .select('*')
        .eq('id', programId)
        .single();

      if (getErr || !existing) {
        return res.status(404).json({ error: 'Không tìm thấy ngành/lớp tuyển sinh.' });
      }

      const updateData: Record<string, any> = {
        updated_by: authContext.userId,
        updated_at: new Date().toISOString()
      };

      if (req.body.group_id !== undefined) updateData.group_id = req.body.group_id;
      if (req.body.code !== undefined) {
        const cleanCode = String(req.body.code).trim().toUpperCase();
        if (cleanCode.length < 2) return res.status(400).json({ error: 'Mã ngành/lớp phải có ít nhất 2 ký tự.' });
        updateData.code = cleanCode;
      }
      if (req.body.name !== undefined) {
        const cleanName = String(req.body.name).trim();
        if (cleanName.length < 2) return res.status(400).json({ error: 'Tên ngành/lớp phải có ít nhất 2 ký tự.' });
        updateData.name = cleanName;
      }
      if (req.body.description !== undefined) updateData.description = req.body.description ? String(req.body.description).trim() : null;
      if (req.body.training_level !== undefined) updateData.training_level = req.body.training_level;
      if (req.body.duration !== undefined) updateData.duration = req.body.duration ? String(req.body.duration).trim() : null;
      if (req.body.sort_order !== undefined) updateData.sort_order = Number(req.body.sort_order);
      if (req.body.is_active !== undefined) updateData.is_active = Boolean(req.body.is_active);

      const { data, error } = await supabaseAdmin
        .from('admission_programs')
        .update(updateData)
        .eq('id', programId)
        .select('*, group:admission_groups(*)')
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ error: 'Mã ngành/lớp đã tồn tại trên hệ thống.' });
        }
        throw error;
      }

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_program',
        entityId: programId,
        action: 'UPDATE',
        oldData: existing,
        newData: data,
        changedFields: Object.keys(updateData),
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.json(data);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.post(
  '/programs/:id/toggle-active',
  requireCapability(CAPABILITIES.ADMISSIONS_CATALOG_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const programId = req.params.id;
      const { is_active, change_reason } = req.body;

      const { data: existing, error: getErr } = await supabaseAdmin
        .from('admission_programs')
        .select('*')
        .eq('id', programId)
        .single();

      if (getErr || !existing) {
        return res.status(404).json({ error: 'Không tìm thấy ngành/lớp tuyển sinh.' });
      }

      const { data, error } = await supabaseAdmin
        .from('admission_programs')
        .update({
          is_active: Boolean(is_active),
          updated_by: authContext.userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', programId)
        .select('*, group:admission_groups(*)')
        .single();

      if (error) throw error;

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_program',
        entityId: programId,
        action: 'UPDATE',
        oldData: existing,
        newData: data,
        changedFields: ['is_active'],
        changeReason: change_reason || null,
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.json(data);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

// ============================================================================
// 3. CAMPAIGNS: ĐỢT TUYỂN SINH (Nhiệm vụ 4)
// ============================================================================
admissionsRouter.get(
  '/campaigns',
  requireCapability(CAPABILITIES.ADMISSIONS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_VIEW, supabaseAdmin);

      let query = supabaseAdmin
        .from('admission_campaigns')
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .order('year', { ascending: false })
        .order('period_number', { ascending: true });

      // Apply data scope
      query = applyScopeToQuery(query, scope, { unitColumn: 'unit_id', userColumn: 'created_by' });

      // Apply optional query filters
      if (req.query.group_id && req.query.group_id !== 'all') {
        query = query.eq('group_id', req.query.group_id);
      }
      if (req.query.year) {
        query = query.eq('year', Number(req.query.year));
      }
      if (req.query.status && req.query.status !== 'all') {
        query = query.eq('status', req.query.status);
      }
      if (req.query.unit_id && req.query.unit_id !== 'all') {
        query = query.eq('unit_id', req.query.unit_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.get(
  '/campaigns/:id',
  requireCapability(CAPABILITIES.ADMISSIONS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_VIEW, supabaseAdmin);

      const { data, error } = await supabaseAdmin
        .from('admission_campaigns')
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .eq('id', req.params.id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Không tìm thấy đợt tuyển sinh.' });
      }

      // Assert data scope
      assertResourceInScope(data, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Đợt tuyển sinh');

      res.json(data);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.post(
  '/campaigns',
  requireCapability(CAPABILITIES.ADMISSIONS_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_MANAGE, supabaseAdmin);

      const payload = req.body;
      const cleanCode = String(payload.code || '').trim().toUpperCase();
      const cleanName = String(payload.name || '').trim();

      if (!cleanCode || cleanCode.length < 2) return res.status(400).json({ error: 'Mã đợt tuyển sinh phải có ít nhất 2 ký tự.' });
      if (!cleanName || cleanName.length < 2) return res.status(400).json({ error: 'Tên đợt tuyển sinh phải có ít nhất 2 ký tự.' });
      if (!payload.group_id) return res.status(400).json({ error: 'Vui lòng chọn nhóm tuyển sinh.' });
      if (!payload.year || payload.year < 2000 || payload.year > 2100) return res.status(400).json({ error: 'Năm tuyển sinh phải từ 2000 đến 2100.' });
      if (!payload.period_number || payload.period_number <= 0) return res.status(400).json({ error: 'Số thứ tự đợt phải lớn hơn 0.' });

      // Determine and validate target unit_id based on scope
      let assignedUnitId: string | null = payload.unit_id || null;
      if (scope.kind === 'unit' || scope.kind === 'unit_tree') {
        const allowedUnitIds = scope.unitIds || (scope.primaryUnitId ? [scope.primaryUnitId] : []);
        if (assignedUnitId) {
          if (!allowedUnitIds.includes(assignedUnitId)) {
            throw new AuthorizationError(
              'RESOURCE_OUT_OF_SCOPE',
              'Không thể tạo đợt tuyển sinh cho đơn vị ngoài phạm vi phân quyền của bạn.',
              403
            );
          }
        } else {
          assignedUnitId = scope.primaryUnitId || null;
        }
      } else if (scope.kind === 'own') {
        assignedUnitId = authContext.primaryUnitId || null;
      }

      const insertData = {
        code: cleanCode,
        name: cleanName,
        group_id: payload.group_id,
        year: payload.year,
        period_number: payload.period_number,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
        status: payload.status || 'planning',
        is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
        description: payload.description ? String(payload.description).trim() : null,
        unit_id: assignedUnitId,
        created_by: authContext.userId,
        updated_by: authContext.userId
      };

      const { data, error } = await supabaseAdmin
        .from('admission_campaigns')
        .insert(insertData)
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ error: `Mã đợt tuyển sinh "${cleanCode}" hoặc đợt số ${payload.period_number} đã tồn tại.` });
        }
        throw error;
      }

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_campaign',
        entityId: data.id,
        action: 'INSERT',
        unitId: assignedUnitId,
        campaignId: data.id,
        newData: data,
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.status(201).json(data);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.put(
  '/campaigns/:id',
  requireCapability(CAPABILITIES.ADMISSIONS_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_MANAGE, supabaseAdmin);
      const campaignId = req.params.id;

      const { data: existing, error: getErr } = await supabaseAdmin
        .from('admission_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (getErr || !existing) {
        return res.status(404).json({ error: 'Không tìm thấy đợt tuyển sinh.' });
      }

      // Assert data scope on existing record
      assertResourceInScope(existing, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Đợt tuyển sinh');

      const payload = req.body;
      const updateData: Record<string, any> = {
        updated_by: authContext.userId,
        updated_at: new Date().toISOString()
      };

      if (payload.code !== undefined) {
        const cleanCode = String(payload.code).trim().toUpperCase();
        if (cleanCode.length < 2) return res.status(400).json({ error: 'Mã đợt phải có ít nhất 2 ký tự.' });
        updateData.code = cleanCode;
      }
      if (payload.name !== undefined) {
        const cleanName = String(payload.name).trim();
        if (cleanName.length < 2) return res.status(400).json({ error: 'Tên đợt phải có ít nhất 2 ký tự.' });
        updateData.name = cleanName;
      }
      if (payload.group_id !== undefined) updateData.group_id = payload.group_id;
      if (payload.year !== undefined) updateData.year = payload.year;
      if (payload.period_number !== undefined) updateData.period_number = payload.period_number;
      if (payload.start_date !== undefined) updateData.start_date = payload.start_date || null;
      if (payload.end_date !== undefined) updateData.end_date = payload.end_date || null;
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.is_active !== undefined) updateData.is_active = Boolean(payload.is_active);
      if (payload.description !== undefined) updateData.description = payload.description ? String(payload.description).trim() : null;

      if (payload.unit_id !== undefined) {
        const targetUnitId = payload.unit_id || null;
        if (targetUnitId && (scope.kind === 'unit' || scope.kind === 'unit_tree')) {
          const allowedUnitIds = scope.unitIds || (scope.primaryUnitId ? [scope.primaryUnitId] : []);
          if (!allowedUnitIds.includes(targetUnitId)) {
            throw new AuthorizationError('RESOURCE_OUT_OF_SCOPE', 'Không thể gán đợt cho đơn vị ngoài phạm vi quản lý.', 403);
          }
        }
        updateData.unit_id = targetUnitId;
      }

      const { data, error } = await supabaseAdmin
        .from('admission_campaigns')
        .update(updateData)
        .eq('id', campaignId)
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ error: 'Mã đợt tuyển sinh hoặc số thứ tự đợt đã tồn tại.' });
        }
        throw error;
      }

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_campaign',
        entityId: campaignId,
        action: 'UPDATE',
        unitId: data.unit_id,
        campaignId: campaignId,
        oldData: existing,
        newData: data,
        changedFields: Object.keys(updateData),
        changeReason: payload.change_reason || null,
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.json(data);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.post(
  '/campaigns/:id/status',
  requireCapability(CAPABILITIES.ADMISSIONS_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_MANAGE, supabaseAdmin);
      const campaignId = req.params.id;
      const { status, change_reason } = req.body;

      const { data: existing, error: getErr } = await supabaseAdmin
        .from('admission_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (getErr || !existing) {
        return res.status(404).json({ error: 'Không tìm thấy đợt tuyển sinh.' });
      }

      assertResourceInScope(existing, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Đợt tuyển sinh');

      // Lifecycle check: reopening closed campaign requires minimum 5 chars reason
      if (existing.status === 'closed' && status === 'active') {
        if (!change_reason || String(change_reason).trim().length < 5) {
          return res.status(400).json({ error: 'Mở lại đợt tuyển sinh đã chốt bắt buộc phải có lý do cụ thể (tối thiểu 5 ký tự).' });
        }
      }

      const { data, error } = await supabaseAdmin
        .from('admission_campaigns')
        .update({
          status,
          updated_by: authContext.userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId)
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .single();

      if (error) throw error;

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_campaign',
        entityId: campaignId,
        action: 'UPDATE',
        unitId: data.unit_id,
        campaignId: campaignId,
        oldData: existing,
        newData: data,
        changedFields: ['status'],
        changeReason: change_reason || null,
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.json(data);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.delete(
  '/campaigns/:id',
  requireCapability(CAPABILITIES.ADMISSIONS_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_MANAGE, supabaseAdmin);
      const campaignId = req.params.id;

      const { data: existing, error: getErr } = await supabaseAdmin
        .from('admission_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (getErr || !existing) {
        return res.status(404).json({ error: 'Không tìm thấy đợt tuyển sinh.' });
      }

      assertResourceInScope(existing, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Đợt tuyển sinh');

      // Check for finalized results
      const { data: results } = await supabaseAdmin
        .from('admission_results')
        .select('id, data_status')
        .eq('campaign_id', campaignId);

      const hasFinalized = (results || []).some((r: any) => r.data_status === 'finalized');
      if (hasFinalized) {
        return res.status(400).json({ error: 'Không thể xóa đợt tuyển sinh đã có dữ liệu kết quả tuyển sinh được chốt (finalized).' });
      }

      // Cascade delete draft plans and results
      await supabaseAdmin.from('admission_plans').delete().eq('campaign_id', campaignId);
      await supabaseAdmin.from('admission_results').delete().eq('campaign_id', campaignId);
      await supabaseAdmin.from('admission_change_history').delete().eq('campaign_id', campaignId);

      const { error: delErr } = await supabaseAdmin
        .from('admission_campaigns')
        .delete()
        .eq('id', campaignId);

      if (delErr) throw delErr;

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_campaign',
        entityId: campaignId,
        action: 'DELETE',
        unitId: existing.unit_id,
        oldData: existing,
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.get(
  '/campaigns/:id/dependencies',
  requireCapability(CAPABILITIES.ADMISSIONS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_VIEW, supabaseAdmin);
      const campaignId = req.params.id;

      const { data: existing } = await supabaseAdmin
        .from('admission_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (!existing) {
        return res.status(404).json({ error: 'Không tìm thấy đợt tuyển sinh.' });
      }

      assertResourceInScope(existing, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Đợt tuyển sinh');

      const { count: plansCount } = await supabaseAdmin
        .from('admission_plans')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);

      const { data: results } = await supabaseAdmin
        .from('admission_results')
        .select('id, data_status')
        .eq('campaign_id', campaignId);

      const hasFinalizedResult = (results || []).some((r: any) => r.data_status === 'finalized');

      res.json({
        campaignId,
        plansCount: plansCount || 0,
        resultsCount: results?.length || 0,
        hasFinalizedResult,
        canDelete: !hasFinalizedResult
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

// ============================================================================
// 4. PLANS & ALLOCATIONS: KẾ HOẠCH NĂM & PHÂN BỔ (Nhiệm vụ 5 & 6)
// ============================================================================
admissionsRouter.get(
  '/plans',
  requireCapability(CAPABILITIES.ADMISSIONS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_VIEW, supabaseAdmin);

      let query = supabaseAdmin
        .from('admission_plans')
        .select('*, group:admission_groups(*), unit:organization_units(*), campaign:admission_campaigns(*)')
        .order('admission_year', { ascending: false });

      query = applyScopeToQuery(query, scope, { unitColumn: 'unit_id', userColumn: 'created_by' });

      if (req.query.year) query = query.eq('admission_year', Number(req.query.year));
      if (req.query.group_id && req.query.group_id !== 'all') query = query.eq('group_id', req.query.group_id);
      if (req.query.unit_id && req.query.unit_id !== 'all') query = query.eq('unit_id', req.query.unit_id);
      if (req.query.type === 'annual') query = query.is('campaign_id', null);
      if (req.query.type === 'campaign') query = query.not('campaign_id', 'is', null);

      const { data, error } = await query;
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.post(
  '/plans/annual',
  requireCapability(CAPABILITIES.ADMISSIONS_PLAN_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_PLAN_MANAGE, supabaseAdmin);

      const { admission_year, group_id, unit_id, target_paid_count, notes, status } = req.body;

      if (!admission_year || admission_year < 2000 || admission_year > 2100) {
        return res.status(400).json({ error: 'Năm tuyển sinh phải từ 2000 đến 2100.' });
      }
      if (!group_id) return res.status(400).json({ error: 'Vui lòng chọn nhóm tuyển sinh.' });
      if (target_paid_count === undefined || target_paid_count < 0) {
        return res.status(400).json({ error: 'Chỉ tiêu tuyển sinh phải lớn hơn hoặc bằng 0.' });
      }

      let assignedUnitId: string | null = unit_id || null;
      if (scope.kind === 'unit' || scope.kind === 'unit_tree') {
        const allowedUnitIds = scope.unitIds || (scope.primaryUnitId ? [scope.primaryUnitId] : []);
        if (assignedUnitId) {
          if (!allowedUnitIds.includes(assignedUnitId)) {
            throw new AuthorizationError('RESOURCE_OUT_OF_SCOPE', 'Không thể tạo kế hoạch cho đơn vị ngoài phạm vi.', 403);
          }
        } else {
          assignedUnitId = scope.primaryUnitId || null;
        }
      }

      const insertData = {
        admission_year,
        group_id,
        unit_id: assignedUnitId,
        target_paid_count: Number(target_paid_count),
        status: status || 'assigned',
        notes: notes ? String(notes).trim() : null,
        created_by: authContext.userId,
        updated_by: authContext.userId,
        approved_by: authContext.userId,
        approved_at: new Date().toISOString()
      };

      const { data, error } = await supabaseAdmin
        .from('admission_plans')
        .insert(insertData)
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .single();

      if (error) throw error;

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_plan',
        entityId: data.id,
        action: 'INSERT',
        unitId: assignedUnitId,
        newData: data,
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.status(201).json(data);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.put(
  '/plans/:id',
  requireCapability(CAPABILITIES.ADMISSIONS_PLAN_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_PLAN_MANAGE, supabaseAdmin);
      const planId = req.params.id;

      const { data: existing, error: getErr } = await supabaseAdmin
        .from('admission_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (getErr || !existing) {
        return res.status(404).json({ error: 'Không tìm thấy kế hoạch tuyển sinh.' });
      }

      assertResourceInScope(existing, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Kế hoạch tuyển sinh');

      // Immutability check: cannot edit locked plan
      if (existing.status === 'locked' && req.body.status !== 'draft') {
        return res.status(400).json({ error: 'Kế hoạch đã khóa (locked), không thể chỉnh sửa.' });
      }

      const updateData: Record<string, any> = {
        updated_by: authContext.userId,
        updated_at: new Date().toISOString()
      };

      if (req.body.target_paid_count !== undefined) updateData.target_paid_count = Number(req.body.target_paid_count);
      if (req.body.notes !== undefined) updateData.notes = req.body.notes ? String(req.body.notes).trim() : null;
      if (req.body.status !== undefined) updateData.status = req.body.status;

      const { data, error } = await supabaseAdmin
        .from('admission_plans')
        .update(updateData)
        .eq('id', planId)
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .single();

      if (error) throw error;

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_plan',
        entityId: planId,
        action: 'UPDATE',
        unitId: data.unit_id,
        oldData: existing,
        newData: data,
        changedFields: Object.keys(updateData),
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.json(data);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

// Campaign allocations (Nhiệm vụ 6)
admissionsRouter.get(
  '/plans/allocations',
  requireCapability(CAPABILITIES.ADMISSIONS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_VIEW, supabaseAdmin);

      const year = Number(req.query.year || 2026);
      const groupId = req.query.group_id as string;
      const unitId = req.query.unit_id as string;

      // 1. Fetch parent annual plan
      let annualQuery = supabaseAdmin
        .from('admission_plans')
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .eq('admission_year', year)
        .eq('group_id', groupId)
        .is('campaign_id', null)
        .is('program_id', null);

      annualQuery = applyScopeToQuery(annualQuery, scope, { unitColumn: 'unit_id', userColumn: 'created_by' });
      if (unitId && unitId !== 'all') annualQuery = annualQuery.eq('unit_id', unitId);

      const { data: annualPlans } = await annualQuery.limit(1);
      const annualPlan = annualPlans && annualPlans.length > 0 ? annualPlans[0] : null;

      // 2. Fetch eligible campaigns
      let campaignsQuery = supabaseAdmin
        .from('admission_campaigns')
        .select('*')
        .eq('year', year)
        .eq('group_id', groupId)
        .eq('is_active', true)
        .order('period_number', { ascending: true });

      campaignsQuery = applyScopeToQuery(campaignsQuery, scope, { unitColumn: 'unit_id', userColumn: 'created_by' });
      const { data: campaigns } = await campaignsQuery;

      // 3. Fetch campaign plan allocations
      let allocationsQuery = supabaseAdmin
        .from('admission_plans')
        .select('*')
        .eq('admission_year', year)
        .eq('group_id', groupId)
        .not('campaign_id', 'is', null)
        .is('program_id', null);

      allocationsQuery = applyScopeToQuery(allocationsQuery, scope, { unitColumn: 'unit_id', userColumn: 'created_by' });
      const { data: allocations } = await allocationsQuery;

      res.json({
        annualPlan,
        campaigns: campaigns || [],
        allocations: allocations || []
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.post(
  '/plans/allocations',
  requireCapability(CAPABILITIES.ADMISSIONS_ALLOCATE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_ALLOCATE, supabaseAdmin);

      const { annual_plan_id, allocations } = req.body;

      // Fetch annual plan
      const { data: annualPlan, error: planErr } = await supabaseAdmin
        .from('admission_plans')
        .select('*')
        .eq('id', annual_plan_id)
        .single();

      if (planErr || !annualPlan) {
        return res.status(404).json({ error: 'Không tìm thấy kế hoạch năm.' });
      }

      assertResourceInScope(annualPlan, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Kế hoạch năm');

      if (annualPlan.status === 'locked') {
        return res.status(400).json({ error: 'Kế hoạch năm đã khóa, không thể phân bổ lại.' });
      }

      // Validate allocations target total
      let newTotal = 0;
      for (const item of (allocations || [])) {
        const val = Number(item.target_paid_count || 0);
        if (val < 0) return res.status(400).json({ error: 'Chỉ tiêu phân bổ không được âm.' });
        newTotal += val;
      }

      if (newTotal > annualPlan.target_paid_count) {
        return res.status(400).json({
          error: `Tổng chỉ tiêu phân bổ (${newTotal.toLocaleString()}) vượt quá chỉ tiêu kế hoạch năm (${annualPlan.target_paid_count.toLocaleString()}).`
        });
      }

      // Upsert allocations
      const savedAllocations: any[] = [];
      for (const item of (allocations || [])) {
        const { data: existing } = await supabaseAdmin
          .from('admission_plans')
          .select('id')
          .eq('campaign_id', item.campaign_id)
          .is('program_id', null)
          .maybeSingle();

        const planPayload = {
          admission_year: annualPlan.admission_year,
          group_id: annualPlan.group_id,
          unit_id: annualPlan.unit_id,
          campaign_id: item.campaign_id,
          program_id: null,
          target_paid_count: Number(item.target_paid_count || 0),
          status: item.status || 'draft',
          notes: item.notes || null,
          updated_by: authContext.userId,
          updated_at: new Date().toISOString()
        };

        if (existing?.id) {
          const { data } = await supabaseAdmin
            .from('admission_plans')
            .update(planPayload)
            .eq('id', existing.id)
            .select()
            .single();
          if (data) savedAllocations.push(data);
        } else {
          const { data } = await supabaseAdmin
            .from('admission_plans')
            .insert({ ...planPayload, created_by: authContext.userId })
            .select()
            .single();
          if (data) savedAllocations.push(data);
        }
      }

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_plan',
        entityId: annual_plan_id,
        action: 'UPDATE',
        unitId: annualPlan.unit_id,
        newData: { allocatedTotal: newTotal, allocationsCount: savedAllocations.length },
        changeReason: 'Phân bổ chỉ tiêu cho các đợt tuyển sinh',
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.json({ success: true, count: savedAllocations.length, allocations: savedAllocations });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

// ============================================================================
// 5. RESULTS: KẾT QUẢ TUYỂN SINH & ITEMS (Nhiệm vụ 7)
// ============================================================================
admissionsRouter.get(
  '/results/campaign/:campaignId',
  requireCapability(CAPABILITIES.ADMISSIONS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_VIEW, supabaseAdmin);
      const campaignId = req.params.campaignId;

      const { data: campaign, error: campErr } = await supabaseAdmin
        .from('admission_campaigns')
        .select('*, group:admission_groups(*)')
        .eq('id', campaignId)
        .single();

      if (campErr || !campaign) {
        return res.status(404).json({ error: 'Không tìm thấy đợt tuyển sinh.' });
      }

      assertResourceInScope(campaign, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Đợt tuyển sinh');

      const { data: result } = await supabaseAdmin
        .from('admission_results')
        .select('*')
        .eq('campaign_id', campaignId)
        .maybeSingle();

      let items: any[] = [];
      if (result?.id) {
        const { data: itemData } = await supabaseAdmin
          .from('admission_result_items')
          .select('*, program:admission_programs(*)')
          .eq('result_id', result.id)
          .order('sort_order', { ascending: true });
        items = itemData || [];
      }

      res.json({ campaign, result: result || null, items });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.post(
  '/results/manual-total',
  requireCapability(CAPABILITIES.ADMISSIONS_RESULT_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_RESULT_UPDATE, supabaseAdmin);

      const { campaign_id, registered_count, paid_count, notes } = req.body;

      const { data: campaign, error: campErr } = await supabaseAdmin
        .from('admission_campaigns')
        .select('*')
        .eq('id', campaign_id)
        .single();

      if (campErr || !campaign) {
        return res.status(404).json({ error: 'Không tìm thấy đợt tuyển sinh.' });
      }

      assertResourceInScope(campaign, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Đợt tuyển sinh');

      const registered = registered_count !== null && registered_count !== undefined ? Number(registered_count) : null;
      const paid = paid_count !== null && paid_count !== undefined ? Number(paid_count) : null;

      if (registered !== null && (isNaN(registered) || registered < 0)) {
        return res.status(400).json({ error: 'Số lượng đăng ký phải lớn hơn hoặc bằng 0.' });
      }
      if (paid !== null && (isNaN(paid) || paid < 0)) {
        return res.status(400).json({ error: 'Số lượng đóng học phí phải lớn hơn hoặc bằng 0.' });
      }
      if (paid !== null && registered !== null && paid > registered) {
        return res.status(400).json({ error: 'Số lượng đóng học phí không được vượt quá số lượng đăng ký.' });
      }

      const { data: existing } = await supabaseAdmin
        .from('admission_results')
        .select('*')
        .eq('campaign_id', campaign_id)
        .maybeSingle();

      if (existing && existing.data_status === 'finalized') {
        return res.status(400).json({ error: 'Không thể sửa kết quả đã chốt (finalized). Vui lòng mở lại (reopen) trước.' });
      }

      let resData: any = null;
      if (existing?.id) {
        const { data, error } = await supabaseAdmin
          .from('admission_results')
          .update({
            registered_count: registered,
            paid_count: paid,
            entry_mode: 'manual_total',
            data_status: 'draft',
            notes: notes ? String(notes).trim() : null,
            updated_by: authContext.userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        resData = data;

        await logAdmissionAudit(supabaseAdmin, {
          entityType: 'admission_result',
          entityId: existing.id,
          action: 'UPDATE',
          unitId: campaign.unit_id,
          campaignId: campaign.id,
          oldData: existing,
          newData: resData,
          changedBy: authContext.userId,
          requestId: authContext.requestId
        });
      } else {
        const { data, error } = await supabaseAdmin
          .from('admission_results')
          .insert({
            campaign_id,
            registered_count: registered,
            paid_count: paid,
            entry_mode: 'manual_total',
            data_status: 'draft',
            source_type: 'system',
            notes: notes ? String(notes).trim() : null,
            created_by: authContext.userId,
            updated_by: authContext.userId
          })
          .select()
          .single();

        if (error) throw error;
        resData = data;

        await logAdmissionAudit(supabaseAdmin, {
          entityType: 'admission_result',
          entityId: resData.id,
          action: 'INSERT',
          unitId: campaign.unit_id,
          campaignId: campaign.id,
          newData: resData,
          changedBy: authContext.userId,
          requestId: authContext.requestId
        });
      }

      res.json(resData);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.post(
  '/results/detail-items',
  requireCapability(CAPABILITIES.ADMISSIONS_RESULT_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_RESULT_UPDATE, supabaseAdmin);

      const { campaign_id, items, notes } = req.body;

      const { data: campaign, error: campErr } = await supabaseAdmin
        .from('admission_campaigns')
        .select('*')
        .eq('id', campaign_id)
        .single();

      if (campErr || !campaign) {
        return res.status(404).json({ error: 'Không tìm thấy đợt tuyển sinh.' });
      }

      assertResourceInScope(campaign, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Đợt tuyển sinh');

      const { data: existingResult } = await supabaseAdmin
        .from('admission_results')
        .select('*')
        .eq('campaign_id', campaign_id)
        .maybeSingle();

      if (existingResult && existingResult.data_status === 'finalized') {
        return res.status(400).json({ error: 'Không thể sửa chi tiết của kết quả đã chốt (finalized).' });
      }

      // Validate items & calculate totals
      let sumReg = 0;
      let sumPaid = 0;
      for (const item of (items || [])) {
        const reg = item.registered_count !== null && item.registered_count !== undefined ? Number(item.registered_count) : null;
        const paid = item.paid_count !== null && item.paid_count !== undefined ? Number(item.paid_count) : null;
        if (reg !== null && reg < 0) return res.status(400).json({ error: 'Số đăng ký không được âm.' });
        if (paid !== null && paid < 0) return res.status(400).json({ error: 'Số nộp tiền không được âm.' });
        if (paid !== null && reg !== null && paid > reg) {
          return res.status(400).json({ error: 'Số tiền đóng không được lớn hơn số đăng ký.' });
        }
        if (reg !== null) sumReg += reg;
        if (paid !== null) sumPaid += paid;
      }

      let resultId = existingResult?.id;
      if (!resultId) {
        const { data: newRes, error: insErr } = await supabaseAdmin
          .from('admission_results')
          .insert({
            campaign_id,
            registered_count: sumReg,
            paid_count: sumPaid,
            entry_mode: 'detail_sum',
            data_status: 'draft',
            source_type: 'system',
            notes: notes ? String(notes).trim() : null,
            created_by: authContext.userId,
            updated_by: authContext.userId
          })
          .select()
          .single();
        if (insErr) throw insErr;
        resultId = newRes.id;
      } else {
        await supabaseAdmin
          .from('admission_results')
          .update({
            registered_count: sumReg,
            paid_count: sumPaid,
            entry_mode: 'detail_sum',
            data_status: 'draft',
            notes: notes !== undefined ? (notes ? String(notes).trim() : null) : existingResult.notes,
            updated_by: authContext.userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', resultId);
      }

      // Upsert detail items
      await supabaseAdmin.from('admission_result_items').delete().eq('result_id', resultId);
      if (items && items.length > 0) {
        const itemRows = items.map((it: any, idx: number) => ({
          result_id: resultId,
          program_id: it.program_id,
          registered_count: it.registered_count !== null ? Number(it.registered_count) : null,
          paid_count: it.paid_count !== null ? Number(it.paid_count) : null,
          not_converted_note: it.not_converted_note || null,
          sort_order: it.sort_order ?? idx,
          created_by: authContext.userId,
          updated_by: authContext.userId
        }));
        await supabaseAdmin.from('admission_result_items').insert(itemRows);
      }

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_result',
        entityId: resultId,
        action: 'UPDATE',
        unitId: campaign.unit_id,
        campaignId: campaign.id,
        newData: { registered_count: sumReg, paid_count: sumPaid, items_count: items?.length || 0 },
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.json({ success: true, result_id: resultId, registered_count: sumReg, paid_count: sumPaid });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

// ============================================================================
// 6. FINALIZE & REOPEN: CHỐT & MỞ LẠI KẾT QUẢ (Nhiệm vụ 8)
// ============================================================================
admissionsRouter.post(
  ['/results/:id/finalize', '/finalize'],
  requireCapability(CAPABILITIES.ADMISSIONS_LOCK),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_LOCK, supabaseAdmin);

      const resultId = req.params.id || req.body.p_result_id || req.body.result_id;
      const note = req.body.p_note !== undefined ? req.body.p_note : req.body.note;

      if (!resultId) {
        return res.status(400).json({ error: 'Thiếu mã kết quả tuyển sinh.' });
      }

      const { data: result, error: fetchErr } = await supabaseAdmin
        .from('admission_results')
        .select('*, campaign:admission_campaigns(*)')
        .eq('id', resultId)
        .single();

      if (fetchErr || !result) {
        return res.status(404).json({ error: 'Không tìm thấy kết quả tuyển sinh.' });
      }

      // Check data scope using campaign's unit_id
      assertResourceInScope(result.campaign, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Kết quả tuyển sinh');

      if (result.data_status === 'finalized') {
        return res.status(400).json({ error: 'Kết quả tuyển sinh đã được chốt trước đó.' });
      }

      let targetRegistered = result.registered_count;
      let targetPaid = result.paid_count;

      if (result.entry_mode === 'detail_sum') {
        const { data: items, error: itemErr } = await supabaseAdmin
          .from('admission_result_items')
          .select('*')
          .eq('result_id', resultId);

        if (itemErr || !items || items.length === 0) {
          return res.status(400).json({
            error: 'Không thể chốt đợt tuyển sinh theo chi tiết (detail_sum) khi chưa có dòng chi tiết nào.'
          });
        }

        const sumReg = items.reduce((acc: number, cur: any) => acc + (cur.registered_count || 0), 0);
        const sumPaid = items.reduce((acc: number, cur: any) => acc + (cur.paid_count || 0), 0);

        if (sumPaid > sumReg) {
          return res.status(400).json({ error: 'Số lượng đóng học phí không được lớn hơn số lượng đăng ký.' });
        }

        targetRegistered = sumReg;
        targetPaid = sumPaid;
      } else if (result.entry_mode === 'manual_total') {
        if (result.registered_count === null || result.paid_count === null) {
          return res.status(400).json({ error: 'Vui lòng nhập đầy đủ số lượng đăng ký và đóng học phí trước khi chốt.' });
        }
        if (result.paid_count > result.registered_count) {
          return res.status(400).json({ error: 'Số lượng đóng học phí không được lớn hơn số lượng đăng ký.' });
        }
      }

      const { data: updatedResult, error: updErr } = await supabaseAdmin
        .from('admission_results')
        .update({
          registered_count: targetRegistered,
          paid_count: targetPaid,
          data_status: 'finalized',
          finalized_by: authContext.userId,
          finalized_at: new Date().toISOString(),
          notes: note !== undefined && note !== null && String(note).trim() !== '' ? String(note).trim() : result.notes,
          updated_by: authContext.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resultId)
        .select()
        .single();

      if (updErr || !updatedResult) {
        return res.status(500).json({ error: updErr?.message || 'Không thể chốt kết quả tuyển sinh' });
      }

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_result',
        entityId: resultId,
        action: 'FINALIZE',
        unitId: result.campaign?.unit_id,
        campaignId: result.campaign_id,
        oldData: result,
        newData: updatedResult,
        changeReason: note || 'Chốt số liệu tuyển sinh',
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.json(updatedResult);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

admissionsRouter.post(
  ['/results/:id/reopen', '/reopen'],
  requireCapability(CAPABILITIES.ADMISSIONS_REOPEN),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_REOPEN, supabaseAdmin);

      const resultId = req.params.id || req.body.p_result_id || req.body.result_id;
      const reason = req.body.p_reason !== undefined ? req.body.p_reason : req.body.reason;

      if (!resultId) {
        return res.status(400).json({ error: 'Thiếu mã kết quả tuyển sinh.' });
      }

      if (!reason || String(reason).trim().length < 5) {
        return res.status(400).json({ error: 'Lý do mở lại phải có ít nhất 5 ký tự.' });
      }

      const cleanReason = String(reason).trim();

      const { data: result, error: fetchErr } = await supabaseAdmin
        .from('admission_results')
        .select('*, campaign:admission_campaigns(*)')
        .eq('id', resultId)
        .single();

      if (fetchErr || !result) {
        return res.status(404).json({ error: 'Không tìm thấy kết quả tuyển sinh.' });
      }

      assertResourceInScope(result.campaign, scope, { unitColumn: 'unit_id', userColumn: 'created_by' }, 'Kết quả tuyển sinh');

      if (result.data_status === 'draft') {
        return res.status(400).json({ error: 'Kết quả tuyển sinh đang ở trạng thái draft, không cần mở lại.' });
      }

      const { data: updatedResult, error: updErr } = await supabaseAdmin
        .from('admission_results')
        .update({
          data_status: 'draft',
          finalized_by: null,
          finalized_at: null,
          reopen_reason: cleanReason,
          reopened_by: authContext.userId,
          reopened_at: new Date().toISOString(),
          updated_by: authContext.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resultId)
        .select()
        .single();

      if (updErr || !updatedResult) {
        return res.status(500).json({ error: updErr?.message || 'Không thể mở lại kết quả tuyển sinh' });
      }

      await logAdmissionAudit(supabaseAdmin, {
        entityType: 'admission_result',
        entityId: resultId,
        action: 'REOPEN',
        unitId: result.campaign?.unit_id,
        campaignId: result.campaign_id,
        oldData: result,
        newData: updatedResult,
        changeReason: cleanReason,
        changedBy: authContext.userId,
        requestId: authContext.requestId
      });

      res.json(updatedResult);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

// ============================================================================
// 7. AUDIT HISTORY: LỊCH SỬ THAY ĐỔI (Nhiệm vụ 9)
// ============================================================================
admissionsRouter.get(
  '/history',
  requireCapability(CAPABILITIES.ADMISSIONS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_VIEW, supabaseAdmin);

      let query = supabaseAdmin
        .from('admission_change_history')
        .select('*, changed_by_user:profiles(full_name, email)')
        .order('changed_at', { ascending: false });

      query = applyScopeToQuery(query, scope, { unitColumn: 'unit_id', userColumn: 'changed_by' });

      if (req.query.entity_type) query = query.eq('entity_type', req.query.entity_type);
      if (req.query.entity_id) query = query.eq('entity_id', req.query.entity_id);
      if (req.query.campaign_id) query = query.eq('campaign_id', req.query.campaign_id);

      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const { data, error } = await query.limit(limit);
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

// ============================================================================
// 8. EXPORT: XUẤT BÁO CÁO (Nhiệm vụ 14)
// ============================================================================
admissionsRouter.get(
  '/export',
  requireCapability(CAPABILITIES.ADMISSIONS_EXPORT),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const scope = await resolveEffectiveScope(authContext, CAPABILITIES.ADMISSIONS_EXPORT, supabaseAdmin);

      const year = req.query.year ? Number(req.query.year) : 2026;

      let campaignsQuery = supabaseAdmin
        .from('admission_campaigns')
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .eq('year', year)
        .order('period_number', { ascending: true });

      campaignsQuery = applyScopeToQuery(campaignsQuery, scope, { unitColumn: 'unit_id', userColumn: 'created_by' });
      const { data: campaigns, error: campErr } = await campaignsQuery;
      if (campErr) throw campErr;

      let resultsQuery = supabaseAdmin
        .from('admission_results')
        .select('*, items:admission_result_items(*, program:admission_programs(*))');
      const { data: results, error: resErr } = await resultsQuery;
      if (resErr) throw resErr;

      const resultMap = new Map<string, any>();
      (results || []).forEach((r: any) => { resultMap.set(r.campaign_id, r); });

      const exportRows = (campaigns || []).map((c: any) => {
        const r = resultMap.get(c.id);
        return {
          campaign_id: c.id,
          campaign_code: c.code,
          campaign_name: c.name,
          group_name: c.group?.name || '',
          unit_name: c.unit?.name || 'Toàn trường',
          period_number: c.period_number,
          status: c.status,
          registered_count: r ? r.registered_count : 0,
          paid_count: r ? r.paid_count : 0,
          conversion_rate: r && r.registered_count ? Math.round((r.paid_count / r.registered_count) * 100) : 0,
          data_status: r ? r.data_status : 'not_started',
          items: r ? r.items : []
        };
      });

      res.json({
        year,
        totalCampaigns: exportRows.length,
        exportedAt: new Date().toISOString(),
        rows: exportRows
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  }
);

// ============================================================================
// 9. GOOGLE SHEETS INTEGRATION (Nhiệm vụ 11 - 15)
// ============================================================================
admissionsRouter.get(
  '/google-sheets/config',
  requireCapability(CAPABILITIES.ADMISSIONS_SHEET_CONFIGURE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const config = await googleSheetsBackendService.getConfig(supabaseAdmin);
      const masked = config ? { ...config, private_key: config.private_key ? '***MASKED***' : null } : null;
      res.json(masked);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
);

admissionsRouter.post(
  '/google-sheets/config',
  requireCapability(CAPABILITIES.ADMISSIONS_SHEET_CONFIGURE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const updated = await googleSheetsBackendService.saveConfig(supabaseAdmin, req.body, authContext.userId);
      const masked = updated ? { ...updated, private_key: updated.private_key ? '***MASKED***' : null } : null;
      res.json(masked);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
);

admissionsRouter.post(
  '/google-sheets/test-connection',
  requireCapability(CAPABILITIES.ADMISSIONS_SHEET_CONFIGURE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const { spreadsheet_id, service_account_email, private_key } = req.body;
      const result = await googleSheetsBackendService.testConnection(
        spreadsheet_id,
        service_account_email,
        private_key,
        supabaseAdmin
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Lỗi kết nối Google Sheets' });
    }
  }
);

admissionsRouter.post(
  '/google-sheets/preview',
  requireCapability(CAPABILITIES.ADMISSIONS_SHEET_VALIDATE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const { spreadsheet_id, source_year, service_account_email, private_key } = req.body;
      const result = await googleSheetsBackendService.previewSpreadsheet(
        spreadsheet_id,
        source_year || 2026,
        service_account_email,
        private_key,
        supabaseAdmin
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Lỗi đọc và phân tích dữ liệu Google Sheets' });
    }
  }
);

admissionsRouter.get(
  '/google-sheets/mappings',
  requireCapability(CAPABILITIES.ADMISSIONS_SHEET_CONFIGURE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const sourceId = req.query.source_id as string;

      let campaignMappings: any[] = [];
      let programMappings: any[] = [];

      try {
        const { data: cData } = await supabaseAdmin
          .from('admission_sheet_campaign_mappings')
          .select('*')
          .eq('source_id', sourceId || '');
        if (cData) campaignMappings = cData;
      } catch {}

      try {
        const { data: pData } = await supabaseAdmin
          .from('admission_sheet_program_mappings')
          .select('*')
          .eq('source_id', sourceId || '');
        if (pData) programMappings = pData;
      } catch {}

      res.json({ campaignMappings, programMappings });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
);

admissionsRouter.post(
  '/google-sheets/mappings',
  requireCapability(CAPABILITIES.ADMISSIONS_SHEET_CONFIGURE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const userId = authContext.userId;
      const { type, source_id, mappings } = req.body;

      if (type === 'campaign') {
        for (const m of mappings) {
          const payload = {
            source_id,
            source_sheet_name: m.source_sheet_name,
            source_group_code: m.source_group_code,
            source_date: m.source_date || null,
            campaign_id: m.campaign_id || null,
            mapping_status: m.mapping_status,
            ignore_reason: m.ignore_reason || null,
            updated_by: userId,
            updated_at: new Date().toISOString()
          };

          const { data: existing } = await supabaseAdmin
            .from('admission_sheet_campaign_mappings')
            .select('id')
            .eq('source_id', source_id)
            .eq('source_sheet_name', m.source_sheet_name)
            .limit(1);

          if (existing && existing.length > 0) {
            await supabaseAdmin
              .from('admission_sheet_campaign_mappings')
              .update(payload)
              .eq('id', existing[0].id);
          } else {
            await supabaseAdmin
              .from('admission_sheet_campaign_mappings')
              .insert([{ ...payload, created_by: userId, created_at: new Date().toISOString() }]);
          }
        }
      } else if (type === 'program') {
        for (const m of mappings) {
          const payload = {
            source_id,
            group_id: m.group_id,
            source_program_name: m.source_program_name,
            normalized_source_name: m.normalized_source_name,
            program_id: m.program_id || null,
            mapping_status: m.mapping_status,
            ignore_reason: m.ignore_reason || null,
            updated_by: userId,
            updated_at: new Date().toISOString()
          };

          const { data: existing } = await supabaseAdmin
            .from('admission_sheet_program_mappings')
            .select('id')
            .eq('source_id', source_id)
            .eq('group_id', m.group_id)
            .eq('source_program_name', m.source_program_name)
            .limit(1);

          if (existing && existing.length > 0) {
            await supabaseAdmin
              .from('admission_sheet_program_mappings')
              .update(payload)
              .eq('id', existing[0].id);
          } else {
            await supabaseAdmin
              .from('admission_sheet_program_mappings')
              .insert([{ ...payload, created_by: userId, created_at: new Date().toISOString() }]);
          }
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
);

admissionsRouter.post(
  '/google-sheets/validate',
  requireCapability(CAPABILITIES.ADMISSIONS_SHEET_VALIDATE),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const { spreadsheet_id, sheets, source_hash } = req.body;

      let activeCampaigns: any[] = [];
      let activePrograms: any[] = [];
      let existingResults: any[] = [];
      let campaignMappings: any[] = [];
      let programMappings: any[] = [];

      const { data: campData } = await supabaseAdmin.from('admission_campaigns').select('*, group:admission_groups(*), unit:admission_units(*)');
      if (campData) activeCampaigns = campData;

      const { data: progData } = await supabaseAdmin.from('admission_programs').select('*, group:admission_groups(*)');
      if (progData) activePrograms = progData;

      const { data: resData } = await supabaseAdmin.from('admission_results').select('*');
      if (resData) existingResults = resData;

      try {
        const { data: cmData } = await supabaseAdmin.from('admission_sheet_campaign_mappings').select('*').eq('source_id', spreadsheet_id);
        if (cmData) campaignMappings = cmData;
      } catch {}

      try {
        const { data: pmData } = await supabaseAdmin.from('admission_sheet_program_mappings').select('*').eq('source_id', spreadsheet_id);
        if (pmData) programMappings = pmData;
      } catch {}

      const report = validateSheetsData(
        sheets || [],
        campaignMappings,
        programMappings,
        existingResults,
        activeCampaigns,
        activePrograms,
        source_hash
      );

      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
);

admissionsRouter.post(
  '/google-sheets/sync',
  requireCapability(CAPABILITIES.ADMISSIONS_SYNC),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const authContext = await getRequestAuthorizationContext(req, res);
      const { spreadsheet_id, selected_sheets, idempotency_key, service_account_email, private_key } = req.body;

      if (!selected_sheets || !Array.isArray(selected_sheets) || selected_sheets.length === 0) {
        return res.status(400).json({ error: 'Vui lòng chọn ít nhất một sheet để đồng bộ.' });
      }

      const preview = await googleSheetsBackendService.previewSpreadsheet(
        spreadsheet_id,
        2026,
        service_account_email,
        private_key,
        supabaseAdmin
      );
      const freshSheets = preview.sheets || [];

      let campaignMappings: any[] = [];
      let programMappings: any[] = [];
      try {
        const { data: cmData } = await supabaseAdmin.from('admission_sheet_campaign_mappings').select('*').eq('source_id', spreadsheet_id);
        if (cmData) campaignMappings = cmData;
      } catch {}
      try {
        const { data: pmData } = await supabaseAdmin.from('admission_sheet_program_mappings').select('*').eq('source_id', spreadsheet_id);
        if (pmData) programMappings = pmData;
      } catch {}

      const result = await executeSyncBatch(
        supabaseAdmin,
        authContext.userId,
        spreadsheet_id,
        selected_sheets,
        idempotency_key,
        freshSheets,
        campaignMappings,
        programMappings
      );

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
);

admissionsRouter.get(
  '/google-sheets/sync-history',
  requireAnyCapability([CAPABILITIES.ADMISSIONS_SHEET_CONFIGURE, CAPABILITIES.ADMISSIONS_VIEW]),
  async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req, res);
      const sourceId = req.query.source_id as string;

      let query = supabaseAdmin
        .from('admission_sync_batches')
        .select('*, sheets:admission_sync_batch_sheets(*)')
        .order('created_at', { ascending: false });

      if (sourceId) {
        query = query.eq('source_id', sourceId);
      }

      const { data, error } = await query.limit(20);
      if (error) {
        if (error.message && (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist'))) {
          return res.json([]);
        }
        throw new Error(error.message);
      }

      res.json(data || []);
    } catch (err: any) {
      res.json([]);
    }
  }
);
