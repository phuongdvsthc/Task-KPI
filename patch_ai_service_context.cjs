const fs = require('fs');
let content = fs.readFileSync('src/types/ai.ts', 'utf8');
if (!content.includes('userPrompt?: string;')) {
    content = content.replace(
        "timestamp: string;",
        "timestamp: string;\n  userPrompt?: string;"
    );
    fs.writeFileSync('src/types/ai.ts', content);
}

let aiService = fs.readFileSync('src/services/ai/aiService.ts', 'utf8');
aiService = aiService.replace(
    "{ context: req.context, userPrompt: promptRes.renderedUserPrompt }",
    "{ ...req.context, userPrompt: promptRes.renderedUserPrompt }"
);
aiService = aiService.replace(
    "{ context: req.context, userPrompt: promptRes.renderedUserPrompt }",
    "{ ...req.context, userPrompt: promptRes.renderedUserPrompt }"
);
fs.writeFileSync('src/services/ai/aiService.ts', aiService);

