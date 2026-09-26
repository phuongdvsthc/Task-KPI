const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', 'utf8');

content = content.replace(
  "import { kpiActualService, KpiActualResolverResult } from '../../../services/kpiActualService';",
  "import { kpiActualService, KpiActualResolverResult } from '../../../services/kpiActualService';\nimport { kpiScoringService, KpiScoringResult, KpiAssignmentScoreResult } from '../../../services/kpiScoringService';\nimport { KpiScoreTraceDrawer } from './KpiScoreTraceDrawer';"
);

content = content.replace(
  "const [actualsMap, setActualsMap] = useState<Record<string, Record<string, KpiActualResolverResult>>>({});",
  "const [actualsMap, setActualsMap] = useState<Record<string, Record<string, KpiActualResolverResult>>>({});\n  const [scoresMap, setScoresMap] = useState<Record<string, KpiAssignmentScoreResult>>({});\n  const [itemScoresMap, setItemScoresMap] = useState<Record<string, Record<string, KpiScoringResult>>>({});\n  const [scoreTraceItemId, setScoreTraceItemId] = useState<string | null>(null);"
);

content = content.replace(
  "const [itemsRes, actualsRes] = await Promise.all([\n        kpiAssignmentService.getAssignmentItems(assignmentId),\n        kpiActualService.resolveAssignmentActuals(assignmentId)\n      ]);",
  "const [itemsRes, actualsRes, scoreRes] = await Promise.all([\n        kpiAssignmentService.getAssignmentItems(assignmentId),\n        kpiActualService.resolveAssignmentActuals(assignmentId),\n        kpiScoringService.resolveAssignmentScore(assignmentId)\n      ]);"
);

content = content.replace(
  "setActualsMap(prev => ({ ...prev, [assignmentId]: actMap }));\n      }",
  "setActualsMap(prev => ({ ...prev, [assignmentId]: actMap }));\n      }\n      if (scoreRes.data) {\n        setScoresMap(prev => ({ ...prev, [assignmentId]: scoreRes.data as KpiAssignmentScoreResult }));\n        const sMap = scoreRes.data.items.reduce((acc, curr) => {\n          acc[curr.assignment_item_id] = curr;\n          return acc;\n        }, {} as Record<string, KpiScoringResult>);\n        setItemScoresMap(prev => ({ ...prev, [assignmentId]: sMap }));\n      }"
);

fs.writeFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', content);
