import { AIContextRequest, AIContextData } from '../../types/ai';
import { aiContextService } from './aiContextService';
import { aiService } from './aiService';
import { normalizeExecutiveIntelligenceResult } from './executiveIntelligenceNormalizer';
import { executiveIssueExtractor } from './executiveIssueExtractor';
import { executiveIssueAssociator } from './executiveIssueAssociator';
import { executiveFollowUpGenerator } from './executiveFollowUpGenerator';

export interface ExecutiveIntelligenceRequest extends AIContextRequest {
    unitId?: string;
    periodType?: string;
    dateFrom?: string;
    dateTo?: string;
    kpiPeriodId?: string;
}


export const executiveIntelligenceService = {
  async generateSummary(supabaseAdmin: any, req: ExecutiveIntelligenceRequest): Promise<any> {
    const modulesToLoad = ['daily_report', 'task', 'kpi'] as const;

    // Build context with inherited reporting windows/semantics
    const envelope = await aiContextService.buildContext(supabaseAdmin, {
      ...req,
      modules: [...modulesToLoad],
      featureKey: req.featureKey || 'executive.overview'
    });

    // Deterministically extract issue candidates before hitting AI
    const deterministicIssues = executiveIssueExtractor.extractIssues(envelope);
    envelope.data.deterministicIssues = deterministicIssues;

    // Cross-module issue association
    const associatedIssueGroups = await executiveIssueAssociator.associateIssues(supabaseAdmin, req.userId, req.featureKey || 'executive.unit_summary', envelope, deterministicIssues);
    envelope.data.associatedIssueGroups = associatedIssueGroups;

    // Generate executive follow-ups
    const generatedFollowUps = await executiveFollowUpGenerator.generateFollowUps(supabaseAdmin, req.userId, req.featureKey || 'executive.unit_summary', envelope, associatedIssueGroups);
    envelope.data.generatedFollowUps = generatedFollowUps;

    const hasDaily = (envelope.metadata.recordCounts['daily_reports'] || 0) > 0;
    const hasTask = (envelope.metadata.recordCounts['tasks'] || 0) > 0;
    const hasKpi = (envelope.metadata.recordCounts['kpi_assignments'] || 0) > 0;

    const dailyTruncated = envelope.metadata.warnings?.includes('DAILY_REPORT_TRUNCATED') || false;
    const taskTruncated = envelope.metadata.warnings?.includes('TASK_TRUNCATED') || false;
    const kpiTruncated = envelope.metadata.warnings?.includes('KPI_CONTEXT_TRUNCATED') || false;
    const aggregateTruncated = envelope.metadata.truncated || dailyTruncated || taskTruncated || kpiTruncated || false;

    // 14. ALL EMPTY -> Skip provider
    if (!hasDaily && !hasTask && !hasKpi) {
        return {
            summary: 'Không có dữ liệu trong phạm vi được chọn.',
            highlights: [],
            issues: [],
            followUps: [],
            moduleOverview: {
                dailyReport: { status: 'empty', count: 0, dateFrom: req.dateFrom, dateTo: req.dateTo, truncated: false },
                task: { status: 'empty', count: 0, truncated: false },
                kpi: { status: 'empty', assignmentCount: 0, itemCount: 0, liveCount: 0, officialCount: 0, truncated: false }
            },
            metadata: {
                empty: true,
                unit: envelope.scope?.targetUnitId ? { id: envelope.scope.targetUnitId, name: envelope.scope.targetUnitName } : undefined,
                emptyModules: ['daily_report', 'task', 'kpi'],
                includedModules: [],
                unavailableModules: [],
                truncatedModules: [],
                truncated: false,
                featureKey: req.featureKey || 'executive.overview',
                generatedAt: new Date().toISOString(),
                scope: envelope.scope || {},
                reportingWindow: { dateFrom: req.dateFrom, dateTo: req.dateTo, label: req.periodType },
                kpiPeriod: req.kpiPeriodId
            }
        };
    }

    const contextData: any = { ...envelope.data };
    if (envelope.scope?.targetUnitId) {
        contextData._unitContext = {
            id: envelope.scope.targetUnitId,
            name: envelope.scope.targetUnitName || 'Unknown Unit'
        };
    }
    const variables = {
        context: JSON.stringify(contextData)
    };

    const result = await aiService.execute(supabaseAdmin, {
        promptKey: req.featureKey || 'executive.overview',
        variables,
        context: envelope,
        userId: req.userId,
        userRole: 'executive',
        featureKey: req.featureKey || 'executive.overview'
    });

    let parsedResult = typeof result === 'string' ? JSON.parse(result) : result;

    // Normalization / safety stripping
    if (parsedResult.performanceScore) delete parsedResult.performanceScore;
    if (parsedResult.rank) delete parsedResult.rank;
    if (parsedResult.ranking) delete parsedResult.ranking;
    if (parsedResult.employeeScore) delete parsedResult.employeeScore;
    if (parsedResult.productivityScore) delete parsedResult.productivityScore;
    if (parsedResult.topEmployee) delete parsedResult.topEmployee;
    if (parsedResult.bottomEmployee) delete parsedResult.bottomEmployee;
    if (parsedResult.topUnit) delete parsedResult.topUnit;
    if (parsedResult.bottomUnit) delete parsedResult.bottomUnit;

    const validEvidenceIds = new Set<string>();
    const evidenceMap: Record<string, { type: string, label: string, [key: string]: any }> = {};
    
    if (envelope.data?.dailyReports?.reports) {
        envelope.data.dailyReports.reports.forEach((r: any) => {
            validEvidenceIds.add(r.id);
            evidenceMap[r.id] = { type: 'daily_report', label: `Báo cáo ngày ${new Date(r.reportDate || r.created_at || Date.now()).toLocaleDateString('vi-VN')}`, date: r.reportDate };
        });
    }
    if (envelope.data?.tasks?.tasks) {
        envelope.data.tasks.tasks.forEach((t: any) => {
            validEvidenceIds.add(t.id);
            evidenceMap[t.id] = { type: 'task', label: `Công việc: ${t.title || 'Không tên'}`, status: t.status };
        });
    }
    if (envelope.data?.kpis?.assignments) {
        envelope.data.kpis.assignments.forEach((a: any) => {
            validEvidenceIds.add(a.id);
            evidenceMap[a.id] = { type: 'kpi_assignment', label: `KPI Assignment - ${a.periodName || 'Không rõ'}`, scoreMode: a.resultMode || 'live' };
            if (a.items) {
                a.items.forEach((it: any) => {
                    validEvidenceIds.add(it.id);
                    evidenceMap[it.id] = { type: 'kpi_item', label: `KPI: ${it.metricName || 'Không tên'}`, scoreMode: a.resultMode || 'live', assignmentId: a.id };
                });
            }
        });
    }

    const validModules = new Set<string>();
    if (hasDaily) validModules.add('daily_report');
    if (hasTask) validModules.add('task');
    if (hasKpi) validModules.add('kpi');

    const normalizedResult = normalizeExecutiveIntelligenceResult(
        parsedResult, 
        validEvidenceIds,
        validModules,
        envelope.metadata.recordCounts
    );

    // Inject deterministic cross-module groups directly into the issues array to bypass hallucination
    normalizedResult.issues = associatedIssueGroups as any;
    // Inject deterministic follow-ups
    normalizedResult.followUps = generatedFollowUps as any;

    envelope.metadata = envelope.metadata || {} as any;
    envelope.metadata.issueCount = deterministicIssues.length;
    envelope.metadata.groupCount = associatedIssueGroups.length;
    envelope.metadata.followUpCount = generatedFollowUps.length;

    const includedModules = [];
    const emptyModules = [];
    const truncatedModules = [];

    
    if (hasDaily) includedModules.push('daily_report'); else emptyModules.push('daily_report');
    if (hasTask) includedModules.push('task'); else emptyModules.push('task');
    if (hasKpi) includedModules.push('kpi'); else emptyModules.push('kpi');

    if (dailyTruncated) truncatedModules.push('daily_report');
    if (taskTruncated) truncatedModules.push('task');
    if (kpiTruncated) truncatedModules.push('kpi');

    // Retrieve accurate context counts for KPI live vs official based on envelope counts
    let liveCount = 0;
    let officialCount = 0;
    let assignmentCount = 0;
    let itemCount = 0;
    let overdueCount = 0; // derived from task context if supported

    if (envelope.data?.kpis?.assignments) {
       assignmentCount = envelope.data.kpis.assignments.length;
       for (const a of envelope.data.kpis.assignments) {
          if (a.resultMode === 'official') officialCount++;
          else liveCount++;
          if (a.items) itemCount += a.items.length;
       }
    }
    
    if (envelope.data?.tasks?.tasks) {
        for(const t of envelope.data.tasks.tasks) {
           if(t.isOverdue || t.status === 'overdue') overdueCount++; // rough approximation of backend semantics mapped
        }
    }

    return {
        summary: normalizedResult.summary || '',
        evidenceMap,
        highlights: normalizedResult.highlights || [],
        issues: normalizedResult.issues || [],
        followUps: normalizedResult.followUps || [],
        moduleOverview: {
            dailyReport: { 
                status: hasDaily ? 'available' : 'empty', 
                count: envelope.metadata.recordCounts['daily_reports'] || 0, 
                dateFrom: req.dateFrom, 
                dateTo: req.dateTo,
                truncated: dailyTruncated 
            },
            task: { 
                status: hasTask ? 'available' : 'empty', 
                count: envelope.metadata.recordCounts['tasks'] || 0, 
                overdueCount: overdueCount,
                truncated: taskTruncated 
            },
            kpi: { 
                status: hasKpi ? 'available' : 'empty', 
                assignmentCount: assignmentCount, 
                itemCount: itemCount,
                liveCount: liveCount,
                officialCount: officialCount,
                kpiPeriod: req.kpiPeriodId,
                truncated: kpiTruncated 
            }
        },
        metadata: {
            unit: envelope.scope?.targetUnitId ? { id: envelope.scope.targetUnitId, name: envelope.scope.targetUnitName } : undefined,
            featureKey: req.featureKey || 'executive.overview',
            generatedAt: new Date().toISOString(),
            scope: envelope.scope || {},
            reportingWindow: { dateFrom: req.dateFrom, dateTo: req.dateTo, label: req.periodType },
            kpiPeriod: req.kpiPeriodId,
            includedModules,
            emptyModules,
            unavailableModules: [],
            truncatedModules,
            truncated: aggregateTruncated,
            counts: envelope.metadata.recordCounts
        }
    };
  }
};
