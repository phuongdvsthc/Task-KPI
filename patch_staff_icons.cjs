const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', 'utf8');
content = content.replace(
  "import { Search, Filter, RefreshCw, AlertCircle, ChevronDown, ChevronRight, FileText, CheckCircle2, Clock, Check, Send, Activity, Settings2, History } from 'lucide-react';",
  "import { Search, Filter, RefreshCw, AlertCircle, ChevronDown, ChevronRight, FileText, CheckCircle2, Clock, Check, Send, Activity, Settings2, History, Calculator } from 'lucide-react';"
);
fs.writeFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', content);
