const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIssueExtractor.ts', 'utf-8');

code = code.replace(
  `            if (r.note && (
                r.note.toLowerCase().includes('blocker') || 
                r.note.toLowerCase().includes('delayed dependency') ||
                r.note.toLowerCase().includes('unresolved') ||
                r.note.toLowerCase().includes('follow-up requirement')
            )) {
                issues.push({
                    issueId: \`dr_issue_\${r.dailyReportId}\`,
                    category: 'operational_blocker',
                    module: 'daily_report',
                    title: \`Blocker reported by \${r.userName}\`,
                    factualState: \`User reported a blocker/issue on \${r.reportDate}.\`,
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
            }`,
  `            const lcNote = r.note ? r.note.toLowerCase() : '';
            const lcSummary = r.workSummary ? r.workSummary.toLowerCase() : '';
            const hasBlocker = lcNote.includes('blocker') || lcSummary.includes('blocker');
            const hasDelayed = lcNote.includes('delayed dependency') || lcSummary.includes('delayed dependency');
            const hasUnresolved = lcNote.includes('unresolved problem') || lcSummary.includes('unresolved problem') || lcNote.includes('unresolved') || lcSummary.includes('unresolved');
            const hasFollowUp = lcNote.includes('follow-up requirement') || lcSummary.includes('follow-up requirement') || lcNote.includes('cần hỗ trợ') || lcSummary.includes('cần hỗ trợ');
            
            if (hasBlocker || hasDelayed || hasUnresolved || hasFollowUp) {
                let category: AICrossModuleIssueCategory = 'operational_blocker';
                if (hasUnresolved) category = 'unresolved_work';
                
                issues.push({
                    issueId: \`dr_issue_\${r.dailyReportId}\`,
                    category,
                    module: 'daily_report',
                    title: \`Reported Issue from \${r.userName || r.userId}\`,
                    factualState: \`Explicit issue reported in Daily Report for \${r.reportDate}.\`,
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
            }`
);

fs.writeFileSync('src/services/ai/executiveIssueExtractor.ts', code);
