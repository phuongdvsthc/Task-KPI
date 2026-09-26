const fs = require('fs');
let content = fs.readFileSync('src/components/admin/settings/AiSettingsView.tsx', 'utf8');
content = content.replace(
    "const [saving, setSaving] = useState(false);",
    "const [saving, setSaving] = useState(false);\n  const [activeTab, setActiveTab] = useState<'provider' | 'registry'>('provider');"
);
fs.writeFileSync('src/components/admin/settings/AiSettingsView.tsx', content);
