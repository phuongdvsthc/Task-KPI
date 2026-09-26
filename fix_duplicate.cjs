const fs = require('fs');

function fix(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove any duplicate Download imports
    content = content.replace(/,\s*Download\s*,\s*Download/g, ', Download');
    content = content.replace(/import \{([^}]*?)Download([^}]*?)Download([^}]*?)\} from 'lucide-react';/g, 'import {$1Download$2$3} from \'lucide-react\';');
    
    // Some lines might just have multiple imports. We can just use a Set for the named imports of lucide-react.
    const importRegex = /import \{([^}]+)\} from 'lucide-react';/g;
    content = content.replace(importRegex, (match, p1) => {
        const tokens = p1.split(',').map(s => s.trim()).filter(s => s);
        const uniqueTokens = Array.from(new Set(tokens));
        return `import { ${uniqueTokens.join(', ')} } from 'lucide-react';`;
    });

    fs.writeFileSync(filePath, content);
}

const files = [
    'src/components/kpis/dashboard/KpiManagerDashboardView.tsx',
    'src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx',
    'src/components/kpis/dashboard/drilldown/KpiUnitDetailView.tsx',
    'src/components/kpis/dashboard/drilldown/KpiDetailView.tsx'
];

files.forEach(fix);
