import React, { useState, useEffect } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  User, 
  Building2, 
  Calendar, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Users 
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { kpiService } from '../../../services/kpi.service';
import { 
  kpiAssignmentService, 
  RecipientUser, 
  RecipientUnit 
} from '../../../services/kpi-assignment.service';
import { 
  KpiPeriod, 
  KpiTemplate, 
  KpiTemplateVersion, 
  KpiAssigneeType 
} from '../../../types/kpi';

interface KpiAssignmentWizardModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface PublishedVersionWithTemplate extends KpiTemplateVersion {
  template: KpiTemplate;
}

interface AssignmentResultItem {
  name: string;
  success: boolean;
  message?: string;
}

export const KpiAssignmentWizardModal: React.FC<KpiAssignmentWizardModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const { user, isAdmin, systemRole } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Available options
  const [periods, setPeriods] = useState<KpiPeriod[]>([]);
  const [publishedVersions, setPublishedVersions] = useState<PublishedVersionWithTemplate[]>([]);
  const [recipientUnits, setRecipientUnits] = useState<RecipientUnit[]>([]);
  const [recipientStaff, setRecipientStaff] = useState<RecipientUser[]>([]);

  // Wizard state selections
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [assigneeType, setAssigneeType] = useState<KpiAssigneeType>('individual');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  const [effectiveFrom, setEffectiveFrom] = useState<string>('');
  const [effectiveTo, setEffectiveTo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Search filters within steps
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [templateSearch, setTemplateSearch] = useState<string>('');

  // Processing state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionResults, setSubmissionResults] = useState<AssignmentResultItem[] | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load periods
      const { data: periodList, error: pErr } = await kpiService.getPeriods(undefined);
      if (pErr) throw pErr;
      const validPeriods = periodList || [];
      setPeriods(validPeriods);
      if (validPeriods.length > 0) {
        setSelectedPeriodId(validPeriods[0].id);
        if (validPeriods[0].start_date) setEffectiveFrom(validPeriods[0].start_date);
        if (validPeriods[0].end_date) setEffectiveTo(validPeriods[0].end_date);
      }

      // 2. Load published template versions
      const { data: templates, error: tErr } = await kpiService.getTemplates(undefined);
      if (tErr) throw tErr;

      const pubVersions: PublishedVersionWithTemplate[] = [];
      for (const tpl of templates || []) {
        const { data: versions } = await kpiService.getTemplateVersions(tpl.id);
        (versions || []).forEach(v => {
          if (v.status === 'published') {
            pubVersions.push({ ...v, template: tpl });
          }
        });
      }
      setPublishedVersions(pubVersions);

      // 3. Load recipients within current user scope
      if (user) {
        const { primaryUnitId, scopedUnitIds, units, staff, error: rErr } = await kpiAssignmentService.getScopeRecipients(
          isAdmin,
          user.id,
          systemRole || 'staff'
        );
        if (rErr) throw rErr;
        setRecipientUnits(units);
        setRecipientStaff(staff);

        // [KPI B1] Debug logs required by B1 verification
        console.log('[KPI B1] currentUserId:', user.id);
        console.log('[KPI B1] systemRole:', systemRole);
        console.log('[KPI B1] primaryUnitId:', primaryUnitId);
        console.log('[KPI B1] scopedUnitIds:', scopedUnitIds);
        console.log('[KPI B1] candidateStaff:', staff);
      }
    } catch (err: any) {
      console.error('[KpiAssignmentWizard] Load error:', err);
      setError(err.message || 'Không thể tải dữ liệu khởi tạo');
    } finally {
      setLoading(false);
    }
  };

  // Sync effective dates when period changes
  const handlePeriodSelect = (periodId: string) => {
    setSelectedPeriodId(periodId);
    const p = periods.find(item => item.id === periodId);
    if (p) {
      if (p.start_date) setEffectiveFrom(p.start_date);
      if (p.end_date) setEffectiveTo(p.end_date);
    }
  };

  // Filter templates strictly matching selected assigneeType and published
  const filteredVersions = publishedVersions.filter(pv => {
    const matchesScope = pv.template?.scope_type === assigneeType;
    if (!matchesScope) return false;
    if (!templateSearch || !templateSearch.trim()) return true;
    const s = templateSearch.toLowerCase();
    return (
      ((pv.template?.name || '').toLowerCase().includes(s)) ||
      ((pv.template?.code || '').toLowerCase().includes(s))
    );
  });

  // Filter staff by search keyword
  const filteredStaff = recipientStaff.filter(st => {
    if (!staffSearch || !staffSearch.trim()) return true;
    const s = staffSearch.toLowerCase();
    return (
      ((st.full_name || '').toLowerCase().includes(s)) ||
      (st.employee_code ? st.employee_code.toLowerCase().includes(s) : false) ||
      (st.email ? st.email.toLowerCase().includes(s) : false) ||
      (st.organization_unit_name ? st.organization_unit_name.toLowerCase().includes(s) : false)
    );
  });

  // Multi-select staff toggle
  const toggleStaffSelection = (id: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllStaff = () => {
    if (selectedStaffIds.length === filteredStaff.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(filteredStaff.map(s => s.id));
    }
  };

  // Validation before advancing step
  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!selectedPeriodId) return setError('Vui lòng chọn kỳ đánh giá');
      setStep(2);
    } else if (step === 2) {
      // If assignee type changes, clear selected version to avoid cross-scope mismatch
      setSelectedVersionId('');
      setStep(3);
    } else if (step === 3) {
      if (!selectedVersionId) return setError('Vui lòng chọn một phiên bản mẫu KPI đã xuất bản');
      setStep(4);
    } else if (step === 4) {
      if (assigneeType === 'individual' && selectedStaffIds.length === 0) {
        return setError('Vui lòng chọn ít nhất một nhân sự để giao KPI');
      }
      if (assigneeType === 'organization' && !selectedUnitId) {
        return setError('Vui lòng chọn đơn vị nhận KPI');
      }
      setStep(5);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) setStep(step - 1);
  };

  // Submit flow
  const handleExecuteAssignment = async () => {
    setIsSubmitting(true);
    setError(null);
    const results: AssignmentResultItem[] = [];

    try {
      if (assigneeType === 'individual') {
        for (const staffId of selectedStaffIds) {
          const staffObj = recipientStaff.find(s => s.id === staffId);
          const staffName = staffObj?.full_name || staffId;

          const { error: assignError } = await kpiAssignmentService.createAssignmentFromTemplate({
            periodId: selectedPeriodId,
            templateVersionId: selectedVersionId,
            assigneeType: 'individual',
            assigneeUserId: staffId,
            effectiveFrom: effectiveFrom || null,
            effectiveTo: effectiveTo || null,
            notes: notes.trim() || null,
          });

          if (assignError) {
            results.push({
              name: staffName,
              success: false,
              message: assignError.message || 'Lỗi tạo KPI',
            });
          } else {
            results.push({
              name: staffName,
              success: true,
              message: 'Tạo bản nháp thành công',
            });
          }
        }
      } else {
        // Organization assignment
        const unitObj = recipientUnits.find(u => u.id === selectedUnitId);
        const unitName = unitObj?.name || selectedUnitId;

        const { error: assignError } = await kpiAssignmentService.createAssignmentFromTemplate({
          periodId: selectedPeriodId,
          templateVersionId: selectedVersionId,
          assigneeType: 'organization',
          assigneeOrgUnitId: selectedUnitId,
          effectiveFrom: effectiveFrom || null,
          effectiveTo: effectiveTo || null,
          notes: notes.trim() || null,
        });

        if (assignError) {
          results.push({
            name: unitName,
            success: false,
            message: assignError.message || 'Lỗi tạo KPI cho đơn vị',
          });
        } else {
          results.push({
            name: unitName,
            success: true,
            message: 'Tạo bản nháp thành công',
          });
        }
      }

      setSubmissionResults(results);
    } catch (err: any) {
      console.error('Execute assignment failure:', err);
      setError(err.message || 'Có lỗi xảy ra khi thực hiện giao KPI');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedVersionObj = publishedVersions.find(v => v.id === selectedVersionId);
  const selectedPeriodObj = periods.find(p => p.id === selectedPeriodId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Giao KPI (Assignment Wizard)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bước {step} / 5: {
                step === 1 ? 'Chọn kỳ đánh giá' :
                step === 2 ? 'Chọn loại đối tượng nhận KPI' :
                step === 3 ? 'Chọn Mẫu KPI đã xuất bản' :
                step === 4 ? 'Chọn người nhận / đơn vị' :
                'Xác nhận thông tin & tạo bản nháp'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator Progress */}
        <div className="grid grid-cols-5 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-center text-slate-500">
          <div className={`py-2.5 px-1 border-r border-slate-100 ${step === 1 ? 'text-indigo-600 bg-indigo-50/50 font-bold' : step > 1 ? 'text-emerald-600' : ''}`}>
            1. Kỳ KPI
          </div>
          <div className={`py-2.5 px-1 border-r border-slate-100 ${step === 2 ? 'text-indigo-600 bg-indigo-50/50 font-bold' : step > 2 ? 'text-emerald-600' : ''}`}>
            2. Loại đối tượng
          </div>
          <div className={`py-2.5 px-1 border-r border-slate-100 ${step === 3 ? 'text-indigo-600 bg-indigo-50/50 font-bold' : step > 3 ? 'text-emerald-600' : ''}`}>
            3. Mẫu KPI
          </div>
          <div className={`py-2.5 px-1 border-r border-slate-100 ${step === 4 ? 'text-indigo-600 bg-indigo-50/50 font-bold' : step > 4 ? 'text-emerald-600' : ''}`}>
            4. Đối tượng
          </div>
          <div className={`py-2.5 px-1 ${step === 5 ? 'text-indigo-600 bg-indigo-50/50 font-bold' : ''}`}>
            5. Xác nhận
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3.5 text-red-800 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span className="text-sm">Đang nạp dữ liệu kỳ đánh giá và mẫu KPI...</span>
            </div>
          ) : submissionResults ? (
            /* Results Summary Screen */
            <div className="space-y-4 py-2">
              <div className="text-center py-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mb-2">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Kết quả thực hiện giao KPI</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Chi tiết kết quả tạo bản ghi KPI cho từng đối tượng
                </p>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                {submissionResults.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      {r.success ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                      )}
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{r.name}</div>
                        <div className={`text-xs ${r.success ? 'text-slate-500' : 'text-rose-600'}`}>
                          {r.message}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      r.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {r.success ? 'Thành công' : 'Không thành công'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: CHOOSE PERIOD */}
              {step === 1 && (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-800">
                    Chọn kỳ đánh giá KPI <span className="text-red-500">*</span>
                  </label>
                  {periods.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
                      Chưa có kỳ đánh giá nào. Vui lòng tạo Kỳ đánh giá trước.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {periods.map(period => {
                        const isSelected = selectedPeriodId === period.id;
                        return (
                          <div
                            key={period.id}
                            onClick={() => handlePeriodSelect(period.id)}
                            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                <Calendar className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-900">{period.name}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span className="font-mono">{period.code}</span>
                                  <span>•</span>
                                  <span>{period.start_date} → {period.end_date}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                period.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {period.status === 'active' ? 'Đang mở' : period.status}
                              </span>
                              {isSelected && <Check className="h-5 w-5 text-indigo-600" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: CHOOSE ASSIGNEE TYPE */}
              {step === 2 && (
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-800">
                    Chọn loại đối tượng nhận KPI <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-slate-500">
                    Hệ thống sẽ lọc các Mẫu KPI và danh sách nhận phù hợp với phạm vi này.
                  </p>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div
                      onClick={() => setAssigneeType('individual')}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        assigneeType === 'individual'
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="text-base font-bold text-slate-900">Cá nhân (Staff / Giảng viên)</div>
                      <p className="text-xs text-slate-600 mt-1">
                        Giao KPI cá nhân cho từng cán bộ, nhân viên hoặc giảng viên. Hỗ trợ chọn nhiều người để tạo các bộ KPI độc lập.
                      </p>
                    </div>

                    <div
                      onClick={() => setAssigneeType('organization')}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        assigneeType === 'organization'
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="text-base font-bold text-slate-900">Đơn vị (Khoa / Phòng ban)</div>
                      <p className="text-xs text-slate-600 mt-1">
                        Giao KPI chung cấp đơn vị trực thuộc để đo lường kết quả thực hiện của cả tập thể khoa/phòng.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: CHOOSE PUBLISHED TEMPLATE VERSION */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-800">
                      Chọn Mẫu KPI đã xuất bản ({assigneeType === 'individual' ? 'Cá nhân' : 'Đơn vị'}) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative w-48">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm mẫu KPI..."
                        value={templateSearch}
                        onChange={e => setTemplateSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {filteredVersions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
                      Không tìm thấy Mẫu KPI nào ở trạng thái <span className="font-semibold text-indigo-600">Đã xuất bản</span> thuộc phạm vi <span className="font-semibold text-indigo-600">{assigneeType === 'individual' ? 'Cá nhân' : 'Đơn vị'}</span>.
                      <p className="text-xs text-slate-400 mt-1">
                        Vui lòng vào mục "Mẫu KPI" để hoàn thiện và bấm Xuất bản trước khi giao.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {filteredVersions.map(pv => {
                        const isSelected = selectedVersionId === pv.id;
                        return (
                          <div
                            key={pv.id}
                            onClick={() => setSelectedVersionId(pv.id)}
                            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                <Layers className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-900">{pv.template.name}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span className="font-mono">{pv.template.code}</span>
                                  <span>•</span>
                                  <span className="font-semibold text-indigo-600">Phiên bản {pv.version_no}</span>
                                  <span>•</span>
                                  <span>Phạm vi: {pv.template.scope_type === 'individual' ? 'Cá nhân' : 'Đơn vị'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 text-xs rounded-full font-semibold bg-emerald-50 text-emerald-700">
                                Đã xuất bản
                              </span>
                              {isSelected && <Check className="h-5 w-5 text-indigo-600" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: CHOOSE RECIPIENTS */}
              {step === 4 && (
                <div className="space-y-3">
                  {assigneeType === 'individual' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-sm font-semibold text-slate-800">
                            Chọn nhân sự nhận KPI (Hỗ trợ chọn nhiều người) <span className="text-red-500">*</span>
                          </label>
                          <p className="text-xs text-slate-500">
                            Đã chọn: <span className="font-bold text-indigo-600">{selectedStaffIds.length}</span> nhân sự
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={selectAllStaff}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            {selectedStaffIds.length === filteredStaff.length && filteredStaff.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                          </button>
                          <div className="relative w-44">
                            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Tìm nhân sự..."
                              value={staffSearch}
                              onChange={e => setStaffSearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {filteredStaff.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
                          Không tìm thấy nhân sự nào thuộc phạm vi quản lý của bạn.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                          {filteredStaff.map(st => {
                            const isSelected = selectedStaffIds.includes(st.id);
                            return (
                              <div
                                key={st.id}
                                onClick={() => toggleStaffSelection(st.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}} // Controlled by container click
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <div>
                                    <div className="text-sm font-bold text-slate-900">{st.full_name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                      {st.employee_code && <span className="font-mono">{st.employee_code}</span>}
                                      {st.job_title && <span>{st.job_title}</span>}
                                      {st.organization_unit_name && (
                                        <>
                                          <span>•</span>
                                          <span className="text-indigo-600 font-medium">{st.organization_unit_name}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-xs text-slate-400 font-mono">{st.email}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Organization Recipient */
                    <>
                      <label className="block text-sm font-semibold text-slate-800">
                        Chọn đơn vị nhận KPI <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-slate-500 mb-2">
                        Chọn một đơn vị (khoa/phòng) trong phạm vi quản lý của bạn để giao bộ KPI này.
                      </p>

                      {recipientUnits.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
                          Không có đơn vị nào trong phạm vi quản lý của bạn.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                          {recipientUnits.map(unit => {
                            const isSelected = selectedUnitId === unit.id;
                            return (
                              <div
                                key={unit.id}
                                onClick={() => setSelectedUnitId(unit.id)}
                                className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    <Building2 className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold text-slate-900">{unit.name}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5">{unit.code}</div>
                                  </div>
                                </div>
                                {isSelected && <Check className="h-5 w-5 text-indigo-600" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* STEP 5: REVIEW & CONFIRMATION */}
              {step === 5 && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Tóm tắt cấu hình giao KPI
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500">Kỳ đánh giá:</span>
                        <div className="font-bold text-slate-900 text-sm mt-0.5">
                          {selectedPeriodObj?.name} ({selectedPeriodObj?.code})
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Mẫu KPI & Phiên bản:</span>
                        <div className="font-bold text-slate-900 text-sm mt-0.5">
                          {selectedVersionObj?.template.name} (v{selectedVersionObj?.version_no})
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Loại đối tượng:</span>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          {assigneeType === 'individual' ? 'Cá nhân (Staff)' : 'Đơn vị (Organization)'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Số lượng bộ KPI sẽ tạo:</span>
                        <div className="font-bold text-indigo-600 text-sm mt-0.5">
                          {assigneeType === 'individual' ? `${selectedStaffIds.length} bộ KPI riêng biệt` : '1 bộ KPI cho đơn vị'}
                        </div>
                      </div>
                    </div>

                    {assigneeType === 'individual' && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-xs text-slate-500">Danh sách nhân sự được giao:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-24 overflow-y-auto">
                          {selectedStaffIds.map(id => {
                            const st = recipientStaff.find(s => s.id === id);
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-xs text-slate-700 shadow-2xs"
                              >
                                {st?.full_name || id}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Effective Dates & Notes */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Hiệu lực từ ngày (Effective From)
                      </label>
                      <input
                        type="date"
                        value={effectiveFrom}
                        onChange={e => setEffectiveFrom(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Hiệu lực đến ngày (Effective To)
                      </label>
                      <input
                        type="date"
                        value={effectiveTo}
                        onChange={e => setEffectiveTo(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ghi chú bổ sung (Tùy chọn)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Nhập ghi chú cho đợt giao KPI này..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-100">
          {submissionResults ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={step === 1 ? onClose : handleBack}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                {step === 1 ? 'Hủy' : (
                  <>
                    <ChevronLeft className="h-4 w-4" />
                    Quay lại
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                {step < 5 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
                  >
                    Tiếp theo
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleExecuteAssignment}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        <span>Đang tạo bản nháp KPI...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Tạo bản nháp KPI</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
