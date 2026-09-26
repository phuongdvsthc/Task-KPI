const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/dashboard/drilldown/KpiDetailView.tsx', 'utf8');

content = content.replace(
    /import \{ useAuth \} from '\.\.\/\.\.\/\.\.\/\.\.\/contexts\/AuthContext';/,
    "import { useAuth } from '../../../../context/AuthContext';"
);

content = content.replace(
    /if \(sumRes\.error\) throw new Error\(sumRes\.error\);/g,
    "if (sumRes.error) throw sumRes.error;"
);

content = content.replace(
    /if \(unitRes\.error\) throw new Error\(unitRes\.error\);/g,
    "if (unitRes.error) throw new Error(typeof unitRes.error === 'string' ? unitRes.error : 'Unknown error');"
);

content = content.replace(
    /if \(res\.error\) throw new Error\(res\.error\);/g,
    "if (res.error) throw res.error;"
);

fs.writeFileSync('src/components/kpis/dashboard/drilldown/KpiDetailView.tsx', content);
