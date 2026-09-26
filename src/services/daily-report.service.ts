import { getSupabaseClient } from '../lib/supabase';
import {
  CanonicalWorkStatus,
  DailyReport,
  DailyReportSourceItem,
  DailyReportTaskLinkItem,
  MonthSummaryStats,
  SaveDailyReportMultiSourcePayload,
  SaveDailyReportPayload,
  normalizeWorkStatus,
  requiresDailyReport,
} from '../types/daily-report';
import { MetricDefinition, MetricEntry } from '../types/metric';
import { Task } from '../types/task';

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export class DailyReportService {
  async fetchWithRetry(queryFn: () => Promise<any>, retries = 3) {
    for (let i = 0; i < retries; i++) {
      const res = await queryFn();
      if (res?.error?.message && res.error.message.includes('JWT issued at future')) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      return res;
    }
    return queryFn();
  }

  normalizeWorkStatus(status?: string | null): CanonicalWorkStatus {
    return normalizeWorkStatus(status);
  }

  /**
   * Load Daily Reports for current authenticated Staff for a specific month range
   * Filter: user_id = userId, report_date >= startDate, report_date <= endDate
   * Does NOT filter by organization unit for personal report list
   */
  async getMyDailyReportsForMonth(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyReport[]> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa được khởi tạo.');

    // 1. Try Backend API first (Service Role proxy)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const queryParams = new URLSearchParams({
          user_id: userId,
          start_date: startDate,
          end_date: endDate,
        });
        const res = await fetch(`/api/daily-reports/month?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) return data;
        }
      }
    } catch (apiErr) {
      console.warn('[DailyReportService] Backend API for monthly reports failed, trying direct query:', apiErr);
    }

    try {
      const { data, error } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_reports')
          .select(`
            id,
            report_date,
            user_id,
            organization_unit_id,
            work_status,
            report_status,
            submitted_at,
            off_note,
            work_summary,
            issues,
            support_request,
            created_at,
            updated_at
          `)
          .eq('user_id', userId)
          .gte('report_date', startDate)
          .lte('report_date', endDate)
          .order('report_date', { ascending: true })
      );

      if (error) {
        console.error('[DailyReportService] Error fetching monthly reports:', error);
        throw new Error('Không thể tải danh sách báo cáo tháng: ' + error.message);
      }

      return (data || []) as DailyReport[];
    } catch (err: any) {
      console.error('[DailyReportService] getMyDailyReportsForMonth error:', err);
      throw err;
    }
  }

  /**
   * Get full details of a daily report by Date for current staff
   */
  async getDailyReportFullByDate(userId: string, date: string): Promise<DailyReport | null> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa được khởi tạo.');

    // 1. Try Backend API first (Service Role proxy)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const queryParams = new URLSearchParams({
          user_id: userId,
          date: date,
        });
        const res = await fetch(`/api/daily-reports/by-date?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          return data;
        }
      }
    } catch (apiErr) {
      console.warn('[DailyReportService] Backend API for report by date failed, trying direct query:', apiErr);
    }

    try {
      // 1. Load daily_reports record
      const { data: reportData, error: reportErr } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_reports')
          .select('*')
          .eq('user_id', userId)
          .eq('report_date', date)
          .maybeSingle()
      );

      if (reportErr) {
        throw new Error('Lỗi kiểm tra báo cáo ngày: ' + reportErr.message);
      }

      if (!reportData) {
        return null;
      }

      const reportId = reportData.id;

      // 2. Load daily_report_task_links
      const { data: taskLinks, error: taskLinksErr } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_task_links')
          .select('id, daily_report_id, task_id, created_at')
          .eq('daily_report_id', reportId)
      );

      if (taskLinksErr) {
        console.warn('[DailyReportService] Error loading task links:', taskLinksErr.message);
      }

      // 3. Load daily_report_sources
      const { data: reportSources, error: sourcesErr } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_sources')
          .select('id, daily_report_id, report_source_id, source_name_snapshot, sort_order, created_at, updated_at')
          .eq('daily_report_id', reportId)
          .order('sort_order', { ascending: true })
      );

      if (sourcesErr) {
        console.warn('[DailyReportService] Error loading report sources:', sourcesErr.message);
      }

      const fullReport: DailyReport = {
        ...reportData,
        daily_report_task_links: (taskLinks || []) as DailyReportTaskLinkItem[],
        daily_report_sources: (reportSources || []) as DailyReportSourceItem[],
      };

      return fullReport;
    } catch (err: any) {
      console.error('[DailyReportService] getDailyReportFullByDate error:', err);
      throw err;
    }
  }

  /**
   * Get full details of a daily report by ID
   */
  async getDailyReportFullById(id: string, userId?: string): Promise<DailyReport | null> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa được khởi tạo.');

    // 1. Try Backend API first
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          return data;
        }
      }
    } catch (apiErr) {
      console.warn('[DailyReportService] Backend API for report by ID failed, trying direct query:', apiErr);
    }

    try {
      let query = (supabase.from as any)('daily_reports').select('*').eq('id', id);
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: reportData, error: reportErr } = await this.fetchWithRetry(async () =>
        await query.maybeSingle()
      );

      if (reportErr) {
        throw new Error('Lỗi tải báo cáo: ' + reportErr.message);
      }

      if (!reportData) return null;

      // Load task links
      const { data: taskLinks } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_task_links')
          .select('id, daily_report_id, task_id, created_at')
          .eq('daily_report_id', id)
      );

      // Load report sources
      const { data: reportSources } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_sources')
          .select('id, daily_report_id, report_source_id, source_name_snapshot, sort_order, created_at, updated_at')
          .eq('daily_report_id', id)
          .order('sort_order', { ascending: true })
      );

      return {
        ...reportData,
        daily_report_task_links: (taskLinks || []) as DailyReportTaskLinkItem[],
        daily_report_sources: (reportSources || []) as DailyReportSourceItem[],
      };
    } catch (err: any) {
      console.error('[DailyReportService] getDailyReportFullById error:', err);
      throw err;
    }
  }

  /**
   * Get latest previous daily report before a specific date for copy feature
   */
  async getLatestPreviousReport(userId: string, beforeDate: string): Promise<DailyReport | null> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa được khởi tạo.');

    try {
      const { data: reportData, error: repErr } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_reports')
          .select('*')
          .eq('user_id', userId)
          .lt('report_date', beforeDate)
          .order('report_date', { ascending: false })
          .limit(1)
          .maybeSingle()
      );

      if (repErr || !reportData) return null;

      // Load task links
      const { data: taskLinks } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_task_links')
          .select('id, daily_report_id, task_id, created_at')
          .eq('daily_report_id', reportData.id)
      );

      // Load report sources
      const { data: reportSources } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_sources')
          .select('id, daily_report_id, report_source_id, source_name_snapshot, sort_order')
          .eq('daily_report_id', reportData.id)
          .order('sort_order', { ascending: true })
      );

      return {
        ...reportData,
        daily_report_task_links: (taskLinks || []) as DailyReportTaskLinkItem[],
        daily_report_sources: (reportSources || []) as DailyReportSourceItem[],
      };
    } catch (err) {
      console.warn('[DailyReportService] Error loading previous report:', err);
      return null;
    }
  }

  /**
   * Save Daily Report with Multi-Source & Task links in v0.3.4e model
   * Order:
   * A. Upsert daily_reports (unique user_id + report_date)
   * B. Save daily_report_task_links
   * C. If off: clean sources and metric entries
   * D. If working: Save daily_report_sources & manual metric_entries
   */
  async saveDailyReportMultiSource(payload: SaveDailyReportMultiSourcePayload): Promise<DailyReport> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa được khởi tạo');

    if (!payload.user_id || !payload.organization_unit_id) {
      throw new Error('Không xác định được đơn vị công tác chính của tài khoản.');
    }

    if (process.env.NODE_ENV !== 'production' || (import.meta as any).env?.DEV) {
      console.log('[DailyReportService v0.3.4e.3] Saving multi-source report:', {
        userId: payload.user_id,
        primaryOrgId: payload.organization_unit_id,
        reportDate: payload.report_date,
        workStatus: payload.work_status,
        reportStatus: payload.report_status,
        sourcesCount: payload.sources?.length || 0,
        taskLinksCount: payload.task_ids?.length || 0,
      });
    }

    // 1. Try Backend API first (avoids RLS restrictions and handles atomic sync)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const res = await fetch('/api/daily-reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const savedData = await res.json();
          return savedData as DailyReport;
        } else {
          const errJson = await res.json().catch(() => null);
          if (errJson?.error) {
            throw new Error(errJson.error);
          }
        }
      }
    } catch (apiErr: any) {
      // If error was thrown from backend response with specific message, rethrow
      if (apiErr.message && !apiErr.message.includes('Failed to fetch')) {
        throw apiErr;
      }
      console.warn('[DailyReportService] Backend API save failed, attempting direct Supabase query fallback:', apiErr);
    }

    // 2. Direct Supabase Query Fallback
    const normWorkStatus = normalizeWorkStatus(payload.work_status);
    const isExempt = !requiresDailyReport(normWorkStatus);
    let primarySourceChannel = 'Trực tiếp / Direct';
    if (normWorkStatus === 'off') {
      primarySourceChannel = 'Nghỉ phép / Off';
    } else if (normWorkStatus === 'business_trip') {
      primarySourceChannel = 'Đi công tác / Business Trip';
    } else if (payload.sources && payload.sources.length > 0 && payload.sources[0].source_name_snapshot) {
      primarySourceChannel = payload.sources[0].source_name_snapshot;
    }

    const noteValue = isExempt ? (payload.status_note ?? payload.off_note ?? null) : null;
    const finalReportStatus = isExempt ? 'submitted' : (payload.report_status || 'draft');
    const finalSubmittedAt = isExempt
      ? (payload.submitted_at ?? new Date().toISOString())
      : (payload.report_status === 'submitted' ? (payload.submitted_at ?? new Date().toISOString()) : null);

    // 1. Check existing daily report by ID or (user_id + report_date)
    let existingReport: any = null;
    if (payload.id) {
      const { data } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_reports')
          .select('id, user_id, organization_unit_id, report_date')
          .eq('id', payload.id)
          .maybeSingle()
      );
      existingReport = data;
    }

    if (!existingReport) {
      const { data } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_reports')
          .select('id, user_id, organization_unit_id, report_date')
          .eq('user_id', payload.user_id)
          .eq('report_date', payload.report_date)
          .maybeSingle()
      );
      existingReport = data;
    }

    let savedReport: DailyReport;

    if (existingReport) {
      // UPDATE daily_reports
      const updateData: any = {
        work_status: normWorkStatus,
        report_status: finalReportStatus,
        submitted_at: finalSubmittedAt,
        off_note: noteValue,
        work_summary: isExempt ? null : (payload.work_summary ?? null),
        issues: isExempt ? null : (payload.issues ?? null),
        support_request: isExempt ? null : (payload.support_request ?? null),
        source_channel: primarySourceChannel,
        interest_group: payload.interest_group ?? null,
        related_task_id: payload.related_task_id ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_reports')
          .update(updateData)
          .eq('id', existingReport.id)
          .select()
          .single()
      );

      if (error) throw new Error('Lỗi cập nhật báo cáo ngày: ' + error.message);
      savedReport = data as DailyReport;
    } else {
      // INSERT daily_reports
      const insertData: any = {
        id: payload.id || generateUUID(),
        user_id: payload.user_id,
        organization_unit_id: payload.organization_unit_id,
        report_date: payload.report_date,
        work_status: normWorkStatus,
        report_status: finalReportStatus,
        submitted_at: finalSubmittedAt,
        off_note: noteValue,
        work_summary: isExempt ? null : (payload.work_summary ?? null),
        issues: isExempt ? null : (payload.issues ?? null),
        support_request: isExempt ? null : (payload.support_request ?? null),
        source_channel: primarySourceChannel,
        interest_group: payload.interest_group ?? null,
        related_task_id: payload.related_task_id ?? null,
      };

      const { data, error } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_reports')
          .insert([insertData])
          .select()
          .single()
      );

      if (error) throw new Error('Lỗi tạo mới báo cáo ngày: ' + error.message);
      savedReport = data as DailyReport;
    }

    const dailyReportId = savedReport.id;

    // 2. Save daily_report_task_links
    // First remove old task links
    await this.fetchWithRetry(async () =>
      await (supabase.from as any)('daily_report_task_links')
        .delete()
        .eq('daily_report_id', dailyReportId)
    );

    // If working and has tasks selected, insert new task links
    if (!isExempt && payload.task_ids && payload.task_ids.length > 0) {
      const taskLinkRows = payload.task_ids.map((taskId) => ({
        id: generateUUID(),
        daily_report_id: dailyReportId,
        task_id: taskId,
        created_at: new Date().toISOString(),
      }));

      const { error: taskLinkInsertErr } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_task_links').insert(taskLinkRows)
      );

      if (taskLinkInsertErr) {
        console.warn('[DailyReportService] Error saving task links:', taskLinkInsertErr.message);
      }
    }

    // 3. Handle EXEMPT state (off / business_trip) vs REPORTING state (onsite / remote)
    if (isExempt) {
      // Clean any existing sources and metric entries for this report
      const { data: existingSources } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_sources')
          .select('id')
          .eq('daily_report_id', dailyReportId)
      );

      if (existingSources && existingSources.length > 0) {
        const sourceIds = existingSources.map((s: any) => s.id);
        await this.fetchWithRetry(async () =>
          await (supabase.from as any)('metric_entries')
            .delete()
            .in('daily_report_source_id', sourceIds)
        );
        await this.fetchWithRetry(async () =>
          await (supabase.from as any)('daily_report_sources')
            .delete()
            .eq('daily_report_id', dailyReportId)
        );
      }

      await this.fetchWithRetry(async () =>
        await (supabase.from as any)('metric_entries')
          .delete()
          .eq('source_reference_id', dailyReportId)
      );

      return savedReport;
    }

    // 4. Handle Multi-Source & Metric Entries for WORKING state
    const sourcesPayload = payload.sources || [];

    // Fetch currently saved daily_report_sources
    const { data: currentDbSources } = await this.fetchWithRetry(async () =>
      await (supabase.from as any)('daily_report_sources')
        .select('id, report_source_id')
        .eq('daily_report_id', dailyReportId)
    );

    const currentDbSourceMap = new Map<string, any>();
    (currentDbSources || []).forEach((s: any) => {
      currentDbSourceMap.set(s.report_source_id, s);
    });

    // Determine sources to delete
    const keepSourceDefinitionIds = new Set(sourcesPayload.map((s) => s.report_source_id));
    const toDeleteSources = (currentDbSources || []).filter(
      (s: any) => !keepSourceDefinitionIds.has(s.report_source_id)
    );

    for (const delSrc of toDeleteSources) {
      await this.fetchWithRetry(async () =>
        await (supabase.from as any)('metric_entries')
          .delete()
          .eq('daily_report_source_id', delSrc.id)
      );
      await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_sources').delete().eq('id', delSrc.id)
      );
    }

    // Upsert each source and save its manual metric entries
    for (let i = 0; i < sourcesPayload.length; i++) {
      const srcItem = sourcesPayload[i];
      let dbSourceId: string;

      const existingSourceRow = currentDbSourceMap.get(srcItem.report_source_id);
      if (existingSourceRow) {
        dbSourceId = existingSourceRow.id;
        await this.fetchWithRetry(async () =>
          await (supabase.from as any)('daily_report_sources')
            .update({
              source_name_snapshot: srcItem.source_name_snapshot,
              sort_order: i,
              updated_at: new Date().toISOString(),
            })
            .eq('id', dbSourceId)
        );
      } else {
        dbSourceId = srcItem.id || generateUUID();
        const insertSrcRow = {
          id: dbSourceId,
          daily_report_id: dailyReportId,
          report_source_id: srcItem.report_source_id,
          source_name_snapshot: srcItem.source_name_snapshot,
          sort_order: i,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: insErr } = await this.fetchWithRetry(async () =>
          await (supabase.from as any)('daily_report_sources').insert([insertSrcRow])
        );
        if (insErr) {
          throw new Error(`Lỗi lưu Kênh/Nguồn "${srcItem.source_name_snapshot}": ` + insErr.message);
        }
      }

      // Save manual metric entries for this specific source
      const manualEntries = (srcItem.metrics || []).map((m) => ({
        id: generateUUID(),
        metric_definition_id: m.metric_definition_id,
        organization_unit_id: payload.organization_unit_id,
        user_id: payload.user_id,
        period_start: payload.report_date,
        period_end: payload.report_date,
        value: Number(m.value) || 0,
        source_type: 'manual',
        source_reference_id: dailyReportId,
        daily_report_source_id: dbSourceId,
        created_by: payload.user_id,
      }));

      for (const entry of manualEntries) {
        // Upsert by matching daily_report_source_id + metric_definition_id
        const { data: existingMetric } = await this.fetchWithRetry(async () =>
          await (supabase.from as any)('metric_entries')
            .select('id')
            .eq('daily_report_source_id', entry.daily_report_source_id)
            .eq('metric_definition_id', entry.metric_definition_id)
            .maybeSingle()
        );

        if (existingMetric && existingMetric.id) {
          await this.fetchWithRetry(async () =>
            await (supabase.from as any)('metric_entries')
              .update({
                value: entry.value,
                period_start: entry.period_start,
                period_end: entry.period_end,
                organization_unit_id: entry.organization_unit_id,
                user_id: entry.user_id,
                source_reference_id: entry.source_reference_id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingMetric.id)
          );
        } else {
          const { error: metricInsErr } = await this.fetchWithRetry(async () =>
            await (supabase.from as any)('metric_entries').insert([entry])
          );
          if (metricInsErr) {
            if (metricInsErr.code === '23505') {
              // On constraint conflict, update
              await (supabase.from as any)('metric_entries')
                .update({
                  value: entry.value,
                  daily_report_source_id: entry.daily_report_source_id,
                  source_reference_id: entry.source_reference_id,
                  updated_at: new Date().toISOString(),
                })
                .eq('metric_definition_id', entry.metric_definition_id)
                .eq('daily_report_source_id', entry.daily_report_source_id);
            } else {
              console.warn('[DailyReportService] Metric entry insert error:', metricInsErr.message);
            }
          }
        }
      }
    }

    return savedReport;
  }

  /**
   * Delete a specific report source and its metric entries
   */
  async deleteReportSource(dailyReportId: string, dailyReportSourceId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa được khởi tạo');

    // 1. Try Backend API first
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(dailyReportId)}/sources/${encodeURIComponent(dailyReportSourceId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          return;
        }
      }
    } catch (apiErr) {
      console.warn('[DailyReportService] Backend API deleteReportSource failed, trying direct query:', apiErr);
    }

    try {
      await this.fetchWithRetry(async () =>
        await (supabase.from as any)('metric_entries')
          .delete()
          .eq('daily_report_source_id', dailyReportSourceId)
      );

      await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_sources')
          .delete()
          .eq('id', dailyReportSourceId)
          .eq('daily_report_id', dailyReportId)
      );
    } catch (err: any) {
      console.error('[DailyReportService] deleteReportSource error:', err);
      throw err;
    }
  }

  /**
   * Delete full daily report by ID
   */
  async deleteDailyReport(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa được khởi tạo');

    // 1. Try Backend API first
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          return;
        }
      }
    } catch (apiErr) {
      console.warn('[DailyReportService] Backend API deleteDailyReport failed, trying direct query:', apiErr);
    }

    try {
      await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_task_links').delete().eq('daily_report_id', id)
      );
      await this.fetchWithRetry(async () =>
        await (supabase.from as any)('metric_entries').delete().eq('source_reference_id', id)
      );
      await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_report_sources').delete().eq('daily_report_id', id)
      );
      const { error } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('daily_reports').delete().eq('id', id)
      );
      if (error) throw error;
    } catch (err: any) {
      console.error('[DailyReportService] deleteDailyReport error:', err);
      throw err;
    }
  }

  /**
   * Backward-compatible save metrics method supporting both entries array and positional arguments
   */
  async saveDailyReportMetrics(
    reportIdOrEntries: string | any[],
    unitId?: string,
    userId?: string,
    reportDate?: string,
    metricsList?: MetricDefinition[],
    valuesMap?: Record<string, number>
  ): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    if (Array.isArray(reportIdOrEntries)) {
      const entries = reportIdOrEntries;
      for (const entry of entries) {
        const { data: existing } = await this.fetchWithRetry(async () =>
          await (supabase.from as any)('metric_entries')
            .select('id')
            .eq('source_reference_id', entry.source_reference_id)
            .eq('metric_definition_id', entry.metric_definition_id)
            .maybeSingle()
        );

        if (existing) {
          await this.fetchWithRetry(async () =>
            await (supabase.from as any)('metric_entries')
              .update({
                value: entry.value,
                period_start: entry.period_start,
                period_end: entry.period_end,
                organization_unit_id: entry.organization_unit_id,
                user_id: entry.user_id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
          );
        } else {
          await this.fetchWithRetry(async () =>
            await (supabase.from as any)('metric_entries').insert([
              {
                id: entry.id || generateUUID(),
                metric_definition_id: entry.metric_definition_id,
                organization_unit_id: entry.organization_unit_id,
                user_id: entry.user_id,
                period_start: entry.period_start,
                period_end: entry.period_end,
                value: entry.value,
                source_type: entry.source_type || 'manual',
                source_reference_id: entry.source_reference_id,
                created_by: entry.created_by,
              },
            ])
          );
        }
      }
      return;
    }

    const reportId = reportIdOrEntries;
    const manualMetrics = (metricsList || []).filter((m) => m.entry_mode !== 'calculated');
    for (const metric of manualMetrics) {
      const val = valuesMap?.[metric.id];
      if (val !== undefined && val !== null && !isNaN(Number(val))) {
        const isUnitScoped = metric.measurement_scope === 'unit' || metric.measurement_scope === 'organization';
        const entryUserId = isUnitScoped ? null : userId;

        const { data: existing } = await this.fetchWithRetry(async () =>
          await (supabase.from as any)('metric_entries')
            .select('id')
            .eq('source_reference_id', reportId)
            .eq('metric_definition_id', metric.id)
            .maybeSingle()
        );

        if (existing) {
          await this.fetchWithRetry(async () =>
            await (supabase.from as any)('metric_entries')
              .update({
                value: Number(val),
                period_start: reportDate,
                period_end: reportDate,
                organization_unit_id: unitId,
                user_id: entryUserId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
          );
        } else {
          await this.fetchWithRetry(async () =>
            await (supabase.from as any)('metric_entries').insert([
              {
                id: generateUUID(),
                metric_definition_id: metric.id,
                organization_unit_id: unitId,
                user_id: entryUserId,
                period_start: reportDate,
                period_end: reportDate,
                value: Number(val),
                source_type: 'manual',
                source_reference_id: reportId,
                created_by: userId,
              },
            ])
          );
        }
      }
    }
  }

  /**
   * Get metrics for a specific daily report
   */
  async getDailyReportMetrics(reportId: string): Promise<MetricEntry[]> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await this.fetchWithRetry(async () =>
      await (supabase.from as any)('metric_entries')
        .select('*')
        .eq('source_reference_id', reportId)
    );
    if (error) throw new Error('Không thể tải metrics của báo cáo: ' + error.message);

    return data as MetricEntry[];
  }

  /**
   * Legacy method for backward compatibility
   */
  async getMyDailyReports(userId: string): Promise<DailyReport[]> {
    return this.getMyDailyReportsForMonth(userId, '2000-01-01', '2099-12-31');
  }

  async getDailyReportById(id: string, userId?: string): Promise<DailyReport> {
    const res = await this.getDailyReportFullById(id, userId);
    if (!res) throw new Error('Không tìm thấy báo cáo');
    return res;
  }

  async saveDailyReport(payload: SaveDailyReportPayload): Promise<DailyReport> {
    return this.saveDailyReportMultiSource({
      id: payload.id,
      report_date: payload.report_date,
      user_id: payload.user_id,
      organization_unit_id: payload.organization_unit_id,
      work_status: payload.work_status === 'Nghỉ phép' || payload.work_status === 'off' ? 'off' : 'working',
      report_status: (payload.report_status as any) || 'draft',
      submitted_at: payload.submitted_at,
      off_note: payload.off_note,
      work_summary: payload.work_summary,
      issues: payload.issues,
      support_request: payload.support_request,
      interest_group: payload.interest_group,
      related_task_id: payload.related_task_id,
    });
  }

  async getReportSourcesForUnit(unitId: string): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    try {
      const { data, error } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('report_source_unit_assignments')
          .select(`
            sort_order,
            is_active,
            organization_unit_id,
            report_sources (
              id,
              code,
              name,
              category,
              description,
              is_active,
              sort_order
            )
          `)
          .eq('organization_unit_id', unitId)
          .eq('is_active', true)
      );

      if (!error && data) {
        const sources = data
          .filter((item: any) => item.report_sources && item.report_sources.is_active)
          .map((item: any) => ({
            ...item.report_sources,
            assignment_sort_order: item.sort_order,
          }))
          .sort((a: any, b: any) => {
            if (a.assignment_sort_order !== b.assignment_sort_order) {
              return a.assignment_sort_order - b.assignment_sort_order;
            }
            if (a.sort_order !== b.sort_order) {
              return a.sort_order - b.sort_order;
            }
            return (a.name || '').localeCompare(b.name || '');
          });
        return sources;
      }
    } catch (err) {
      console.warn('Direct query for report sources failed, attempting API fallback:', err);
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const res = await fetch(`/api/report-sources?organization_unit_id=${encodeURIComponent(unitId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          return await res.json();
        }
      }
    } catch (err) {
      console.error('API fallback for report sources failed:', err);
    }

    return [];
  }

  /**
   * Load tasks owned by or assigned to user
   */
  async getMyTasks(userId: string): Promise<Task[]> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    try {
      // 1. Get tasks where owner_id = userId
      const { data: ownedTasks } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('tasks')
          .select('id, task_code, title, status, priority, due_date, progress, organization_unit_id, owner_id')
          .eq('owner_id', userId)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
      );

      // 2. Get task IDs where user is assignee
      const { data: assigneeRows } = await this.fetchWithRetry(async () =>
        await (supabase.from as any)('task_assignees')
          .select('task_id')
          .eq('user_id', userId)
      );

      const assignedTaskIds = (assigneeRows || []).map((r: any) => r.task_id).filter(Boolean);

      let assignedTasks: any[] = [];
      if (assignedTaskIds.length > 0) {
        const { data: aTasks } = await this.fetchWithRetry(async () =>
          await (supabase.from as any)('tasks')
            .select('id, task_code, title, status, priority, due_date, progress, organization_unit_id, owner_id')
            .in('id', assignedTaskIds)
            .eq('is_archived', false)
        );
        assignedTasks = aTasks || [];
      }

      // Combine unique tasks
      const taskMap = new Map<string, Task>();
      (ownedTasks || []).forEach((t: any) => taskMap.set(t.id, t));
      assignedTasks.forEach((t: any) => taskMap.set(t.id, t));

      return Array.from(taskMap.values());
    } catch (err) {
      console.error('[DailyReportService] Error loading my tasks:', err);
      return [];
    }
  }
}

export const dailyReportService = new DailyReportService();
export default dailyReportService;
