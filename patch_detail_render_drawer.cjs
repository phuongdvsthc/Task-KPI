const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', 'utf8');

// Insert after traceDrawerItemId (which uses KpiActualTraceDrawer)
content = content.replace(
  "{traceDrawerItemId && (",
  "{scoreTraceItemId && itemScores[scoreTraceItemId] && (\n        <KpiScoreTraceDrawer\n          scoreItem={itemScores[scoreTraceItemId]}\n          onClose={() => setScoreTraceItemId(null)}\n        />\n      )}\n\n      {traceDrawerItemId && ("
);

fs.writeFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', content);
