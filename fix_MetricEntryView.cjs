const fs = require('fs');
let code = fs.readFileSync('src/components/metrics/MetricEntryView.tsx', 'utf-8');

// Add error state
code = code.replace(/const \[isLoading, setIsLoading\] = useState<boolean>\(true\);/, "const [isLoading, setIsLoading] = useState<boolean>(true);\n  const [loadError, setLoadError] = useState<string | null>(null);");

// Update loadData
const loadDataRegex = /const loadData = useCallback\(async \(\) => \{[\s\S]*?setIsRefreshing\(false\);\s*\}\s*\}, \[user, selectedUnitId, selectedUserId, selectedDate, isAdmin, isManager\]\);/m;
const newLoadData = `const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setSaveAllFeedback(null);
    setLoadError(null);
    try {
      // 1. Lấy metric definitions
      const defs = await metricService.getActiveMetricsForEntry(
        user.id,
        selectedUnitId || undefined
      );
      setMetricDefs(defs);

      // 2. Lấy metric entries đã có.
      const entryPromises = defs.map(async (def) => {
         const period = metricService.calculateMetricPeriod(def.frequency || 'daily', new Date(selectedDate));
         const entries = await metricService.getMetricEntriesForPeriod({
            organization_unit_id: selectedUnitId || undefined,
            user_id: def.measurement_scope === 'unit' ? undefined : (isAdmin ? selectedUserId : user.id),
            period_start: period.period_start,
            period_end: period.period_end
         });
         return { defId: def.id, entry: entries.find(e => e.metric_definition_id === def.id) };
      });
      
      const loadedEntries = await Promise.all(entryPromises);
      const validEntries = loadedEntries.map(e => e.entry).filter(Boolean) as MetricEntry[];
      
      setExistingEntries(validEntries);

      // 3. Khởi tạo maps giá trị và ghi chú từ database
      const newValues: Record<string, string | number> = {};
      const newNotes: Record<string, string> = {};
      defs.forEach((def) => {
        const found = loadedEntries.find((e) => e.defId === def.id)?.entry;
        if (found) {
          newValues[def.id] = found.value;
          newNotes[def.id] = found.note || '';
        } else {
          newValues[def.id] = '';
          newNotes[def.id] = '';
        }
      });
      setValuesMap(newValues);
      setNotesMap(newNotes);
    } catch (err: any) {
      console.error('Lỗi tải dữ liệu chỉ số:', err);
      setLoadError(err.message || 'Lỗi không xác định');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, selectedUnitId, selectedUserId, selectedDate, isAdmin, isManager]);`;

code = code.replace(loadDataRegex, newLoadData.trim());

// Render error state
const renderEmptyState = /if \(!isLoading && metricDefs\.length === 0\) \{[\s\S]*?return \([\s\S]*?<\/div>\);\s*\}/m;
const renderErrorState = `
  if (loadError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-xs">
        <div className="mb-4 rounded-full bg-red-100 p-3 text-red-600">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-red-800">Không thể tải danh sách chỉ số: {loadError}</h3>
        <button
          onClick={loadData}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-red-700 focus:ring-4 focus:ring-red-200 focus:outline-hidden"
        >
          <RefreshCw className="h-4 w-4" />
          Thử lại
        </button>
      </div>
    );
  }

  if (!isLoading && metricDefs.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div className="mb-4 rounded-full bg-slate-100 p-3 text-slate-400">
          <Building2 className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Chưa có chỉ số nào</h3>
        <p className="max-w-md text-sm text-slate-500">
          Không tìm thấy chỉ số nào cần nhập cho{' '}
          <strong className="text-slate-700">
            {isManager ? 'phòng ban này' : 'bạn trong phòng ban này'}
          </strong>{' '}
          có cấu hình "Cho phép nhập tay".
        </p>
      </div>
    );
  }
`;
code = code.replace(renderEmptyState, renderErrorState.trim());

fs.writeFileSync('src/components/metrics/MetricEntryView.tsx', code);
