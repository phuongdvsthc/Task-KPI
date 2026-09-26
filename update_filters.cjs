const fs = require('fs');

function updateDashboard(filePath, pathPrefix) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Add state for advanced filters toggle
    if (!content.includes('const [showAdvancedFilters')) {
        content = content.replace(/const \[filters, setFilters\] = useState<KpiDashboardFilters>\(\{[\s\S]*?\}\);/,
        `const [filters, setFilters] = useState<KpiDashboardFilters>({
    periodId: '',
    unitId: undefined,
    assignmentStatus: 'all',
    resultMode: 'all',
    assigneeType: 'all',
    reviewStatus: 'all',
    completionStatus: 'all',
    effectiveFrom: '',
    effectiveTo: '',
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);`);
    }

    // Add lucide imports
    if (!content.includes('SlidersHorizontal')) {
        content = content.replace(/import \{([\s\S]*?)LayoutDashboard,/, 'import {$1LayoutDashboard, SlidersHorizontal,');
    }

    // Add helper functions for handling new filters
    if (!content.includes('handleAdvancedFilterChange')) {
        const handlerStr = `
  const handleAdvancedFilterChange = (key: keyof KpiDashboardFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters(prev => ({
      ...prev,
      unitId: undefined,
      assignmentStatus: 'all',
      resultMode: 'all',
      assigneeType: 'all',
      reviewStatus: 'all',
      completionStatus: 'all',
      effectiveFrom: '',
      effectiveTo: '',
    }));
  };

  const activeAdvancedFilterCount = [
    filters.assigneeType !== 'all',
    filters.reviewStatus !== 'all',
    filters.completionStatus !== 'all',
    !!filters.effectiveFrom,
    !!filters.effectiveTo
  ].filter(Boolean).length;
`;
        content = content.replace(/  \/\/ --- Render State Checks ---/, handlerStr + '\n  // --- Render State Checks ---');
    }

    // Replace the filter section
    // Find the end of the global filters div
    const filterUiStr = `
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Period Selector */}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Kỳ KPI
                    </label>
                    <select
                      value={filters.periodId}
                      onChange={handlePeriodChange}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      {periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Unit Filter */}
                  <div className="flex items-center gap-2 pl-0 sm:pl-3 sm:border-l sm:border-slate-200">
                    <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider hidden sm:inline-block">
                      Đơn vị
                    </label>
                    <select
                      value={filters.unitId || ''}
                      onChange={handleUnitChange}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Tất cả đơn vị</option>
                      {${filePath.includes('Executive') ? 'orgUnits.map((u)' : 'scopeUnits.map((u)'} => (
                        <option key={u.id || u.unit_id} value={u.id || u.unit_id}>
                          {u.name || u.unit_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-2 pl-0 sm:pl-3 sm:border-l sm:border-slate-200">
                    <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider hidden sm:inline-block">
                      Trạng thái KPI
                    </label>
                    <select
                      value={filters.assignmentStatus || 'all'}
                      onChange={(e) => setFilters(prev => ({ ...prev, assignmentStatus: e.target.value as any }))}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="active">Đang áp dụng</option>
                      <option value="closed">Đã chốt</option>
                      <option value="locked">Đã khóa</option>
                    </select>
                  </div>
                  
                  {/* Result Mode */}
                  <div className="flex items-center gap-2 pl-0 sm:pl-3 sm:border-l sm:border-slate-200">
                    <BarChart2 className="h-4 w-4 text-slate-400 shrink-0" />
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider hidden sm:inline-block">
                      Loại kết quả
                    </label>
                    <select
                      value={filters.resultMode}
                      onChange={(e) => setFilters(prev => ({ ...prev, resultMode: e.target.value as any }))}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">Tất cả (Chính thức + Tạm tính)</option>
                      <option value="official">Chỉ Chính thức</option>
                      <option value="live">Chỉ Tạm tính</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors \${showAdvancedFilters ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}\`}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Bộ lọc nâng cao
                    {activeAdvancedFilterCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                        {activeAdvancedFilterCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Làm mới dữ liệu"
                  >
                    <RefreshCw className={\`h-5 w-5 \${loading ? 'animate-spin' : ''}\`} />
                  </button>
                </div>
              </div>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Assignee Type */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Đối tượng
                      </label>
                      <select
                        value={filters.assigneeType || 'all'}
                        onChange={(e) => handleAdvancedFilterChange('assigneeType', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="all">Tất cả đối tượng</option>
                        <option value="individual">Cá nhân</option>
                        <option value="organization">Đơn vị</option>
                      </select>
                    </div>

                    {/* Review Status */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Trạng thái đánh giá
                      </label>
                      <select
                        value={filters.reviewStatus || 'all'}
                        onChange={(e) => handleAdvancedFilterChange('reviewStatus', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="not_started">Chưa đánh giá</option>
                        <option value="in_review">Đang xem xét</option>
                        <option value="returned">Yêu cầu làm lại</option>
                        <option value="approved">Đã phê duyệt</option>
                      </select>
                    </div>

                    {/* Completion Status */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Mức dữ liệu
                      </label>
                      <select
                        value={filters.completionStatus || 'all'}
                        onChange={(e) => handleAdvancedFilterChange('completionStatus', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="all">Tất cả mức dữ liệu</option>
                        <option value="complete">Đủ dữ liệu</option>
                        <option value="partial">Một phần</option>
                        <option value="unscored">Chưa có điểm</option>
                      </select>
                    </div>

                    {/* Effective From */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Từ ngày
                      </label>
                      <input
                        type="date"
                        value={filters.effectiveFrom || ''}
                        onChange={(e) => handleAdvancedFilterChange('effectiveFrom', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Effective To */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Đến ngày
                      </label>
                      <input
                        type="date"
                        value={filters.effectiveTo || ''}
                        onChange={(e) => handleAdvancedFilterChange('effectiveTo', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  
                  {activeAdvancedFilterCount > 0 && (
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleResetFilters}
                        className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>`;

    content = content.replace(/<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">[\s\S]*?(?=<\!-- SECTION 3|<\/\* SECTION 3)/, filterUiStr + '\n          ');

    fs.writeFileSync(filePath, content);
}

updateDashboard('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', '#/kpis/dashboard');
updateDashboard('src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx', '#/kpis/executive-dashboard');
