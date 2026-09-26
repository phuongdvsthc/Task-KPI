import { executiveIssueExtractor } from './src/services/ai/executiveIssueExtractor';

const mockEnvelope = {
  data: {
    dailyReports: {
      reports: [
        { dailyReportId: 'dr1', note: 'Explicit blocker on deployment.', reportDate: '2026-09-12' },
        { dailyReportId: 'dr2', workMode: 'remote', reportDate: '2026-09-12' }
      ]
    },
    tasks: {
      tasks: [
        { taskId: 't1', isOverdue: true, status: 'in_progress', title: 'Task 1' },
        { taskId: 't2', isOverdue: false, status: 'in_progress', priority: 'high', title: 'Task 2' },
        { taskId: 't3', isOverdue: true, status: 'completed', title: 'Task 3' }
      ]
    },
    kpis: {
      assignments: [
        {
          id: 'kpi_asg1', 
          status: 'active',
          unscoredWeight: 20,
          scoredWeight: 80,
          totalWeight: 100,
          items: [
            { id: 'item1', attainmentState: 'under_target', kpiName: 'Sales' },
            { id: 'item2', scoringStatus: 'not_scored', scoringReason: 'actual_not_available', kpiName: 'Leads' },
            { id: 'item3', scoringStatus: 'not_scored', scoringReason: 'invalid_config', kpiName: 'NPS' }
          ]
        }
      ]
    }
  }
};

const issues = executiveIssueExtractor.extractIssues(mockEnvelope as any);
console.log(JSON.stringify(issues, null, 2));
