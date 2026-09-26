const fs = require('fs');
let content = fs.readFileSync('src/services/ai/aiContextService.ts', 'utf8');

content = content.replace(
  "    // 4. Fetch specific business artifacts based on requested modules\n    // This is a skeleton. Actual business module calls will go here in B2-B4.",
  "    // 4. Fetch specific business artifacts based on requested modules\n    // This is a skeleton. Actual business module calls will go here in B2-B4.\n    \n    if (modulesToLoad.includes('daily_report')) {\n      const { aiDailyReportContextService } = require('./aiDailyReportContextService');\n      await aiDailyReportContextService.buildDailyReportContext(supabaseAdmin, req, envelope);\n    }"
);

fs.writeFileSync('src/services/ai/aiContextService.ts', content);
