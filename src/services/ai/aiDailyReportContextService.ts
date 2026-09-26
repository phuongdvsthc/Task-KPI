import { AIContextData, AIContextRequest } from '../../types/ai';
import { AIContextError } from '../../types/ai_errors';

export const aiDailyReportContextService = {
  async buildDailyReportContext(supabaseAdmin: any, req: AIContextRequest, envelope: AIContextData): Promise<void> {
    const { actor, scope } = envelope;

    if (!req.dateFrom || !req.dateTo) {
      throw new AIContextError('AI_CONTEXT_INVALID_DATE_RANGE', 'Daily report context requires dateFrom and dateTo');
    }

    const AI_CONTEXT_MAX_RECORDS = 50;
    
    // We fetch reports from Supabase. We must respect the scope!
    let query = supabaseAdmin
      .from('daily_reports')
      .select(`
        id,
        report_date,
        user_id,
        organization_unit_id,
        work_status,
        work_summary,
        issues,
        support_request,
        off_note,
        status_note,
        profiles ( full_name ),
        organization_units ( name ),
        daily_report_sources (
          id,
          report_source_id,
          report_sources ( name ),
          metric_entries (
            id,
            metric_definition_id,
            metric_definitions ( name, code, unit ),
            value,
            note
          )
        )
      `)
      .gte('report_date', req.dateFrom)
      .lte('report_date', req.dateTo)
      .order('report_date', { ascending: false });

    if (scope.scopeType === 'self') {
      // Must be self
      query = query.eq('user_id', actor.userId);
    } else if (scope.scopeType === 'unit_descendants') {
      if (req.targetUserId) {
        query = query.eq('user_id', req.targetUserId);
      }
      if (scope.unitIds.length > 0) {
        query = query.in('organization_unit_id', scope.unitIds);
      } else {
        query = query.eq('id', 'forced-empty-id'); // fallback
      }
    } else if (scope.scopeType === 'system' || scope.scopeType === 'read_only_system') {
      if (req.targetUserId) {
         query = query.eq('user_id', req.targetUserId);
      }
      if (scope.unitIds.length > 0) {
         query = query.in('organization_unit_id', scope.unitIds);
      } else if (req.unitId) {
         query = query.eq('organization_unit_id', req.unitId);
      }
    }

    if (req.entityIds && req.entityIds.length > 0) {
      query = query.in('id', req.entityIds);
    }

    const { data: reports, error } = await query;
    
    if (req.entityIds && req.entityIds.length > 0 && reports) {
      if (reports.length !== req.entityIds.length) {
        throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'One or more requested entity IDs are unauthorized or not found.');
      }
    }
    if (error) {
       console.error("AI Daily Report context error:", error);
       throw new AIContextError('AI_CONTEXT_SOURCE_UNAVAILABLE', 'Failed to fetch daily reports: ' + (error.message || JSON.stringify(error)));
    }

    // Process & Normalize
    let processedReports = reports || [];
    if (processedReports.length > AI_CONTEXT_MAX_RECORDS) {
      processedReports = processedReports.slice(0, AI_CONTEXT_MAX_RECORDS);
      envelope.metadata.truncated = true;
      envelope.metadata.warnings.push('DAILY_REPORT_CONTEXT_TRUNCATED');
    }

    const summary = {
      reportCount: 0,
      workdayCount: 0,
      onsiteCount: 0,
      remoteCount: 0,
      businessTripCount: 0,
      offCount: 0,
      staffCount: 0
    };

    const uniqueStaff = new Set<string>();

    const normalizedReports = processedReports.map((r: any) => {
      summary.reportCount++;
      uniqueStaff.add(r.user_id);

      const mode = r.work_status || r.work_mode || 'onsite';
      if (mode === 'onsite') summary.onsiteCount++;
      else if (mode === 'remote') summary.remoteCount++;
      else if (mode === 'business_trip') summary.businessTripCount++;
      else if (mode === 'off' || mode === 'leave') summary.offCount++;

      if (mode !== 'off' && mode !== 'leave') {
        summary.workdayCount++;
      }

      const sources = (r.daily_report_sources || []).map((s: any) => ({
        sourceId: s.id,
        sourceRefId: s.report_source_id,
        sourceName: s.report_sources?.name,
        metrics: (s.metric_entries || []).map((m: any) => ({
          metricDefinitionId: m.metric_definition_id || m.metric_id,
          metricCode: m.metric_definitions?.code,
          metricName: m.metric_definitions?.name,
          value: m.value !== undefined && m.value !== null ? m.value : (m.value_numeric !== null ? m.value_numeric : m.value_text),
          unit: m.metric_definitions?.unit
        }))
      }));

      // Apply text truncation
      const truncateText = (text: string | null) => {
         if (!text) return text;
         return text.length > 500 ? text.substring(0, 500) + '...' : text;
      };

      return {
        dailyReportId: r.id,
        reportDate: r.report_date,
        userId: r.user_id,
        userName: r.profiles?.full_name,
        unitId: r.organization_unit_id,
        unitName: r.organization_units?.name,
        workMode: mode,
        sourceCount: sources.length,
        sources,
        workSummary: truncateText(r.work_summary),
        note: truncateText(r.support_request || r.issues || r.note)
      };
    });

    summary.staffCount = uniqueStaff.size;

    envelope.data.dailyReports = {
      summary,
      reports: normalizedReports
    };
    
    // Audit Metadata
    envelope.metadata.recordCounts['daily_reports'] = summary.reportCount;
    envelope.metadata.recordCounts['daily_report_sources'] = normalizedReports.reduce((acc: number, r: any) => acc + r.sourceCount, 0);
  }
};
