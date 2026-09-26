const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', 'utf8');
content = content.replace(
  "import { ArrowLeft, Clock, User, Target, Building2, Calendar, CheckCircle2, Lock, Unlock, Edit3, Check, Save, Info, AlertCircle, X, Loader2, Play, Send } from 'lucide-react';",
  "import { ArrowLeft, Clock, User, Target, Building2, Calendar, CheckCircle2, Lock, Unlock, Edit3, Check, Save, Info, AlertCircle, X, Loader2, Play, Send, Calculator } from 'lucide-react';"
);
fs.writeFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', content);
