const fs = require('fs');
let content = fs.readFileSync('src/components/admin/settings/AiUsageAuditView.tsx', 'utf8');
content = content.replace("import { Loader2, Search, Filter, Eye } from 'lucide-react';", "import { Loader2, Search, Filter, Eye, RefreshCw } from 'lucide-react';");
fs.writeFileSync('src/components/admin/settings/AiUsageAuditView.tsx', content);
