const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', 'utf8');

// 1. Add imports
content = content.replace(
  "import { kpiActualService, KpiActualResolverResult } from '../../../services/kpiActualService';",
  "import { kpiActualService, KpiActualResolverResult } from '../../../services/kpiActualService';\nimport { kpiScoringService, KpiScoringResult, KpiAssignmentScoreResult } from '../../../services/kpiScoringService';\nimport { KpiScoreTraceDrawer } from './KpiScoreTraceDrawer';"
);

// 2. Add state for scores
content = content.replace(
  "const [actuals, setActuals] = useState<Record<string, KpiActualResolverResult>>({});",
  "const [actuals, setActuals] = useState<Record<string, KpiActualResolverResult>>({});\n  const [assignmentScore, setAssignmentScore] = useState<KpiAssignmentScoreResult | null>(null);\n  const [itemScores, setItemScores] = useState<Record<string, KpiScoringResult>>({});\n  const [scoreTraceItemId, setScoreTraceItemId] = useState<string | null>(null);"
);

// 3. Update loading logic
content = content.replace(
  "const [detailRes, itemsRes, actualsRes] = await Promise.all([\n        kpiAssignmentService.getAssignmentDetail(assignmentId),\n        kpiAssignmentService.getAssignmentItems(assignmentId),\n        kpiActualService.resolveAssignmentActuals(assignmentId)\n      ]);",
  "const [detailRes, itemsRes, actualsRes, scoreRes] = await Promise.all([\n        kpiAssignmentService.getAssignmentDetail(assignmentId),\n        kpiAssignmentService.getAssignmentItems(assignmentId),\n        kpiActualService.resolveAssignmentActuals(assignmentId),\n        kpiScoringService.resolveAssignmentScore(assignmentId)\n      ]);"
);

content = content.replace(
  "setActuals(actualsMap);\n      }",
  "setActuals(actualsMap);\n      }\n      if (scoreRes.data) {\n        setAssignmentScore(scoreRes.data);\n        const sMap = scoreRes.data.items.reduce((acc, curr) => {\n          acc[curr.assignment_item_id] = curr;\n          return acc;\n        }, {} as Record<string, KpiScoringResult>);\n        setItemScores(sMap);\n      }"
);

fs.writeFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', content);
