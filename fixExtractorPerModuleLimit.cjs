const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIssueExtractor.ts', 'utf-8');

code = code.replace(
  `    // Limit candidate volume per module (e.g. 50 total)
    return issues.slice(0, 50);`,
  `    const dailyReportIssues = issues.filter(i => i.module === 'daily_report').slice(0, 15);
    const taskIssues = issues.filter(i => i.module === 'task').slice(0, 20);
    const kpiIssues = issues.filter(i => i.module === 'kpi').slice(0, 20);
    
    const finalIssues = [...dailyReportIssues, ...taskIssues, ...kpiIssues];
    finalIssues.sort((a, b) => a.issueId.localeCompare(b.issueId));
    
    return finalIssues;`
);

fs.writeFileSync('src/services/ai/executiveIssueExtractor.ts', code);
