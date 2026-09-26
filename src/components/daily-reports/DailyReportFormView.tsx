import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dailyReportService } from '../../services/daily-report.service';
import { metricService } from '../../services/metricService';
import { SaveDailyReportPayload } from '../../types/daily-report';
import { MetricDefinition } from '../../types/metric';
import { Save, ArrowLeft, AlertCircle, AlertTriangle, Building2, Calculator, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';

const STATUSES = ['Đi làm', 'Nghỉ phép', 'Công tác', 'Trực sự kiện', 'Làm online'];

interface ReportSource {
  id: string;
  code: string;
  name: string;
  category?: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
}

export const DailyReportFormView: React.FC<{ id?: string }> = ({ id }) => {
  const { user } = useAuth();
  const navigate = (path: string) => { window.location.hash = `#${path}`; };
  
  const isEdit = Boolean(id);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile and primary organization data
  const [userUnitId, setUserUnitId] = useState<string>('');
  const [userUnitName, setUserUnitName] = useState<string>('');
  const [userUnitCode, setUserUnitCode] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('viewer');

  // Form data
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [workStatus, setWorkStatus] = useState(STATUSES[0]);
  const [reportSources, setReportSources] = useState<ReportSource[]>([]);
  const [sourceChannel, setSourceChannel] = useState('');
  const [reportSourceId, setReportSourceId] = useState('');
  const [customChannel, setCustomChannel] = useState('');
  const [interestGroup, setInterestGroup] = useState('');
  const [relatedTaskId, setRelatedTaskId] = useState('');
  const [workSummary, setWorkSummary] = useState('');
  const [issues, setIssues] = useState('');
  const [supportRequest, setSupportRequest] = useState('');

  // All metrics loaded for current source
  const [allSourceMetrics, setAllSourceMetrics] = useState<MetricDefinition[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [valuesMap, setValuesMap] = useState<Record<string, number>>({});

  // 1. Initial Load: Profile, Primary Organization & Report Sources
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase client chưa được khởi tạo.');

        // 1. Get profile and check role
        const { data: profile, error: profileErr } = await dailyReportService.fetchWithRetry(
          async () => await supabase.from('profiles').select('id, system_role, full_name').eq('id', user.id).single()
        );
        if (profileErr) throw new Error(`Lỗi tải hồ sơ người dùng: ${profileErr.message}`);

        const role = profile?.system_role || 'viewer';
        setUserRole(role);

        // Allow staff only to input daily reports
        if (role !== 'staff') {
          setError('Chỉ có nhân sự (Staff) mới có quyền nhập báo cáo hằng ngày.');
          setIsLoading(false);
          return;
        }

        // 2. Get primary organization of the current user
        const { data: orgMembers, error: orgErr } = await dailyReportService.fetchWithRetry(
          async () => await supabase
            .from('organization_members')
            .select('organization_unit_id, is_primary, organization_units:organization_unit_id(id, code, name)')
            .eq('user_id', user.id)
            .order('is_primary', { ascending: false })
        );

        if (orgErr) throw new Error(`Lỗi tải thông tin đơn vị: ${orgErr.message}`);

        const primaryMember = orgMembers?.find((m: any) => m.is_primary) || orgMembers?.[0];
        const primaryUnitId = primaryMember?.organization_unit_id;
        const orgUnitData = primaryMember?.organization_units as any;
        const primaryUnitCode = orgUnitData?.code || '';
        const primaryUnitName = orgUnitData?.name || '';

        if (!primaryUnitId) {
          throw new Error('Không xác định được đơn vị công tác chính của tài khoản.');
        }

        setUserUnitId(primaryUnitId);
        setUserUnitCode(primaryUnitCode);
        setUserUnitName(primaryUnitName);

        // Safe dev log - strictly no token
        if (process.env.NODE_ENV !== 'production' || (import.meta as any).env?.DEV) {
          console.log('[DailyReport/new] Current User Organization:', {
            userId: user.id,
            primaryOrganizationId: primaryUnitId,
            primaryOrganizationCode: primaryUnitCode
          });
        }

        // 3. Load Report Sources for current primary organization
        const sources: ReportSource[] = await dailyReportService.getReportSourcesForUnit(primaryUnitId);
        setReportSources(sources);

        // 4. Load tasks
        const tasks = await dailyReportService.getMyTasks(user.id);
        setMyTasks(tasks);

        // 5. If editing existing report, fetch its details
        if (isEdit && id) {
          const report = await dailyReportService.getDailyReportById(id, user.id);
          setReportDate(report.report_date);
          setWorkStatus(report.work_status);
          
          if (report.report_source_id) {
            setReportSourceId(report.report_source_id);
            const matchedSource = sources.find(s => s.id === report.report_source_id);
            setSourceChannel(matchedSource ? matchedSource.name : (report.report_sources?.name || report.source_channel || ''));
          } else if (report.source_channel) {
            const matchedSource = sources.find(s => s.name === report.source_channel);
            if (matchedSource) {
              setReportSourceId(matchedSource.id);
              setSourceChannel(matchedSource.name);
            } else {
              setReportSourceId('');
              setSourceChannel(report.source_channel);
            }
          }

          setInterestGroup(report.interest_group || '');
          setRelatedTaskId(report.related_task_id || '');
          setWorkSummary(report.work_summary || '');
          setIssues(report.issues || '');
          setSupportRequest(report.support_request || '');
        } else {
          // New report: default select first active source
          if (sources.length > 0) {
            setReportSourceId(sources[0].id);
            setSourceChannel(sources[0].name);
          } else {
            setReportSourceId('');
            setSourceChannel('');
          }
        }
      } catch (err: any) {
        console.error('Error loading initial daily report form data:', err);
        setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu biểu mẫu.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [user, id, isEdit]);

  // 2. Load metrics dynamically whenever reportSourceId changes (or on edit report load)
  useEffect(() => {
    const loadMetricsForCurrentSource = async () => {
      if (!user || userRole !== 'staff' || !userUnitId) return;

      setIsLoadingMetrics(true);
      try {
        let metrics: MetricDefinition[] = [];

        if (reportSourceId) {
          // v0.3.4d: Load metrics assigned specifically to this report source
          metrics = await metricService.getMetricsForReportSource(reportSourceId);
        }

        // Fallback: If no metrics assigned to source or no source selected, load unit active manual/calculated metrics
        if (metrics.length === 0 && userUnitId) {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data: fallbackDefs } = await dailyReportService.fetchWithRetry(
              async () => await supabase
                .from('metric_definitions')
                .select('*')
                .eq('organization_unit_id', userUnitId)
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
            );
            metrics = fallbackDefs || [];
          }
        }

        setAllSourceMetrics(metrics);

        // If editing, load existing entries and populate valuesMap
        if (isEdit && id) {
          const entries = await dailyReportService.getDailyReportMetrics(id);
          const vMap: Record<string, number> = {};
          metrics.forEach(d => { vMap[d.id] = 0; });
          entries.forEach(e => {
            if (e.metric_definition_id) {
              vMap[e.metric_definition_id] = typeof e.value === 'number' ? e.value : parseFloat(e.value as any || '0');
            }
          });
          setValuesMap(vMap);
        } else {
          // Reset/preserve values for manual metrics
          setValuesMap(prev => {
            const newMap: Record<string, number> = {};
            metrics.forEach(d => {
              newMap[d.id] = prev[d.id] ?? 0;
            });
            return newMap;
          });
        }
      } catch (err: any) {
        console.error('Error loading metrics for source:', err);
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    if (userUnitId) {
      loadMetricsForCurrentSource();
    }
  }, [reportSourceId, userUnitId, isEdit, id, userRole]);

  // Separate manual metrics (inputs) and calculated metrics (ratios)
  const manualMetrics = useMemo(() => {
    return allSourceMetrics.filter(m => m.entry_mode !== 'calculated' && m.is_active !== false);
  }, [allSourceMetrics]);

  const calculatedMetrics = useMemo(() => {
    return allSourceMetrics.filter(m => m.entry_mode === 'calculated' && m.is_active !== false);
  }, [allSourceMetrics]);

  const handleMetricChange = (defId: string, val: string) => {
    const num = val === '' ? 0 : parseFloat(val);
    setValuesMap(prev => ({
      ...prev,
      [defId]: isNaN(num) ? 0 : num
    }));
  };

  const handleSourceChange = (newSourceVal: string) => {
    if (isEdit) return; // Source is locked in edit mode

    const currentSourceSelection = reportSourceId || (sourceChannel === 'Khác' ? 'Khác' : '');
    if (newSourceVal === currentSourceSelection) return;

    // Check if user has entered at least one metric value
    const hasEnteredValues = Object.values(valuesMap).some(
      v => typeof v === 'number' && v > 0 && !isNaN(v)
    );

    if (hasEnteredValues) {
      const confirmed = window.confirm(
        'Bạn đang có dữ liệu chưa lưu.\nĐổi Kênh/Nguồn sẽ xóa các giá trị vừa nhập.'
      );
      if (!confirmed) {
        return; // Keep existing source and values
      }
      // Confirmed: clear metric form values
      setValuesMap({});
    }

    if (newSourceVal === 'Khác') {
      setReportSourceId('');
      setSourceChannel('Khác');
    } else {
      const src = reportSources.find(s => s.id === newSourceVal);
      if (src) {
        setReportSourceId(src.id);
        setSourceChannel(src.name);
      } else {
        setReportSourceId('');
        setSourceChannel(newSourceVal);
      }
    }
  };

  // =========================================================================
  // DYNAMIC RATIO ENGINE (Derived entirely from active calculated metrics)
  // =========================================================================
  const dynamicRatios = useMemo(() => {
    return calculatedMetrics.map(calcMetric => {
      const numId = calcMetric.numerator_metric_id;
      const denId = calcMetric.denominator_metric_id;

      if (!numId || !denId) {
        return {
          id: calcMetric.id,
          name: calcMetric.name,
          code: calcMetric.code,
          value: '—',
          unit: calcMetric.unit || '%',
        };
      }

      const numVal = valuesMap[numId] || 0;
      const denVal = valuesMap[denId] || 0;

      let displayVal = '—';
      if (denVal > 0) {
        const ratio = (numVal / denVal) * 100;
        displayVal = `${ratio.toFixed(1)}%`;
      } else if (denVal === 0 && numVal === 0) {
        displayVal = '—';
      }

      return {
        id: calcMetric.id,
        name: calcMetric.name,
        code: calcMetric.code,
        value: displayVal,
        unit: calcMetric.unit || '%',
        numeratorName: calcMetric.numerator_metric?.name,
        denominatorName: calcMetric.denominator_metric?.name,
      };
    });
  }, [calculatedMetrics, valuesMap]);

  const handleSave = async () => {
    if (!user || userRole !== 'staff') return;

    // Validate currentUser.id and primaryOrganizationUnitId before proceeding
    if (!user.id || !userUnitId) {
      setError('Không xác định được đơn vị công tác chính của tài khoản.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Development only log - strictly no token
      if (process.env.NODE_ENV !== 'production' || (import.meta as any).env?.DEV) {
        console.log('[DailyReport v0.3.4e] Saving report:', {
          userId: user.id,
          primaryOrganizationId: userUnitId,
          reportDate: reportDate,
        });
      }

      // Construct payload for v0.3.4e
      // user_id = currentUser.id
      // organization_unit_id = primaryOrganizationUnitId
      // report_date = selectedDate
      // work_status = current work status
      // report_status = 'draft' initially
      // For new v0.3.4e reports, do NOT write legacy fields: report_source_id, source_channel
      const payload: SaveDailyReportPayload = {
        id: id || undefined,
        report_date: reportDate,
        user_id: user.id,
        organization_unit_id: userUnitId,
        work_status: workStatus,
        report_status: 'draft',
        interest_group: interestGroup || null,
        related_task_id: relatedTaskId || null,
        work_summary: workSummary || null,
        issues: issues || null,
        support_request: supportRequest || null,
      };

      // 1. Insert or update daily_reports first
      const report = await dailyReportService.saveDailyReport(payload);

      // 2. Obtain dailyReport.id
      if (!report || !report.id) {
        throw new Error('Lỗi: Không tìm thấy ID của báo cáo hằng ngày sau khi lưu.');
      }

      // 3. Filter ONLY manual metrics (strictly exclude calculated metrics)
      const manualOnlyMetrics = manualMetrics.filter(m => m.entry_mode !== 'calculated');

      // Build metric entries strictly referencing dailyReport.id as source_reference_id
      // Ensure unit and organization scoped metrics have user_id = null for RLS compliance
      const entries = manualOnlyMetrics.map(def => {
        const isUnitOrOrgScope = def.measurement_scope === 'unit' || def.measurement_scope === 'organization';
        return {
          metric_definition_id: def.id,
          organization_unit_id: report.organization_unit_id || def.organization_unit_id || null,
          user_id: isUnitOrOrgScope ? null : report.user_id,
          period_start: report.report_date,
          period_end: report.report_date,
          value: Number(valuesMap[def.id]) || 0,
          source_type: 'manual',
          source_reference_id: report.id,
          created_by: user.id,
        };
      });

      // 4. Save manual metric entries (inserts or updates without duplicate)
      if (entries.length > 0) {
        await dailyReportService.saveDailyReportMetrics(entries);
      }

      navigate('/daily-reports');
    } catch (err: any) {
      console.error('Error saving daily report:', err);
      setError(err.message || 'Lỗi khi lưu báo cáo hằng ngày.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mb-3" />
        <p className="text-sm font-medium">Đang tải biểu mẫu báo cáo hằng ngày...</p>
      </div>
    );
  }

  if (userRole !== 'staff') {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-xs">
        <div className="mb-4 inline-flex items-center justify-center rounded-full bg-red-100 p-3 text-red-600">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-red-800">Không có quyền truy cập</h3>
        <p className="text-red-600 mb-6">{error || 'Chỉ có nhân sự (Staff) mới có quyền nhập báo cáo hằng ngày.'}</p>
        <button onClick={() => navigate('/')} className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 font-medium">
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/daily-reports')} 
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Sửa báo cáo hằng ngày' : 'Tạo báo cáo hằng ngày'}</h1>
            {userUnitName && (
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                <span>Đơn vị: <strong className="text-slate-700">{userUnitName}</strong> {userUnitCode ? `(${userUnitCode})` : ''}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: General Info & Work Details */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Thông tin chung</h2>
            
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Ngày báo cáo</label>
                <input 
                  type="date" 
                  value={reportDate} 
                  onChange={e => setReportDate(e.target.value)} 
                  disabled={isEdit} 
                  className="w-full rounded-lg border-slate-300 p-2.5 border text-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500" 
                />
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Trạng thái làm việc</label>
                <select 
                  value={workStatus} 
                  onChange={e => setWorkStatus(e.target.value)} 
                  className="w-full rounded-lg border-slate-300 p-2.5 border text-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Kênh / Nguồn báo cáo</label>
                {reportSources.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Đơn vị của bạn chưa được gán Kênh/Nguồn báo cáo nào đang kích hoạt. Vui lòng liên hệ Quản trị viên để cấu hình.</span>
                  </div>
                ) : (
                  <>
                    <select 
                      value={reportSourceId || (sourceChannel === 'Khác' ? 'Khác' : (isEdit ? sourceChannel : ''))} 
                      onChange={e => handleSourceChange(e.target.value)} 
                      disabled={isEdit} 
                      className="w-full rounded-lg border-slate-300 p-2.5 border text-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                    >
                      {reportSources.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                      {isEdit && sourceChannel && !reportSources.find(s => s.id === reportSourceId || s.name === sourceChannel) && (
                        <option value={sourceChannel}>{sourceChannel} (Cũ)</option>
                      )}
                      {!isEdit && <option value="Khác">Khác...</option>}
                    </select>

                    {isEdit && (
                      <p className="mt-1.5 text-xs text-amber-700 font-medium flex items-center gap-1.5">
                        <span>🔒 Kênh/Nguồn không thể thay đổi sau khi lưu báo cáo.</span>
                      </p>
                    )}
                  </>
                )}

                {!isEdit && sourceChannel === 'Khác' && (
                  <input 
                    type="text" 
                    placeholder="Nhập tên nguồn báo cáo khác" 
                    value={customChannel} 
                    onChange={e => setCustomChannel(e.target.value)} 
                    disabled={isEdit} 
                    className="mt-2 w-full rounded-lg border-slate-300 p-2.5 border text-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100" 
                  />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Chi tiết công việc</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Công việc liên quan (Tùy chọn)</label>
                <select 
                  value={relatedTaskId} 
                  onChange={e => setRelatedTaskId(e.target.value)} 
                  className="w-full rounded-lg border-slate-300 p-2.5 border text-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">-- Không chọn --</option>
                  {myTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tóm tắt công việc (nếu có)</label>
                <textarea 
                  value={workSummary} 
                  onChange={e => setWorkSummary(e.target.value)} 
                  rows={3} 
                  placeholder="Ghi chú nội dung trọng tâm trong ngày..."
                  className="w-full rounded-lg border-slate-300 p-2.5 border text-sm focus:border-indigo-500 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Khó khăn / Vấn đề</label>
                <textarea 
                  value={issues} 
                  onChange={e => setIssues(e.target.value)} 
                  rows={2} 
                  placeholder="Nêu vướng mắc nếu gặp phải..."
                  className="w-full rounded-lg border-slate-300 p-2.5 border text-sm focus:border-indigo-500 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Đề xuất hỗ trợ</label>
                <textarea 
                  value={supportRequest} 
                  onChange={e => setSupportRequest(e.target.value)} 
                  rows={2} 
                  placeholder="Đề xuất với Trưởng nhóm / Quản lý..."
                  className="w-full rounded-lg border-slate-300 p-2.5 border text-sm focus:border-indigo-500 focus:ring-indigo-500" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Manual Metrics & Dynamic Calculated Ratios */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Chỉ số Hoạt động (Nhập liệu)</h2>
              {isLoadingMetrics ? (
                <div className="flex items-center gap-1.5 text-xs text-indigo-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang tải chỉ số...</span>
                </div>
              ) : manualMetrics.length > 0 ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {manualMetrics.length} chỉ số
                </span>
              ) : null}
            </div>

            {isLoadingMetrics ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                <span>Đang tải bộ chỉ số cho nguồn này...</span>
              </div>
            ) : manualMetrics.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">Chưa có chỉ số nhập liệu thủ công nào được kích hoạt cho Kênh/Nguồn này.</p>
                <p className="mt-1 text-xs text-amber-700">Vui lòng liên hệ Quản trị viên để cấu hình phân quyền chỉ số.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {manualMetrics.map(def => (
                  <div key={def.id} className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <label className="text-sm font-medium text-slate-700 block truncate" title={`${def.name} (${def.code})`}>
                        {def.name}
                      </label>
                      <span className="text-[11px] text-slate-400 font-mono">{def.code}</span>
                    </div>
                    <div className="w-32 flex items-center justify-end gap-1.5">
                      <input 
                        type="number" 
                        value={valuesMap[def.id] !== undefined ? valuesMap[def.id] : ''} 
                        onChange={e => handleMetricChange(def.id, e.target.value)}
                        placeholder="0"
                        className="w-full rounded-lg border-slate-300 p-2 border text-right text-sm font-medium text-slate-800 focus:border-indigo-500 focus:ring-indigo-500"
                        min="0"
                        step="any"
                      />
                      {def.unit && (
                        <span className="text-xs text-slate-500 shrink-0 w-8 text-left">{def.unit}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Calculated Ratios Card */}
          {dynamicRatios.length > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-6 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-indigo-600" />
                <h2 className="text-sm font-semibold text-indigo-950 uppercase tracking-wider">
                  Tỷ lệ tự động tính ({dynamicRatios.length})
                </h2>
              </div>
              <div className="space-y-2.5">
                {dynamicRatios.map((ratio) => (
                  <div key={ratio.id} className="flex items-center justify-between text-sm py-1.5 border-b border-indigo-100/60 last:border-0">
                    <div>
                      <span className="text-slate-700 font-medium block">{ratio.name}</span>
                      {ratio.numeratorName && ratio.denominatorName && (
                        <span className="text-[11px] text-slate-400">
                          {ratio.numeratorName} / {ratio.denominatorName}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-indigo-900 font-mono text-base">{ratio.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-slate-400 italic">
                * Tỷ lệ được tự động tính toán thời gian thực theo cấu hình chỉ số của Kênh/Nguồn.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving || (manualMetrics.length === 0 && reportSources.length === 0)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Đang lưu báo cáo...' : 'Lưu báo cáo'}
        </button>
      </div>
    </div>
  );
};

