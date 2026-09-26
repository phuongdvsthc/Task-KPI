const fs = require('fs');
let code = fs.readFileSync('src/services/ai/aiPromptRegistry.ts', 'utf-8');

// The issue is that expectedSchema object closing bracket `}` is missing before the prompt object closing bracket `},`
// Basically:
//       required: ["summary", "highlights", "issues", "actions"]
//   },
// should be:
//       required: ["summary", "highlights", "issues", "actions"]
//     }
//   },

code = code.replace(/required:\s*\[([^\]]+)\]\s*\n\s*\},/g, 'required: [$1]\n    }\n  },');

fs.writeFileSync('src/services/ai/aiPromptRegistry.ts', code);
