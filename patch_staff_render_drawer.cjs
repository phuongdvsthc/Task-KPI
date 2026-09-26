const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', 'utf8');

// Insert after traceDrawerItemId (which uses KpiActualTraceDrawer)
content = content.replace(
  "{traceDrawerItemId && (",
  `{scoreTraceItemId && (() => {
        // Find the score item across all loaded assignments
        let item: any = null;
        for (const asmId of Object.keys(itemScoresMap)) {
          if (itemScoresMap[asmId][scoreTraceItemId]) {
            item = itemScoresMap[asmId][scoreTraceItemId];
            break;
          }
        }
        if (!item) return null;
        return (
          <KpiScoreTraceDrawer
            scoreItem={item}
            onClose={() => setScoreTraceItemId(null)}
          />
        );
      })()}

      {traceDrawerItemId && (`
);

fs.writeFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', content);
