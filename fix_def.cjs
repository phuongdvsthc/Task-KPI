const fs = require('fs');
let code = fs.readFileSync('src/components/metrics/MetricEntryView.tsx', 'utf-8');

// In handleSaveAll, we map over pendingMetrics with (def)
// The payload creation inside handleSaveAll:
code = code.replace(/metric\.measurement_scope === 'unit' \? undefined : \(isAdmin \? selectedUserId : user\.id\),/g, (match, offset) => {
    // If it's inside handleSaveSingle, it's correct as metric
    // If it's inside handleSaveAll, it should be def
    return offset > code.indexOf('const handleSaveAll') ? "def.measurement_scope === 'unit' ? undefined : (isAdmin ? selectedUserId : user.id)," : match;
});

fs.writeFileSync('src/components/metrics/MetricEntryView.tsx', code);
