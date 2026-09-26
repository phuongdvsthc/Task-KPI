const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', 'utf8');

content = content.replace(
  "import { KpiScoreTraceDrawer } from './KpiScoreTraceDrawer';",
  "import { KpiScoreTraceDrawer } from './KpiScoreTraceDrawer';\nimport { formatPercent, formatScore, formatScoreStatus } from '../../../utils/kpiScoreFormatter';"
);

fs.writeFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', content);
