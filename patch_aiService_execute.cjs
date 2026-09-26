const fs = require('fs');
let content = fs.readFileSync('src/services/ai/aiService.ts', 'utf8');

content = content.replace(
  "const context_metadata = {\n      scope_type: req.context?.authorizedScope ? 'organization' : 'unknown',\n      unit_count: req.context?.authorizedScope?.unitIds?.length || 0,\n      has_period: !!req.context?.period\n    };",
  "const context_metadata = {\n      scope_type: req.context?.scope?.scopeType || 'unknown',\n      unit_count: req.context?.scope?.unitIds?.length || 0,\n      has_period: !!req.context?.request?.periodId,\n      truncated: req.context?.metadata?.truncated || false\n    };"
);

fs.writeFileSync('src/services/ai/aiService.ts', content);
