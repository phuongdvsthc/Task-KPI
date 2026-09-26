/**
 * MetricEntryView Component
 * Phân hệ Nhập kết quả Chỉ số Đo lường (Metric Result Entry)
 * Route: /metrics
 * 
 * Đáp ứng đầy đủ các yêu cầu:
 * 1. Lấy metric_definitions: is_active = true, allow_manual_entry = true, thuộc đơn vị của user (hoặc dùng chung)
 * 2. Cho chọn ngày nhập dữ liệu, mặc định là ngày hiện tại
 * 3. Hiển thị metric theo Category (Tuyển sinh, Tư vấn, Đào tạo, NCKH, Hành chính...)
 * 4. Nhập value cho từng metric
 * 5. Khi lưu: Upsert (UPDATE nếu đã có, INSERT nếu chưa có) dựa trên (metric_def_id, unit_id, user_id, period_date)
 * 6. source_type = 'manual'
 * 7. created_by = current user
 * 8. Cho phép nhập note
 * 9. Phân quyền:
 *    - Staff: Chỉ nhập cho đơn vị mình thuộc
 *    - Manager: Xem dữ liệu toàn đơn vị & nhập cho đơn vị
 *    - Executive: Chỉ xem, không nhập
 *    - Admin: Được xem và chuyển đổi giữa tất cả đơn vị
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  MetricDefinition, 
  MetricEntry, 
  SaveMetricEntryPayload,
  METRIC_CATEGORY_LABELS 
} from '../../types/metric';
import { OrganizationUnit, Profile } from '../../types/database';
import { metricService } from '../../services/metric.service';
import { profileService } from '../../services/profileService';
import { organizationService } from '../../services/organizationService';
import { MetricCategoryGroup } from './MetricCategoryGroup';
import { MetricHistoryModal } from './MetricHistoryModal';
import { 
  BarChart3, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Building2, 
  ShieldAlert, 
  Lock, 
  History, 
  RefreshCw, 
  Loader2,
  SlidersHorizontal,
  CheckCheck,
  Eye,
  Info,
  Filter
} from 'lucide-react';

export const MetricEntryView: React.FC = () => {
  const { user, profile, systemRole, isAdmin, primaryUnit, allUnits } = useAuth();

  // 1. Phân quyền (Role detection)
  const isExecutive = systemRole === 'executive';
  const isManager = systemRole === 'manager';
  const isStaff = systemRole === 'staff';
  const isReadOnly = isExecutive; // Executive chỉ xem, không nhập

  // 2. State chọn ngày (Mặc định là ngày hiện tại)
  const getTodayISO = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO);

  // 3. State đơn vị (Nếu là admin cho chọn đơn vị, staff/manager lock theo đơn vị mình)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(() => {
    return primaryUnit?.id || (allUnits.length > 0 ? allUnits[0].id : '');
  });

  const [availableUnits, setAvailableUnits] = useState<OrganizationUnit[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [metricDefs, setMetricDefs] = useState<MetricDefinition[]>([]);
  const [existingEntries, setExistingEntries] = useState<MetricEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // 4. State nhập liệu: Lưu giữ giá trị thay đổi trên form
  // valuesMap: metric_definition_id -> value (string để dễ nhập liệu input)
  const [valuesMap, setValuesMap] = useState<Record<string, string | number>>({});
  // notesMap: metric_definition_id -> note string
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  // 5. Trạng thái lưu (Saving states)
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [savedSuccessMap, setSavedSuccessMap] = useState<Record<string, boolean>>({});
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [saveAllFeedback, setSaveAllFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 6. UI Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Load danh sách đơn vị khi là Admin
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const units = await organizationService.getUnits();
        setAvailableUnits(units);
        if (isAdmin && !selectedUnitId && units.length > 0) {
          setSelectedUnitId(units[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách đơn vị:', err);
      }
    };
    fetchUnits();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && selectedUnitId) {
      organizationService.getUnitMembers(selectedUnitId).then((members) => {
        const users = members.map(m => m.profile).filter((p): p is Profile => !!p && p.is_active);
        setAvailableUsers(users);
        if (users.length > 0 && !selectedUserId) {
          setSelectedUserId(users[0].id);
        }
      }).catch(console.error);
    }
  }, [isAdmin, selectedUnitId]);

  // Đảm bảo user thường luôn chọn đúng đơn vị của mình
  useEffect(() => {
    if (!isAdmin && primaryUnit?.id) {
      setSelectedUnitId(primaryUnit.id);
    }
  }, [isAdmin, primaryUnit]);

  // Load danh sách metric_definitions và metric_entries theo ngày & đơn vị
  const loadData = useCallback(async () => {
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
  }, [user, selectedUnitId, selectedUserId, selectedDate, isAdmin, isManager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Map existing entries by metric_definition_id for quick lookups
  const entriesMap = useMemo(() => {
    const map = new Map<string, MetricEntry>();
    existingEntries.forEach((entry) => {
      map.set(entry.metric_definition_id, entry);
    });
    return map;
  }, [existingEntries]);

  // Xử lý thay đổi giá trị
  const handleValueChange = (metricId: string, val: string) => {
    if (isReadOnly) return;
    setValuesMap((prev) => ({ ...prev, [metricId]: val }));
    setSavedSuccessMap((prev) => ({ ...prev, [metricId]: false }));
  };

  // Xử lý thay đổi ghi chú
  const handleNoteChange = (metricId: string, note: string) => {
    if (isReadOnly) return;
    setNotesMap((prev) => ({ ...prev, [metricId]: note }));
    setSavedSuccessMap((prev) => ({ ...prev, [metricId]: false }));
  };

  // Xử lý lưu 1 chỉ số đơn lẻ
  const handleSaveSingle = async (metricId: string) => {
    if (isReadOnly || !user) return;

    const valStr = valuesMap[metricId];
    if (valStr === '' || valStr === undefined) return;
    const numValue = Number(valStr);
    if (isNaN(numValue)) {
      alert('Vui lòng nhập giá trị số hợp lệ.');
      return;
    }

    const metric = metricDefs.find(m => m.id === metricId);
    if (!metric) return;

    setSavingMap((prev) => ({ ...prev, [metricId]: true }));
    setSaveAllFeedback(null);

    const period = metricService.calculateMetricPeriod(metric.frequency || 'daily', new Date(selectedDate));

    try {
      const payload: SaveMetricEntryPayload = {
        metric_definition_id: metricId,
        organization_unit_id: selectedUnitId || undefined,
        user_id: metric.measurement_scope === 'unit' ? undefined : (isAdmin ? selectedUserId : user.id),
        period_start: period.period_start,
        period_end: period.period_end,
        value: numValue,
        note: notesMap[metricId] || null,
        source_type: 'manual',
      };

      const saved = await metricService.saveMetricEntry(payload, user.id);

      setExistingEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === saved.id || (e.metric_definition_id === saved.metric_definition_id && e.period_start === saved.period_start && e.period_end === saved.period_end));
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });

      setSavedSuccessMap((prev) => ({ ...prev, [metricId]: true }));
      setTimeout(() => {
        setSavedSuccessMap((prev) => ({ ...prev, [metricId]: false }));
      }, 3000);
    } catch (err: any) {
      alert('Lỗi lưu chỉ số: ' + err.message);
    } finally {
      setSavingMap((prev) => ({ ...prev, [metricId]: false }));
    }
  };

  // Xử lý lưu toàn bộ các chỉ số đã nhập (Batch Upsert)
  const handleSaveAll = async () => {
    if (isReadOnly || !user) return;

    const pendingMetrics = metricDefs.filter((def) => {
      const valStr = valuesMap[def.id];
      const isDirty = !savedSuccessMap[def.id] && valStr !== '' && valStr !== undefined && !isNaN(Number(valStr));
      return isDirty;
    });

    if (pendingMetrics.length === 0) {
      setSaveAllFeedback({ type: 'success', message: 'Không có dữ liệu mới nào cần lưu.' });
      return;
    }

    setIsSavingAll(true);
    setSaveAllFeedback(null);

    const payloads: SaveMetricEntryPayload[] = pendingMetrics.map((def) => {
      const period = metricService.calculateMetricPeriod(def.frequency || 'daily', new Date(selectedDate));
      return {
        metric_definition_id: def.id,
        organization_unit_id: selectedUnitId || undefined,
        user_id: def.measurement_scope === 'unit' ? undefined : (isAdmin ? selectedUserId : user.id),
        period_start: period.period_start,
        period_end: period.period_end,
        value: Number(valuesMap[def.id]),
        note: notesMap[def.id] || null,
        source_type: 'manual',
      };
    });

    try {
      const savedEntries = await metricService.saveMetricEntries(payloads, user.id);
      
      setExistingEntries((prev) => {
        const next = [...prev];
        savedEntries.forEach((saved) => {
          const idx = next.findIndex((e) => e.id === saved.id || (e.metric_definition_id === saved.metric_definition_id && e.period_start === saved.period_start && e.period_end === saved.period_end));
          if (idx >= 0) {
            next[idx] = saved;
          } else {
            next.push(saved);
          }
        });
        return next;
      });

      const newSavedMap = { ...savedSuccessMap };
      pendingMetrics.forEach((def) => {
        newSavedMap[def.id] = true;
      });
      setSavedSuccessMap(newSavedMap);

      setSaveAllFeedback({
        type: 'success',
        message: `Đã lưu thành công ${savedEntries.length} chỉ số!`,
      });
    } catch (err: any) {
      setSaveAllFeedback({
        type: 'error',
        message: 'Lỗi lưu một số chỉ số: ' + err.message,
      });
    } finally {
      setIsSavingAll(false);
    }
  };

  // Nút chuyển ngày nhanh
  const adjustDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // Gom nhóm Metric theo Category
  const groupedMetrics = useMemo(() => {
    // 1. Lọc theo search và category filter
    let filtered = metricDefs;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((m) => m.category === selectedCategory);
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          ((m.name || '').toLowerCase().includes(q)) ||
          ((m.code || '').toLowerCase().includes(q)) ||
          (m.description ? m.description.toLowerCase().includes(q) : false)
      );
    }

    // 2. Nhóm theo Category
    const groups: Record<string, MetricDefinition[]> = {};
    filtered.forEach((metric) => {
      const cat = metric.category || 'other';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(metric);
    });

    return groups;
  }, [metricDefs, selectedCategory, searchQuery]);

  // Thống kê nhanh
  const totalMetrics = metricDefs.length;
  const completedMetrics = metricDefs.filter((m) => {
    const v = valuesMap[m.id];
    return v !== '' && v !== undefined;
  }).length;

  const currentUnitObj = availableUnits.find((u) => u.id === selectedUnitId) || primaryUnit;

  return (
    <div id="metric-entry-view" className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Nhập Kết Quả Chỉ Số Đo Lường
            </h1>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
              /metrics
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Ghi nhận số liệu thực tế định kỳ theo ngày cho các chỉ số tuyển sinh, tư vấn, đào tạo và vận hành.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            id="view-history-btn"
            onClick={() => setIsHistoryModalOpen(true)}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <History className="mr-1.5 h-4 w-4 text-slate-500" />
            <span>Lịch sử nhập liệu</span>
          </button>

          <button
            type="button"
            id="refresh-metrics-btn"
            onClick={() => {
              setIsRefreshing(true);
              loadData();
            }}
            disabled={isRefreshing || isLoading}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition-colors"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {!isReadOnly && (
            <button
              type="button"
              id="save-all-metrics-btn"
              onClick={handleSaveAll}
              disabled={isSavingAll || isLoading || completedMetrics === 0}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-indigo-900 px-5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:bg-slate-300 disabled:shadow-none transition-all"
            >
              {isSavingAll ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  <span>Đang lưu toàn bộ...</span>
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-4 w-4" />
                  <span>Lưu tất cả ({completedMetrics}/{totalMetrics})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. Role Banner & Guidance */}
      {isExecutive && (
        <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-purple-900 shadow-xs">
          <Eye className="h-5 w-5 text-purple-700 shrink-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">Chế độ Ban Giám Hiệu:</span> Quý Thầy/Cô đang xem kết quả chỉ số đo lường toàn trường (Chế độ xem báo cáo, không thực hiện nhập dữ liệu).
          </div>
        </div>
      )}

      {isManager && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-blue-900 shadow-xs">
          <Building2 className="h-5 w-5 text-blue-700 shrink-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">Chế độ Trưởng đơn vị:</span> Quý Thầy/Cô có quyền xem và nhập toàn bộ số liệu của đơn vị <span className="font-semibold underline">{currentUnitObj?.name || 'phụ trách'}</span>.
          </div>
        </div>
      )}

      {isStaff && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-slate-700 shadow-xs">
          <Info className="h-4 w-4 text-indigo-600 shrink-0" />
          <div className="text-xs">
            Bạn đang nhập số liệu cho đơn vị trực thuộc: <span className="font-semibold text-slate-900">{primaryUnit?.name || 'Đơn vị công tác'}</span> ({primaryUnit?.code || '—'}).
          </div>
        </div>
      )}

      {/* 3. Date & Scope Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Date Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Ngày ghi nhận:
            </span>
            
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => adjustDate(-1)}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
                title="Ngày hôm trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="relative flex items-center px-2">
                <Calendar className="mr-2 h-4 w-4 text-indigo-700 pointer-events-none" />
                <input
                  type="date"
                  id="period-date-picker"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => adjustDate(1)}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
                title="Ngày tiếp theo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Quick date shortcuts */}
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayISO())}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                selectedDate === getTodayISO()
                  ? 'bg-indigo-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hôm nay
            </button>
          </div>

          {/* Unit Selector (For Admin) */}
          {isAdmin && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500" />
                <label htmlFor="admin-unit-select" className="text-xs font-bold text-slate-700">
                  Đơn vị:
                </label>
                <select
                  id="admin-unit-select"
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                >
                  <option value="">Tất cả đơn vị</option>
                  {availableUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="admin-user-select" className="text-xs font-bold text-slate-700">
                  Thành viên (cho Metric Cá nhân):
                </label>
                <select
                  id="admin-user-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                >
                  <option value="">-- Chọn thành viên --</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.employee_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Feedback Alert if saved */}
        {saveAllFeedback && (
          <div
            className={`flex items-center justify-between rounded-xl p-3.5 text-xs font-medium ${
              saveAllFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {saveAllFeedback.type === 'success' ? (
                <CheckCheck className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600" />
              )}
              <span>{saveAllFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveAllFeedback(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        )}

        {/* Progress & Category Filters Bar */}
        <div className="flex flex-col gap-3 pt-3 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-between">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({metricDefs.length})
            </button>
            {Object.entries(METRIC_CATEGORY_LABELS).map(([catKey, catMeta]) => {
              const countInCat = metricDefs.filter((m) => m.category === catKey).length;
              if (countInCat === 0) return null;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setSelectedCategory(catKey)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedCategory === catKey
                      ? 'bg-indigo-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {catMeta.label} ({countInCat})
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm chỉ số theo tên hoặc mã..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* 4. Metric Groups List */}
      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-xs font-medium text-slate-500">Đang tải danh mục chỉ số đo lường...</p>
        </div>
      ) : Object.keys(groupedMetrics).length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <BarChart3 className="h-10 w-10 text-slate-300" />
          <h3 className="text-sm font-bold text-slate-800">Không có chỉ số nào cần nhập</h3>
          <p className="max-w-md text-xs text-slate-500">
            Chưa có chỉ số nào được cấu hình áp dụng cho đơn vị này hoặc không tìm thấy chỉ số thỏa mãn bộ lọc.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMetrics).map(([category, metrics]) => (
            <MetricCategoryGroup
              key={category}
              category={category}
              metrics={metrics}
              entriesMap={entriesMap}
              valuesMap={valuesMap}
              notesMap={notesMap}
              isReadOnly={isReadOnly}
              savingMap={savingMap}
              savedSuccessMap={savedSuccessMap}
              onValueChange={handleValueChange}
              onNoteChange={handleNoteChange}
              onSaveSingle={handleSaveSingle}
            />
          ))}
        </div>
      )}

      {/* 5. Floating / Sticky Bottom Bar if there are pending entries to save */}
      {!isReadOnly && completedMetrics > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Đã điền <strong className="text-slate-900">{completedMetrics}/{totalMetrics}</strong> chỉ số cho ngày <strong>{new Date(selectedDate).toLocaleDateString('vi-VN')}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSavingAll}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-800 disabled:opacity-50 transition-all"
            >
              {isSavingAll ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  <span>Lưu tất cả kết quả</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 6. History Modal */}
      <MetricHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        unitId={selectedUnitId}
        unitName={currentUnitObj?.name}
      />
    </div>
  );
};
