const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIntelligence.service.ts', 'utf-8');

code = code.replace(
  `    const validEvidenceIds = new Set<string>();`,
  `    const validEvidenceIds = new Set<string>();
    const evidenceMap: Record<string, { type: string, label: string, [key: string]: any }> = {};`
);

code = code.replace(
  `    if (envelope.data?.dailyReports?.reports) {
        envelope.data.dailyReports.reports.forEach((r: any) => validEvidenceIds.add(r.id));
    }`,
  `    if (envelope.data?.dailyReports?.reports) {
        envelope.data.dailyReports.reports.forEach((r: any) => {
            validEvidenceIds.add(r.id);
            evidenceMap[r.id] = { type: 'daily_report', label: \`Báo cáo ngày \${new Date(r.reportDate || r.created_at || Date.now()).toLocaleDateString('vi-VN')}\`, date: r.reportDate };
        });
    }`
);

code = code.replace(
  `    if (envelope.data?.tasks?.tasks) {
        envelope.data.tasks.tasks.forEach((t: any) => validEvidenceIds.add(t.id));
    }`,
  `    if (envelope.data?.tasks?.tasks) {
        envelope.data.tasks.tasks.forEach((t: any) => {
            validEvidenceIds.add(t.id);
            evidenceMap[t.id] = { type: 'task', label: \`Công việc: \${t.title || 'Không tên'}\`, status: t.status };
        });
    }`
);

code = code.replace(
  `    if (envelope.data?.kpis?.assignments) {
        envelope.data.kpis.assignments.forEach((a: any) => {
            validEvidenceIds.add(a.id);
            if (a.items) {
                a.items.forEach((it: any) => validEvidenceIds.add(it.id));
            }
        });
    }`,
  `    if (envelope.data?.kpis?.assignments) {
        envelope.data.kpis.assignments.forEach((a: any) => {
            validEvidenceIds.add(a.id);
            evidenceMap[a.id] = { type: 'kpi_assignment', label: \`KPI Assignment - \${a.periodName || 'Không rõ'}\`, scoreMode: a.resultMode || 'live' };
            if (a.items) {
                a.items.forEach((it: any) => {
                    validEvidenceIds.add(it.id);
                    evidenceMap[it.id] = { type: 'kpi_item', label: \`KPI: \${it.metricName || 'Không tên'}\`, scoreMode: a.resultMode || 'live', assignmentId: a.id };
                });
            }
        });
    }`
);

code = code.replace(
  `    return {
        summary: normalizedResult.summary || '',`,
  `    return {
        summary: normalizedResult.summary || '',
        evidenceMap,`
);

fs.writeFileSync('src/services/ai/executiveIntelligence.service.ts', code);
