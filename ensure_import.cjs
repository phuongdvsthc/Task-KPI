const fs = require('fs');

function inject(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    if (!content.includes('Download} from \'lucide-react\'') && !content.includes('Download } from \'lucide-react\'')) {
        content = content.replace(/import \{([^}]+)\} from 'lucide-react';/, `import {$1, Download} from 'lucide-react';`);
    }

    fs.writeFileSync(filePath, content);
}

const files = [
    'src/components/kpis/dashboard/KpiManagerDashboardView.tsx',
    'src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx',
    'src/components/kpis/dashboard/drilldown/KpiUnitDetailView.tsx',
    'src/components/kpis/dashboard/drilldown/KpiDetailView.tsx'
];

files.forEach(inject);
