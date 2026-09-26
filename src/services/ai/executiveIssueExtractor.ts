import { AIContextData, AICrossModuleIssue, AICrossModuleIssueCategory, AIContextModule } from '../../types/ai';

export const executiveIssueExtractor = {
  extractIssues(envelope: AIContextData): AICrossModuleIssue[] {
    const issues: AICrossModuleIssue[] = [];

    // 1. Daily Reports
    if (envelope.data.dailyReports?.reports) {
      for (const r of envelope.data.dailyReports.reports) {
        if (!r.note && !r.workSummary) continue; // Basic check

        const textToCheck = (r.note || '').toLowerCase() + ' ' + (r.workSummary || '').toLowerCase();
        
        // Very basic deterministic check for blocker/unresolved text
        // Must explicitly mention blocker or unresolved
        if (textToCheck.includes('blocker') || textToCheck.includes('unresolved') || textToCheck.includes('delayed dependency') || textToCheck.includes('báo cáo ghi nhận')) {
            // We shouldn't rely on random strings, let's look for explicit blocker tags if they exist.
            // Since note field is plain text, let's just trigger if "blocker" or "chậm tiến độ" is in it?
            // Actually, the requirements state: 
            // - explicit blocker creates candidate.
            // - normal report does not fabricate issue.
            // - remote mode alone not issue.
            // - business trip alone not issue.
            // - report issue retains source attribution. ("báo cáo ghi nhận...")
            
            // For now, let's trigger on explicit words in `note`.
            const lcNote = r.note ? r.note.toLowerCase() : '';
            const lcSummary = r.workSummary ? r.workSummary.toLowerCase() : '';
            const hasBlocker = lcNote.includes('blocker') || lcSummary.includes('blocker');
            const hasDelayed = lcNote.includes('delayed dependency') || lcSummary.includes('delayed dependency');
            const hasUnresolved = lcNote.includes('unresolved problem') || lcSummary.includes('unresolved problem') || lcNote.includes('unresolved') || lcSummary.includes('unresolved');
            const hasFollowUp = lcNote.includes('follow-up requirement') || lcSummary.includes('follow-up requirement') || lcNote.includes('cần hỗ trợ') || lcSummary.includes('cần hỗ trợ');
            
            if (hasBlocker || hasDelayed || hasUnresolved || hasFollowUp) {
                let category: AICrossModuleIssueCategory = 'operational_blocker';
                if (hasUnresolved) category = 'unresolved_work';
                
                issues.push({
                    issueId: `dr_issue_${r.dailyReportId}`,
                    category,
                    module: 'daily_report',
                    title: `Reported Issue from ${r.userName || r.userId}`,
                    factualState: `Explicit issue reported in Daily Report for ${r.reportDate}.`,
                    evidence: [r.dailyReportId],
                    scope: {
                        unitId: r.unitId,
                        userId: r.userId
                    },
                    period: {
                        dateFrom: r.reportDate,
                        dateTo: r.reportDate
                    },
                    sourceAttribution: 'báo cáo ghi nhận',
                    followUpEligible: true
                });
            }
        }
      }
    }

    // 2. Tasks
    if (envelope.data.tasks?.tasks) {
      for (const t of envelope.data.tasks.tasks) {
        if (t.isOverdue && t.status !== 'completed' && t.status !== 'cancelled') {
           issues.push({
               issueId: `task_overdue_${t.taskId}`,
               category: 'overdue_work',
               module: 'task',
               title: `Overdue Task: ${t.title}`,
               factualState: `Task is overdue since ${t.dueDate}.`,
               evidence: [t.taskId],
               scope: {
                   unitId: t.unitId,
                   userId: t.owner?.userId
               },
               period: {
                   dateFrom: t.createdAt,
                   dateTo: t.dueDate
               },
               followUpEligible: true
           });
        }
      }
    }

    // 3. KPIs
    if (envelope.data.kpis?.assignments) {
      for (const a of envelope.data.kpis.assignments) {
        
        // Assignment-level issues
        if (a.unscoredWeight > 0 && a.status === 'active') {
            const hasPartial = a.scoredWeight > 0 && a.scoredWeight < a.totalWeight;
            if (hasPartial) {
                issues.push({
                    issueId: `kpi_partial_${a.id}`,
                    category: 'partial_result',
                    module: 'kpi',
                    title: `Partial KPI Result for ${a.assigneeUserName || a.assigneeUnitName}`,
                    factualState: `KPI Assignment is partially scored (${a.scoredWeight}/${a.totalWeight}).`,
                    evidence: [a.id],
                    scope: {
                        unitId: a.assigneeUnitId || a.assigneeUnitIdSnapshot,
                        userId: a.assigneeUserId
                    },
                    period: {
                        periodId: a.periodId
                    },
                    scoreMode: a.resultMode,
                    followUpEligible: true
                });
            }
        }

        // Item-level issues
        for (const it of a.items) {
           let cat: AICrossModuleIssueCategory | null = null;
           let title = '';
           let factual = '';

           if (it.scoringStatus === 'not_scored') {
               if (it.scoringReason === 'actual_not_available') {
                   cat = 'missing_data';
                   title = `Missing Actual Data for ${it.kpiName}`;
                   factual = `No actual value provided for KPI.`;
               } else if (it.scoringReason === 'invalid_config' || it.scoringReason === 'invalid_target') {
                   cat = 'configuration_issue';
                   title = `Configuration Issue for ${it.kpiName}`;
                   factual = `KPI has configuration error: ${it.scoringReason}.`;
               } else {
                   cat = 'unscored_data';
                   title = `Unscored KPI: ${it.kpiName}`;
                   factual = `KPI is pending score calculation.`;
               }
           } else if (it.attainmentState === 'under_target') {
               cat = 'kpi_gap';
               title = `Under Target: ${it.kpiName}`;
               factual = `KPI actual (${it.actual}) did not meet target (${it.target}). Gap: ${it.gap}.`;
           } else if (it.scoringStatus === 'needs_review' || it.scoringReason === 'review_attention') {
               // Assuming Needs Review is mapped somewhere. 
               // For now let's just allow review_attention if reason matches
               cat = 'review_attention';
               title = `Review Attention required: ${it.kpiName}`;
               factual = `KPI is marked for review.`;
           }

           if (cat) {
               issues.push({
                   issueId: `kpi_item_${cat}_${it.id}`,
                   category: cat,
                   module: 'kpi',
                   title,
                   factualState: factual,
                   evidence: [it.id],
                   scope: {
                        unitId: a.assigneeUnitId || a.assigneeUnitIdSnapshot,
                        userId: a.assigneeUserId
                   },
                   period: {
                       periodId: a.periodId
                   },
                   scoreMode: it.resultMode,
                   followUpEligible: true
               });
           }
        }
      }
    }

    // Sort to be deterministic
    issues.sort((a, b) => a.issueId.localeCompare(b.issueId));

    const dailyReportIssues = issues.filter(i => i.module === 'daily_report').slice(0, 15);
    const taskIssues = issues.filter(i => i.module === 'task').slice(0, 20);
    const kpiIssues = issues.filter(i => i.module === 'kpi').slice(0, 20);
    
    const finalIssues = [...dailyReportIssues, ...taskIssues, ...kpiIssues];
    finalIssues.sort((a, b) => a.issueId.localeCompare(b.issueId));
    
    return finalIssues;
  }
};
