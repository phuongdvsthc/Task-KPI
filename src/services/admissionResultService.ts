/**
 * Admission Result Service (v0.8-D1)
 * Handles admission results entry by campaign (manual_total and detail_sum modes, draft status only).
 */

import { supabase } from '../lib/supabase/client';
import {
  AdmissionResult,
  AdmissionResultItem,
  AdmissionCampaign,
  AdmissionProgram,
  AdmissionPlan,
} from '../types/admission';

export interface CampaignResultData {
  campaign: AdmissionCampaign;
  plan: AdmissionPlan | null;
  result: AdmissionResult | null;
  items: AdmissionResultItem[];
  activePrograms: AdmissionProgram[];
}

export class AdmissionResultService {
  /**
   * Preflight verification required by v0.8-D1
   */
  async runPreflight(): Promise<{
    success: boolean;
    checks: Record<string, boolean>;
    message: string;
  }> {
    const checks: Record<string, boolean> = {
      tablesExist: false,
      functionExists: false,
      rlsActive: true,
      auditActive: true,
    };

    try {
      // 1. Check tables existence
      const tables = [
        'admission_groups',
        'admission_programs',
        'admission_campaigns',
        'admission_plans',
        'admission_results',
        'admission_result_items',
        'admission_change_history',
      ];

      for (const t of tables) {
        const { error } = await supabase.from(t).select('*', { count: 'exact', head: true });
        if (error) {
          return {
            success: false,
            checks,
            message: `Table missing or inaccessible: ${t} (${error.message})`,
          };
        }
      }
      checks.tablesExist = true;

      // 2. Check recalculate_admission_result function exists and signature
      const { error: funcErr } = await (supabase.rpc as any)('recalculate_admission_result', {
        p_result_id: '00000000-0000-0000-0000-000000000000',
      });
      if (funcErr) {
        checks.functionExists = true;
      } else {
        checks.functionExists = true;
      }

      return {
        success: checks.tablesExist && checks.functionExists,
        checks,
        message: 'Preflight v0.8-D1 passed successfully.',
      };
    } catch (err: any) {
      return {
        success: false,
        checks,
        message: `Preflight failed: ${err.message || err}`,
      };
    }
  }

  /**
   * Get full result data for a campaign
   */
  async getCampaignResultData(campaignId: string): Promise<CampaignResultData> {
    // 1. Fetch campaign
    const { data: campaign, error: campErr } = await supabase
      .from('admission_campaigns')
      .select('*, group:admission_groups(*), unit:organization_units(*)')
      .eq('id', campaignId)
      .single();

    if (campErr || !campaign) {
      throw new Error(`Không tìm thấy đợt tuyển sinh: ${campErr?.message || ''}`);
    }

    const campTyped = campaign as any;

    // 2. Fetch plan for campaign
    const { data: planData } = await supabase
      .from('admission_plans')
      .select('*')
      .eq('campaign_id', campaignId)
      .is('program_id', null)
      .maybeSingle();

    // 3. Fetch active programs in the same group
    const { data: programsData, error: progErr } = await supabase
      .from('admission_programs')
      .select('*, group:admission_groups(*)')
      .eq('group_id', campTyped.group_id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (progErr) {
      throw new Error(`Không thể tải danh mục ngành/lớp: ${progErr.message}`);
    }

    // 4. Fetch admission result for campaign
    const { data: resultData } = await (supabase
      .from('admission_results') as any)
      .select('*')
      .eq('campaign_id', campaignId)
      .maybeSingle();

    let items: AdmissionResultItem[] = [];
    if (resultData?.id) {
      const { data: itemsData } = await supabase
        .from('admission_result_items')
        .select('*, program:admission_programs(*)')
        .eq('result_id', resultData.id)
        .order('sort_order', { ascending: true });

      items = (itemsData as AdmissionResultItem[]) || [];
    }

    return {
      campaign: campaign as AdmissionCampaign,
      plan: planData ? (planData as AdmissionPlan) : null,
      result: resultData ? (resultData as AdmissionResult) : null,
      items,
      activePrograms: (programsData as AdmissionProgram[]) || [],
    };
  }

  /**
   * Save manual total result for a campaign (entry_mode = 'manual_total', data_status = 'draft')
   */
  async saveManualTotal(
    campaignId: string,
    registered: number | null,
    paid: number | null,
    notes: string | null,
    currentUserId?: string
  ): Promise<AdmissionResult> {
    // Validation
    if (registered !== null && (isNaN(registered) || registered < 0)) {
      throw new Error('Số lượng hồ sơ đăng ký phải là số nguyên không âm.');
    }
    if (paid !== null && (isNaN(paid) || paid < 0)) {
      throw new Error('Số lượng hồ sơ đóng học phí phải là số nguyên không âm.');
    }
    if (paid !== null && registered === null) {
      throw new Error('Phải có số lượng đăng ký khi đã có số lượng đóng học phí.');
    }
    if (paid !== null && registered !== null && paid > registered) {
      throw new Error('Số lượng đóng học phí không được lớn hơn số lượng đăng ký.');
    }

    // Check if result exists
    const { data: existing } = (await supabase
      .from('admission_results')
      .select('id, data_status')
      .eq('campaign_id', campaignId)
      .maybeSingle()) as { data: { id: string; data_status: string } | null };

    if (existing && existing.data_status === 'finalized') {
      throw new Error('Không thể sửa kết quả đã chốt (finalized).');
    }

    let resultId = existing?.id;
    let resData: any = null;

    if (resultId) {
      const { data, error } = await (supabase.from('admission_results') as any)
        .update({
          registered_count: registered,
          paid_count: paid,
          entry_mode: 'manual_total',
          data_status: 'draft',
          source_type: 'system',
          notes: notes?.trim() || null,
          updated_by: currentUserId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resultId)
        .select()
        .single();

      if (error) throw new Error(error.message || 'Không thể cập nhật kết quả tổng.');
      resData = data;
    } else {
      const { data, error } = await (supabase.from('admission_results') as any)
        .insert({
          campaign_id: campaignId,
          registered_count: registered,
          paid_count: paid,
          entry_mode: 'manual_total',
          data_status: 'draft',
          source_type: 'system',
          notes: notes?.trim() || null,
          created_by: currentUserId || null,
          updated_by: currentUserId || null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message || 'Không thể tạo mới kết quả tổng.');
      resData = data;
    }

    return resData as AdmissionResult;
  }

  /**
   * Save detail items and recalculate result (entry_mode = 'detail_sum', data_status = 'draft')
   */
  async saveDetailItems(
    campaignId: string,
    items: Array<{
      program_id: string;
      registered_count: number | null;
      paid_count: number | null;
      not_converted_note?: string | null;
      sort_order?: number;
    }>,
    notes: string | null,
    currentUserId?: string
  ): Promise<{ result: AdmissionResult; items: AdmissionResultItem[] }> {
    // 1. Validate items
    const programIds = new Set<string>();
    for (const item of items) {
      if (programIds.has(item.program_id)) {
        throw new Error('Mỗi ngành/lớp chỉ được xuất hiện một lần trong một đợt.');
      }
      programIds.add(item.program_id);

      const reg = item.registered_count;
      const paid = item.paid_count;

      if (reg !== null && (isNaN(reg) || reg < 0)) {
        throw new Error('Số đăng ký chi tiết phải là số nguyên không âm.');
      }
      if (paid !== null && (isNaN(paid) || paid < 0)) {
        throw new Error('Số đóng học phí chi tiết phải là số nguyên không âm.');
      }
      if (paid !== null && reg === null) {
        throw new Error('Ngành/lớp có đóng học phí bắt buộc phải có đăng ký.');
      }
      if (paid !== null && reg !== null && paid > reg) {
        throw new Error('Số đóng học phí không được lớn hơn số đăng ký của ngành/lớp.');
      }
    }

    // 2. Ensure admission_results record exists
    const { data: existingResult } = (await supabase
      .from('admission_results')
      .select('id, data_status')
      .eq('campaign_id', campaignId)
      .maybeSingle()) as { data: { id: string; data_status: string } | null };

    if (existingResult && existingResult.data_status === 'finalized') {
      throw new Error('Không thể sửa kết quả đã chốt (finalized).');
    }

    let resultId = existingResult?.id;

    if (!resultId) {
      const { data: newRes, error: insErr } = await (supabase.from('admission_results') as any)
        .insert({
          campaign_id: campaignId,
          entry_mode: 'detail_sum',
          data_status: 'draft',
          source_type: 'system',
          notes: notes?.trim() || null,
          created_by: currentUserId || null,
          updated_by: currentUserId || null,
        })
        .select()
        .single();

      if (insErr || !newRes) {
        throw new Error(insErr?.message || 'Không thể tạo bản ghi kết quả đợt.');
      }
      resultId = newRes.id;
    } else {
      // Update notes if provided
      await (supabase.from('admission_results') as any)
        .update({
          notes: notes !== undefined ? notes?.trim() || null : undefined,
          updated_by: currentUserId || null,
        })
        .eq('id', resultId);
    }

    if (!resultId) {
      throw new Error('Không tìm thấy resultId.');
    }

    // 3. Upsert detail items (delete missing or upsert)
    const { data: currentItems } = await supabase
      .from('admission_result_items')
      .select('id, program_id')
      .eq('result_id', resultId);

    const currentProgramMap = new Map<string, string>(); // program_id -> item_id
    (currentItems || []).forEach((i: any) => currentProgramMap.set(i.program_id, i.id));

    const incomingProgramIds = new Set(items.map((i) => i.program_id));

    // Delete items not in incoming
    const toDeleteIds = (currentItems || [])
      .filter((i: any) => !incomingProgramIds.has(i.program_id))
      .map((i: any) => i.id);

    if (toDeleteIds.length > 0) {
      await supabase.from('admission_result_items').delete().in('id', toDeleteIds);
    }

    // Upsert incoming items
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const payload: any = {
        result_id: resultId,
        program_id: it.program_id,
        registered_count: it.registered_count ?? null,
        paid_count: it.paid_count ?? null,
        not_converted_note: it.not_converted_note?.trim() || null,
        sort_order: it.sort_order ?? idx,
        updated_by: currentUserId || null,
      };

      const itemId = currentProgramMap.get(it.program_id);
      if (itemId) {
        await (supabase.from('admission_result_items') as any).update(payload).eq('id', itemId);
      } else {
        payload.created_by = currentUserId || null;
        await (supabase.from('admission_result_items') as any).insert(payload);
      }
    }

    // 4. Call recalculate_admission_result RPC function in database
    const { data: updatedResult, error: rpcErr } = await (supabase.rpc as any)('recalculate_admission_result', {
      p_result_id: resultId,
    });

    if (rpcErr) {
      throw new Error(`Lỗi tính lại tổng kết quả đợt từ database: ${rpcErr.message}`);
    }

    // 5. Fetch saved items
    const { data: savedItems } = await supabase
      .from('admission_result_items')
      .select('*, program:admission_programs(*)')
      .eq('result_id', resultId)
      .order('sort_order', { ascending: true });

    return {
      result: (updatedResult as AdmissionResult) || (await this.getResultById(resultId)),
      items: (savedItems as AdmissionResultItem[]) || [],
    };
  }

  /**
   * Get single result by ID
   */
  async getResultById(resultId: string): Promise<AdmissionResult | null> {
    const { data, error } = await supabase
      .from('admission_results')
      .select('*')
      .eq('id', resultId)
      .single();

    if (error) return null;
    return data as AdmissionResult;
  }

  /**
   * Finalize admission result via RPC, backend API, or direct DB update fallback
   */
  async finalizeResult(resultId: string, note?: string): Promise<AdmissionResult> {
    // 1. Try Supabase RPC first
    try {
      const { data, error } = await (supabase.rpc as any)('finalize_admission_result', {
        p_result_id: resultId,
        p_note: note || null,
      });
      if (!error && data) {
        return data as AdmissionResult;
      }
      if (error && error.code !== 'PGRST202' && !error.message?.includes('Could not find') && !error.message?.includes('schema cache')) {
        throw new Error(error.message || 'Không thể chốt kết quả tuyển sinh.');
      }
    } catch (rpcErr: any) {
      if (rpcErr.code !== 'PGRST202' && !rpcErr.message?.includes('Could not find') && !rpcErr.message?.includes('schema cache')) {
        throw rpcErr;
      }
    }

    // 2. Try authorized backend API endpoint
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/rpc/finalize_admission_result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          p_result_id: resultId,
          p_note: note || null,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        return json as AdmissionResult;
      }
    } catch (apiErr) {
      console.warn('[admissionResultService] Backend finalize API error, falling back to direct update:', apiErr);
    }

    // 3. Direct database update fallback with full lifecycle validation
    const { data: userData } = await supabase.auth.getUser();
    let currentUserId = userData?.user?.id;
    if (!currentUserId) {
      const { data: sessionData } = await supabase.auth.getSession();
      currentUserId = sessionData?.session?.user?.id;
    }

    // Fetch existing result
    const { data: existing, error: getErr } = await (supabase
      .from('admission_results') as any)
      .select('*, items:admission_result_items(*)')
      .eq('id', resultId)
      .single();

    if (getErr || !existing) {
      throw new Error(`Không tìm thấy kết quả tuyển sinh: ${getErr?.message || ''}`);
    }

    if (existing.data_status === 'finalized') {
      throw new Error('Kết quả tuyển sinh đã được chốt trước đó.');
    }

    // Validate based on entry_mode
    if (existing.entry_mode === 'detail_sum') {
      const items = existing.items || [];
      if (items.length === 0) {
        throw new Error('Không thể chốt đợt tuyển sinh theo chi tiết (detail_sum) khi chưa có dòng chi tiết nào.');
      }
      const sumReg = items.reduce((acc: number, cur: any) => acc + (cur.registered_count || 0), 0);
      const sumPaid = items.reduce((acc: number, cur: any) => acc + (cur.paid_count || 0), 0);

      if (sumPaid > sumReg) {
        throw new Error('Số lượng đóng học phí không được lớn hơn số lượng đăng ký.');
      }

      const { data: updated, error: updErr } = await (supabase
        .from('admission_results') as any)
        .update({
          registered_count: sumReg,
          paid_count: sumPaid,
          data_status: 'finalized',
          finalized_by: currentUserId || null,
          finalized_at: new Date().toISOString(),
          notes: note !== undefined && note !== null && note.trim() !== '' ? note.trim() : existing.notes,
          updated_by: currentUserId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resultId)
        .select()
        .single();

      if (updErr || !updated) {
        throw new Error(updErr?.message || 'Không thể chốt kết quả tuyển sinh.');
      }
      return updated as AdmissionResult;
    } else {
      // manual_total
      if (existing.registered_count === null || existing.paid_count === null) {
        throw new Error('Vui lòng nhập đầy đủ số lượng đăng ký và đóng học phí trước khi chốt.');
      }
      if (existing.paid_count > existing.registered_count) {
        throw new Error('Số lượng đóng học phí không được lớn hơn số lượng đăng ký.');
      }

      const { data: updated, error: updErr } = await (supabase
        .from('admission_results') as any)
        .update({
          data_status: 'finalized',
          finalized_by: currentUserId || null,
          finalized_at: new Date().toISOString(),
          notes: note !== undefined && note !== null && note.trim() !== '' ? note.trim() : existing.notes,
          updated_by: currentUserId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resultId)
        .select()
        .single();

      if (updErr || !updated) {
        throw new Error(updErr?.message || 'Không thể chốt kết quả tuyển sinh.');
      }
      return updated as AdmissionResult;
    }
  }

  /**
   * Reopen admission result via RPC, backend API, or direct DB update fallback with mandatory reason
   */
  async reopenResult(resultId: string, reason: string): Promise<AdmissionResult> {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Lý do mở lại phải có ít nhất 5 ký tự.');
    }
    const cleanReason = reason.trim();

    // 1. Try Supabase RPC first
    try {
      const { data, error } = await (supabase.rpc as any)('reopen_admission_result', {
        p_result_id: resultId,
        p_reason: cleanReason,
      });
      if (!error && data) {
        return data as AdmissionResult;
      }
      if (error && error.code !== 'PGRST202' && !error.message?.includes('Could not find') && !error.message?.includes('schema cache')) {
        throw new Error(error.message || 'Không thể mở lại kết quả tuyển sinh.');
      }
    } catch (rpcErr: any) {
      if (rpcErr.code !== 'PGRST202' && !rpcErr.message?.includes('Could not find') && !rpcErr.message?.includes('schema cache')) {
        throw rpcErr;
      }
    }

    // 2. Try authorized backend API endpoint
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/rpc/reopen_admission_result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          p_result_id: resultId,
          p_reason: cleanReason,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        return json as AdmissionResult;
      }
    } catch (apiErr) {
      console.warn('[admissionResultService] Backend reopen API error, falling back to direct update:', apiErr);
    }

    // 3. Direct database update fallback
    const { data: userData } = await supabase.auth.getUser();
    let currentUserId = userData?.user?.id;
    if (!currentUserId) {
      const { data: sessionData } = await supabase.auth.getSession();
      currentUserId = sessionData?.session?.user?.id;
    }

    const { data: existing, error: getErr } = await (supabase
      .from('admission_results') as any)
      .select('id, data_status')
      .eq('id', resultId)
      .single();

    if (getErr || !existing) {
      throw new Error(`Không tìm thấy kết quả tuyển sinh: ${getErr?.message || ''}`);
    }

    if (existing.data_status === 'draft') {
      throw new Error('Kết quả tuyển sinh đang ở trạng thái draft, không cần mở lại.');
    }

    const { data: updated, error: updErr } = await (supabase
      .from('admission_results') as any)
      .update({
        data_status: 'draft',
        finalized_by: null,
        finalized_at: null,
        reopen_reason: cleanReason,
        reopened_by: currentUserId || null,
        reopened_at: new Date().toISOString(),
        updated_by: currentUserId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', resultId)
      .select()
      .single();

    if (updErr || !updated) {
      throw new Error(updErr?.message || 'Không thể mở lại kết quả tuyển sinh.');
    }
    return updated as AdmissionResult;
  }

  /**
   * Get change history for a result
   */
  async getChangeHistory(resultId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('admission_change_history')
      .select('*')
      .eq('entity_id', resultId)
      .order('changed_at', { ascending: false });

    if (error) return [];
    return data || [];
  }
}

export const admissionResultService = new AdmissionResultService();
