import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Save,
  Shield,
  Eye,
  Info,
  ExternalLink,
  Layers,
  Calendar,
  Database,
  CheckSquare,
  Square,
  History,
  Lock
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useAuthorization } from '../../../context/AuthorizationContext';
import { getSupabaseClient } from '../../../lib/supabase';
import { SpreadsheetPreviewResult, ParsedSheetData } from '../../../services/googleSheetsParser';

export const GoogleSheetsSyncView: React.FC = () => {
  const { can, isLoading: isAuthLoading, error: authError } = useAuthorization();
  const [config, setConfig] = useState({
    name: 'Theo dõi hồ sơ tuyển sinh 2026',
    spreadsheet_id: '',
    owner_unit: 'Phòng Tuyển sinh',
    source_year: 2026,
    is_active: true,
    service_account_email: '',
    private_key: ''
  });

  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<SpreadsheetPreviewResult | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<ParsedSheetData | null>(null);
  const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string>('all');

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (config.spreadsheet_id) {
      fetchSyncHistory();
    }
  }, [config.spreadsheet_id]);

  const getAuthHeaders = async () => {
    let token = '';
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          token = session.access_token;
        }
      }
    } catch (err) {
      // ignore
    }

    if (!token) {
      try {
        for (const key of ['supabase.auth.token', 'sb-access-token', 'sb-token']) {
          const val = localStorage.getItem(key);
          if (val) {
            try {
              const parsed = JSON.parse(val);
              if (parsed?.access_token) {
                token = parsed.access_token;
                break;
              } else if (typeof parsed === 'string') {
                token = parsed;
                break;
              }
            } catch {
              token = val;
              break;
            }
          }
        }
      } catch (err) {
        // ignore
      }
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admissions/google-sheets/config', {
        headers
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setConfig({
            name: data.name || 'Theo dõi hồ sơ tuyển sinh 2026',
            spreadsheet_id: data.spreadsheet_id || '',
            owner_unit: data.owner_unit || 'Phòng Tuyển sinh',
            source_year: data.source_year || 2026,
            is_active: data.is_active !== false,
            service_account_email: data.service_account_email || '',
            private_key: data.private_key || ''
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to load config:', err);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const fetchSyncHistory = async () => {
    if (!config.spreadsheet_id) return;
    setIsLoadingHistory(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admissions/google-sheets/sync-history?source_id=${config.spreadsheet_id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSyncHistory(data || []);
      }
    } catch (err) {
      console.error('Failed to load sync history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admissions/google-sheets/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(config)
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Không thể lưu cấu hình');
      }
      const updated = await res.json();
      setConfig({
        name: updated.name,
        spreadsheet_id: updated.spreadsheet_id,
        owner_unit: updated.owner_unit,
        source_year: updated.source_year,
        is_active: updated.is_active,
        service_account_email: updated.service_account_email || config.service_account_email,
        private_key: updated.private_key || config.private_key
      });
      setSuccessMessage('Đã lưu cấu hình Google Sheets thành công.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setTestResult(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admissions/google-sheets/test-connection', {
        method: 'POST',
        headers,
        body: JSON.stringify(config)
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Kiểm tra kết nối thất bại');
      }
      const data = await res.json();
      setTestResult(data);
      setSuccessMessage('Kết nối Google Sheets thành công!');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsTestingConn(false);
    }
  };

  const handlePreviewSpreadsheet = async () => {
    setIsPreviewing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admissions/google-sheets/preview', {
        method: 'POST',
        headers,
        body: JSON.stringify(config)
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Không thể tải dữ liệu xem trước');
      }
      const data = await res.json();
      setPreviewData(data);
      setSelectedSheetNames([]);
      setSuccessMessage('Đã đọc và phân tích dữ liệu Google Sheets thành công.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const getSheetEligibility = (s: ParsedSheetData): { eligible: boolean; reason?: string } => {
    if (s.groupCode === 'SUMMARY_TOTAL') return { eligible: false, reason: 'Sheet TỔNG đối chiếu không đồng bộ trực tiếp' };
    if (s.groupCode === 'IGNORED') return { eligible: false, reason: 'Sheet bị bỏ qua theo cấu hình' };
    if (s.errors.length > 0) return { eligible: false, reason: 'Sheet chứa lỗi dữ liệu (sai số, trùng lặp)' };
    if (s.groupCode !== 'TRUNG_CAP' && s.groupCode !== 'NGAN_HAN') return { eligible: false, reason: 'Không thuộc nhóm Trung cấp hoặc Ngắn hạn' };
    return { eligible: true };
  };

  const handleToggleSelectSheet = (sheetName: string) => {
    const s = previewData?.sheets.find(sh => sh.sheetName === sheetName);
    if (!s) return;
    const { eligible } = getSheetEligibility(s);
    if (!eligible) return;

    if (selectedSheetNames.includes(sheetName)) {
      setSelectedSheetNames(selectedSheetNames.filter(n => n !== sheetName));
    } else {
      setSelectedSheetNames([...selectedSheetNames, sheetName]);
    }
  };

  const handleSelectAllEligible = () => {
    if (!previewData) return;
    const eligibleNames = previewData.sheets
      .filter(s => getSheetEligibility(s).eligible)
      .map(s => s.sheetName);
    setSelectedSheetNames(eligibleNames);
  };

  const handleDeselectAll = () => {
    setSelectedSheetNames([]);
  };

  const handleExecuteSync = async () => {
    if (selectedSheetNames.length === 0) return;
    setIsSyncing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const headers = await getAuthHeaders();
      const idempotencyKey = 'sync-' + config.spreadsheet_id + '-' + Date.now();
      const res = await fetch('/api/admissions/google-sheets/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          spreadsheet_id: config.spreadsheet_id,
          selected_sheets: selectedSheetNames,
          idempotency_key: idempotencyKey,
          service_account_email: config.service_account_email,
          private_key: config.private_key
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Đồng bộ thất bại');
      }

      const data = await res.json();
      setSuccessMessage(`Đồng bộ thành công! Đã tạo ${data.batch?.created_result_count || 0} đợt, cập nhật ${data.batch?.updated_result_count || 0} đợt.`);
      setIsSyncModalOpen(false);
      setSelectedSheetNames([]);
      fetchSyncHistory();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter sheets in preview
  const filteredSheets = previewData?.sheets.filter(s => {
    if (filterGroup === 'TRUNG_CAP') return s.groupCode === 'TRUNG_CAP';
    if (filterGroup === 'NGAN_HAN') return s.groupCode === 'NGAN_HAN';
    return true;
  }) || [];

  const selectedSheetsData = previewData?.sheets.filter(s => selectedSheetNames.includes(s.sheetName)) || [];
  const selectedTotalReg = selectedSheetsData.reduce((acc, s) => acc + s.detailRegistered, 0);
  const selectedTotalPaid = selectedSheetsData.reduce((acc, s) => acc + s.detailPaid, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Quản lý kết nối & Đồng bộ Google Sheets</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cấu hình nguồn dữ liệu tuyển sinh từ Google Sheets, xem trước, ánh xạ và xác nhận đồng bộ trực tiếp vào hệ thống.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!can('admissions.sync.execute') && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 border border-amber-200">
              <Lock className="h-3.5 w-3.5" /> Bạn không có quyền xác nhận đồng bộ
            </span>
          )}
          <button
            type="button"
            onClick={fetchSyncHistory}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <History className="h-4 w-4 text-slate-500" />
            <span>Lịch sử đồng bộ ({syncHistory.length})</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <XCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-rose-700 hover:text-rose-900">✕</button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Config Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">1. Cấu hình Spreadsheet ID</h3>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên cấu hình</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={e => setConfig({ ...config, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Spreadsheet ID</label>
                <input
                  type="text"
                  value={config.spreadsheet_id}
                  onChange={e => setConfig({ ...config, spreadsheet_id: e.target.value })}
                  placeholder="Ví dụ: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">Lấy từ URL của Google Sheets.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Năm nguồn</label>
                <input
                  type="number"
                  value={config.source_year}
                  onChange={e => setConfig({ ...config, source_year: parseInt(e.target.value) || 2026 })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Account Email (Tùy chọn)</label>
                <input
                  type="email"
                  value={config.service_account_email}
                  onChange={e => setConfig({ ...config, service_account_email: e.target.value })}
                  placeholder="client@project.iam.gserviceaccount.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Private Key (Tùy chọn)</label>
                <textarea
                  rows={3}
                  value={config.private_key}
                  onChange={e => setConfig({ ...config, private_key: e.target.value })}
                  placeholder="-----BEGIN PRIVATE KEY-----\n..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSavingConfig ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
                </button>
              </div>
            </form>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConn || !config.spreadsheet_id}
                className="w-full rounded-xl bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Shield className="h-4 w-4" />
                <span>{isTestingConn ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
              </button>

              <button
                type="button"
                onClick={handlePreviewSpreadsheet}
                disabled={!can('admissions.sync.view') || isPreviewing || !config.spreadsheet_id}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                <Eye className="h-4 w-4" />
                <span>{isPreviewing ? 'Đang đọc dữ liệu...' : 'Đọc dữ liệu & Xem trước'}</span>
              </button>
            </div>
          </div>

          {/* Test Connection Result */}
          {testResult && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-xs space-y-2">
              <div className="font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Kết nối Google Sheets thành công</span>
              </div>
              <div className="text-emerald-800 space-y-1">
                <div><strong>Tiêu đề:</strong> {testResult.spreadsheetTitle}</div>
                <div><strong>Tổng số sheet:</strong> {testResult.sheetCount}</div>
                <div><strong>ID:</strong> <span className="font-mono text-[11px]">{testResult.spreadsheetId}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Preview & Sheet Selection */}
        <div className="lg:col-span-2 space-y-6">
          {!previewData ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
              <FileSpreadsheet className="h-10 w-10 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">Chưa có dữ liệu xem trước</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Nhập Spreadsheet ID ở cột bên trái và bấm <strong>"Đọc dữ liệu & Xem trước"</strong> để hiển thị danh sách các sheet và bắt đầu quá trình đồng bộ.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-base font-bold text-slate-900">3. Bản xem trước & Chọn sheet đồng bộ</h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Hash: {previewData.sourceHash.substring(0, 12)}...
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1">
                    <span className="text-slate-500 font-medium">Đợt nhận diện</span>
                    <div className="text-xl font-bold text-indigo-600">{previewData.summary.recognizedCampaignSheets}</div>
                    <div className="text-[11px] text-slate-400">Trung cấp: {previewData.summary.tcSheets} | Ngắn hạn: {previewData.summary.nhSheets}</div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1">
                    <span className="text-slate-500 font-medium">Tổng đăng ký</span>
                    <div className="text-xl font-bold text-slate-900">{previewData.summary.totalRegistered.toLocaleString('vi-VN')}</div>
                    <div className="text-[11px] text-slate-400">Học viên đăng ký</div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1">
                    <span className="text-slate-500 font-medium">Đã đóng học phí</span>
                    <div className="text-xl font-bold text-emerald-600">{previewData.summary.totalPaid.toLocaleString('vi-VN')}</div>
                    <div className="text-[11px] text-slate-400">Hoàn thành học phí</div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1">
                    <span className="text-slate-500 font-medium">Cảnh báo / Lỗi</span>
                    <div className="text-xl font-bold text-amber-600">
                      {previewData.summary.warningRows} <span className="text-xs font-normal text-slate-400">cảnh báo</span>
                    </div>
                    <div className="text-[11px] text-rose-500 font-semibold">{previewData.summary.errorRows} lỗi</div>
                  </div>
                </div>

                {/* Selection Action Toolbar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700">Đã chọn: <strong className="text-indigo-600">{selectedSheetNames.length}</strong> sheet</span>
                    <button
                      type="button"
                      onClick={handleSelectAllEligible}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                    >
                      Chọn tất cả hợp lệ
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={filterGroup}
                      onChange={e => setFilterGroup(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
                    >
                      <option value="all">Tất cả nhóm</option>
                      <option value="TRUNG_CAP">Trung cấp</option>
                      <option value="NGAN_HAN">Ngắn hạn</option>
                    </select>

                    {can('admissions.sync.execute') && (
                      <button
                        type="button"
                        disabled={selectedSheetNames.length === 0}
                        onClick={() => setIsSyncModalOpen(true)}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Database className="h-4 w-4" />
                        <span>Xác nhận đồng bộ ({selectedSheetNames.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sheets Table with Checkboxes */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-10 text-center">Chọn</th>
                        <th className="p-3">Sheet</th>
                        <th className="p-3">Nhóm</th>
                        <th className="p-3">Ngày đề xuất</th>
                        <th className="p-3">Chế độ</th>
                        <th className="p-3 text-right">Đăng ký</th>
                        <th className="p-3 text-right">Đóng HP</th>
                        <th className="p-3 text-center">Trạng thái / Lý do</th>
                        <th className="p-3 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSheets.map((s, idx) => {
                        const { eligible, reason } = getSheetEligibility(s);
                        const isSelected = selectedSheetNames.includes(s.sheetName);

                        return (
                          <tr key={idx} className={`hover:bg-slate-50/60 ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                disabled={!eligible}
                                onClick={() => handleToggleSelectSheet(s.sheetName)}
                                className={`rounded p-1 transition-colors ${!eligible ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer text-indigo-600 hover:text-indigo-800'}`}
                                title={reason || 'Có thể chọn'}
                              >
                                {isSelected ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4 text-slate-400" />}
                              </button>
                            </td>
                            <td className="p-3 font-semibold text-slate-900">{s.sheetName}</td>
                            <td className="p-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                s.groupCode === 'TRUNG_CAP' ? 'bg-indigo-100 text-indigo-800' :
                                s.groupCode === 'NGAN_HAN' ? 'bg-purple-100 text-purple-800' :
                                s.groupCode === 'SUMMARY_TOTAL' ? 'bg-emerald-100 text-emerald-800' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {s.groupCode}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">{s.proposedCampaignDate || '—'}</td>
                            <td className="p-3 font-mono text-[11px] text-slate-600">{s.entryModeSuggestion}</td>
                            <td className="p-3 text-right font-bold text-slate-900">{s.detailRegistered}</td>
                            <td className="p-3 text-right font-bold text-emerald-700">{s.detailPaid}</td>
                            <td className="p-3 text-center">
                              {eligible ? (
                                <span className="text-emerald-600 font-semibold">Hợp lệ</span>
                              ) : (
                                <span className="text-rose-600 text-[11px]" title={reason}>
                                  {reason}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {s.groupCode !== 'IGNORED' && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSheet(s)}
                                  className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                                >
                                  Xem chi tiết
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sync History Section */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-base font-bold text-slate-900">Lịch sử đồng bộ gần đây</h3>
                  </div>
                  <button
                    type="button"
                    onClick={fetchSyncHistory}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Làm mới
                  </button>
                </div>

                {syncHistory.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">Chưa có lịch sử đồng bộ nào được ghi nhận.</div>
                ) : (
                  <div className="space-y-3">
                    {syncHistory.map((batch: any) => (
                      <div key={batch.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              batch.status === 'succeeded' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {batch.status === 'succeeded' ? 'Thành công' : 'Thất bại'}
                            </span>
                            <span className="font-mono text-slate-500 text-[11px]">{new Date(batch.created_at).toLocaleString('vi-VN')}</span>
                          </div>
                          <div className="text-slate-600">
                            Đã chọn: <strong>{batch.selected_sheet_count}</strong> sheet | Đăng ký: <strong>{batch.total_registered}</strong> | Đóng HP: <strong>{batch.total_paid}</strong>
                          </div>
                        </div>
                        {batch.error_summary && (
                          <div className="text-rose-600 bg-rose-50 p-2 rounded-lg text-[11px]">
                            Lỗi: {batch.error_summary}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-600" />
                <h4 className="text-base font-bold text-slate-900">Xác nhận đồng bộ vào hệ thống</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-indigo-900 space-y-1">
                <div><strong>Nguồn Spreadsheet:</strong> {config.name} ({config.spreadsheet_id})</div>
                <div><strong>Số sheet đã chọn:</strong> {selectedSheetNames.length} sheet</div>
                <div><strong>Tổng đăng ký:</strong> {selectedTotalReg.toLocaleString('vi-VN')} | <strong>Đã đóng HP:</strong> {selectedTotalPaid.toLocaleString('vi-VN')}</div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-700">Danh sách sheet được chọn:</span>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {selectedSheetsData.map((s, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between bg-white text-xs">
                      <span className="font-semibold text-slate-900">{s.sheetName}</span>
                      <div className="text-slate-500 space-x-3">
                        <span>Nhóm: {s.groupCode}</span>
                        <span>ĐK: <strong>{s.detailRegistered}</strong></span>
                        <span>HP: <strong className="text-emerald-700">{s.detailPaid}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 space-y-1 text-[11px]">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Lưu ý quan trọng:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                  <li>Dữ liệu sẽ được ghi vào hệ thống ở trạng thái <strong>bản nháp</strong>.</li>
                  <li>Hệ thống sẽ đọc lại Google Sheets và kiểm tra dữ liệu từng sheet trước khi ghi.</li>
                  <li>Nếu một sheet xảy ra lỗi, toàn bộ giao dịch sẽ được hoàn tác an toàn.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleExecuteSync}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ các sheet đã chọn'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet Detail Modal */}
      {selectedSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                <h4 className="text-base font-bold text-slate-900">Chi tiết Sheet: {selectedSheet.sheetName}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSheet(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div><strong>Nhóm:</strong> {selectedSheet.groupCode}</div>
              <div><strong>Ngày đề xuất:</strong> {selectedSheet.proposedCampaignDate || 'N/A'}</div>
              <div><strong>Đăng ký chi tiết:</strong> {selectedSheet.detailRegistered}</div>
              <div><strong>Đã đóng HP:</strong> {selectedSheet.detailPaid}</div>
            </div>

            {/* Warnings or Errors */}
            {(selectedSheet.warnings.length > 0 || selectedSheet.errors.length > 0) && (
              <div className="space-y-1 text-xs bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Cảnh báo & Lỗi kỹ thuật ({selectedSheet.warnings.length + selectedSheet.errors.length})</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                  {selectedSheet.warnings.map((w, idx) => <li key={`w-${idx}`}>{w}</li>)}
                  {selectedSheet.errors.map((e, idx) => <li key={`e-${idx}`} className="text-rose-600">{e}</li>)}
                </ul>
              </div>
            )}

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-12">STT</th>
                    <th className="p-2.5">Tên lớp / ngành</th>
                    <th className="p-2.5 text-right">Đăng ký</th>
                    <th className="p-2.5 text-right">Đóng HP</th>
                    <th className="p-2.5">Ghi chú</th>
                    <th className="p-2.5 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedSheet.rows.map((r, idx) => (
                    <tr key={idx} className={r.status === 'error' ? 'bg-rose-50/60' : r.status === 'warning' ? 'bg-amber-50/40' : ''}>
                      <td className="p-2.5 text-slate-500 font-mono">{r.stt || r.rowIndex}</td>
                      <td className="p-2.5 font-medium text-slate-900">{r.className}</td>
                      <td className="p-2.5 text-right font-bold">{r.registeredCount ?? '—'}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">{r.paidCount ?? '—'}</td>
                      <td className="p-2.5 text-slate-500">{r.notes || '—'}</td>
                      <td className="p-2.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'valid' ? 'bg-emerald-100 text-emerald-800' :
                          r.status === 'warning' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedSheet(null)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
