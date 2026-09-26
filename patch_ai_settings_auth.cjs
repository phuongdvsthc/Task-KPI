const fs = require('fs');
let content = fs.readFileSync('src/components/admin/settings/AiSettingsView.tsx', 'utf8');

// Replace import
content = content.replace(
    "import { useAuth } from '../../../context/AuthContext';",
    "import { getSupabaseClient } from '../../../lib/supabase';"
);

// Remove session from hook
content = content.replace(
    "const { session } = useAuth();",
    ""
);

// Fix fetch calls to get token dynamically
content = content.replace(
    /headers:\s*\{\s*Authorization:\s*`Bearer \$\{session\?\.access_token\}`\s*\}/g,
    `headers: { Authorization: \`Bearer \${(await getSupabaseClient().auth.getSession()).data.session?.access_token}\` }`
);

content = content.replace(
    /Authorization:\s*`Bearer \$\{session\?\.access_token\}`/g,
    `Authorization: \`Bearer \${(await getSupabaseClient().auth.getSession()).data.session?.access_token}\``
);

fs.writeFileSync('src/components/admin/settings/AiSettingsView.tsx', content);
