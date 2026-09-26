const fs = require('fs');
let code = fs.readFileSync('src/types/daily-report.ts', 'utf8');

code = code.replace(
  "source_channel: string;", 
  "source_channel: string;\n  report_source_id?: string | null;\n  report_source?: {\n    name: string;\n  };\n"
);

fs.writeFileSync('src/types/daily-report.ts', code);
