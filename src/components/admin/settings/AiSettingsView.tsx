import { AiUsageAuditView } from './AiUsageAuditView';
import { AiPromptRegistryView } from './AiPromptRegistryView';
import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle2, Loader2, Bot, Shield, KeyRound, Network, RefreshCw, Check, Power, HelpCircle, Eye, EyeOff, Info } from 'lucide-react';
import { getSupabaseClient } from '../../../lib/supabase';

const getAccessToken = async (): Promise<string> => {
  const client = getSupabaseClient();
  if (!client) return '';
  const session = (await client.auth.getSession()).data.session;
  return session?.access_token || '';
};

const ALLOWED_MODELS: Record<string, string[]> = {
  gemini: [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo'
  ]
};

const ERROR_MESSAGES: Record<string, string> = {
  AI_SYSTEM_DISABLED: 'AI đang được tắt cho toàn hệ thống.',
  AI_KEY_NOT_CONFIGURED: 'Nhà cung cấp chưa có API key.',
  AI_KEY_DECRYPTION_FAILED: 'Không thể đọc API key đã lưu. Vui lòng nhập lại API key.',
  AI_MODEL_NOT_CONFIGURED: 'Vui lòng chọn hoặc nhập model.',
  AI_PROVIDER_RETEST_REQUIRED: 'Cấu hình đã thay đổi. Vui lòng kiểm tra kết nối lại.',
  AI_PROVIDER_UNAUTHORIZED: 'API key không hợp lệ hoặc đã bị thu hồi.',
  AI_PROVIDER_FORBIDDEN: 'Tài khoản không có quyền sử dụng API hoặc model này.',
  AI_MODEL_NOT_FOUND: 'Model không tồn tại hoặc tài khoản chưa được cấp quyền.',
  AI_RATE_LIMITED: 'Nhà cung cấp đang giới hạn tần suất (Rate Limit). Vui lòng thử lại sau.',
  AI_CREDIT_BALANCE_EXHAUSTED: 'Tài khoản OpenAI/Gemini đã hết số dư (Credit Balance Exhausted).',
  AI_ORG_SPEND_LIMIT_EXCEEDED: 'Tài khoản đã đạt giới hạn chi tiêu của tổ chức (Spend Limit Exceeded).',
  AI_PROJECT_SPEND_LIMIT_EXCEEDED: 'Project đã đạt giới hạn chi tiêu.',
  AI_PROVIDER_TIMEOUT: 'Kết nối đến nhà cung cấp quá thời gian (Timeout).',
  AI_PROVIDER_NETWORK_ERROR: 'Backend không thể kết nối đến nhà cung cấp AI.',
  AI_PROVIDER_UNAVAILABLE: 'Nhà cung cấp AI đang tạm thời không sẵn sàng.',
  API_INVALID_CONTENT_TYPE: 'API backend trả về dữ liệu không đúng định dạng JSON.',
  INGRESS_PROXY_HTML: 'Yêu cầu bị chặn hoặc chuyển hướng bởi cổng xác thực nền tảng (Cloud Run Ingress). Vui lòng tải lại trang hoặc đăng nhập lại.'
};

export const AiSettingsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'provider' | 'registry' | 'audit'>('provider');
  const [selectedProviderCode, setSelectedProviderCode] = useState<string>('gemini');
  
  const [providers, setProviders] = useState<any[]>([]);
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(true);
  const [togglingGlobal, setTogglingGlobal] = useState<boolean>(false);

  // Form states per provider code
  const [providerForms, setProviderForms] = useState<Record<string, { model: string; apiKey: string; isEnabled: boolean }>>({
    gemini: { model: 'gemini-3.8-flash', apiKey: '', isEnabled: true },
    openai: { model: 'gpt-4o-mini', apiKey: '', isEnabled: true }
  });

  const [isChangingKey, setIsChangingKey] = useState<Record<string, boolean>>({
    gemini: false,
    openai: false
  });

  const [showKey, setShowKey] = useState<Record<string, boolean>>({
    gemini: false,
    openai: false
  });

  // Action states
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activating, setActivating] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; code?: string; details?: any } | null>(null);

  // Confirmation Modal for Activation
  const [showActivateModal, setShowActivateModal] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Load Global Config
      const configRes = await fetch('/api/admin/ai-config', { headers });
      if (configRes.ok) {
        const configData = await configRes.json();
        setGlobalEnabled(configData.enabled ?? true);
      }

      // 2. Load Multi-Provider Summaries
      const provRes = await fetch('/api/admin/ai/providers', { headers });
      const ct = provRes.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error('[API_INVALID_CONTENT_TYPE] Backend returned non-JSON content-type');
      }
      if (!provRes.ok) throw new Error('Không thể tải danh sách nhà cung cấp AI');

      const provList = await provRes.json();
      setProviders(provList);

      // Populate providerForms initial state
      const newForms: Record<string, any> = {};
      const newChangingKey: Record<string, boolean> = {};
      
      provList.forEach((p: any) => {
        const hasKey = p.hasApiKey ?? p.hasConfiguredKey ?? false;
        newForms[p.providerCode] = {
          model: p.model || (p.providerCode === 'openai' ? 'gpt-4o-mini' : 'gemini-3.8-flash'),
          apiKey: '',
          isEnabled: p.isEnabled ?? true
        };
        newChangingKey[p.providerCode] = !hasKey;
      });

      setProviderForms(newForms);
      setIsChangingKey(newChangingKey);

      // Set active provider as default selected tab/card if none selected
      const activeProv = provList.find((p: any) => p.isActive);
      if (activeProv) {
        setSelectedProviderCode(activeProv.providerCode);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu cấu hình AI');
    } finally {
      setLoading(false);
    }
  };

  const currentProviderSummary = providers.find(p => p.providerCode === selectedProviderCode) || {};
  const currentForm = providerForms[selectedProviderCode] || { model: '', apiKey: '', isEnabled: true };

  const handleFormChange = (field: string, value: any) => {
    setProviderForms(prev => ({
      ...prev,
      [selectedProviderCode]: {
        ...prev[selectedProviderCode],
        [field]: value
      }
    }));
    setTestResult(null);
  };

  const handleToggleGlobalEnabled = async () => {
    setTogglingGlobal(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      const nextEnabled = !globalEnabled;

      // Update global config and active provider config
      const res = await fetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          enabled: nextEnabled,
          provider: currentProviderSummary.providerCode || 'gemini',
          model: currentProviderSummary.model || 'gemini-3.8-flash'
        })
      });

      if (!res.ok) throw new Error('Không thể cập nhật trạng thái bật/tắt AI toàn hệ thống');

      setGlobalEnabled(nextEnabled);
      setSuccess(nextEnabled ? 'Đã bật AI cho hệ thống' : 'Đã tạm tắt AI cho hệ thống');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Lỗi cập nhật trạng thái hệ thống');
    } finally {
      setTogglingGlobal(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    try {
      const payload: any = {
        providerCode: selectedProviderCode,
        model: currentForm.model.trim(),
        isEnabled: currentForm.isEnabled
      };

      const hasTypedKey = isChangingKey[selectedProviderCode] && currentForm.apiKey.trim().length > 0;
      if (hasTypedKey) {
        payload.apiKey = currentForm.apiKey.trim();
      }

      const token = await getAccessToken();
      const res = await fetch(`/api/admin/ai/providers/${selectedProviderCode}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error('API_INVALID_CONTENT_TYPE');
      }

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        const errorMsg = resData.error || ERROR_MESSAGES[resData.code] || 'Lỗi khi lưu cấu hình';
        throw new Error(errorMsg);
      }

      const savedProvider = resData.provider;
      if (hasTypedKey && !savedProvider?.hasApiKey) {
        throw new Error('AI_PROVIDER_KEY_NOT_PERSISTED: Không nhận được xác nhận lưu API key từ hệ thống.');
      }

      // Invalidate and refetch provider configs from database
      const provRes = await fetch('/api/admin/ai/providers', { headers: { Authorization: `Bearer ${token}` } });
      if (provRes.ok) {
        const freshList = await provRes.json();
        setProviders(freshList);
      } else {
        setProviders(prev => prev.map(p => p.providerCode === selectedProviderCode ? savedProvider : p));
      }

      setIsChangingKey(prev => ({ ...prev, [selectedProviderCode]: false }));
      setProviderForms(prev => ({
        ...prev,
        [selectedProviderCode]: {
          ...prev[selectedProviderCode],
          model: savedProvider?.model || payload.model,
          apiKey: ''
        }
      }));

      setSuccess(`Đã lưu cấu hình an toàn cho ${savedProvider?.displayName || currentProviderSummary.displayName || selectedProviderCode}. Vui lòng kiểm tra kết nối trước khi kích hoạt.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(ERROR_MESSAGES[err.message] || err.message || 'Lỗi khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    const hasKey = currentProviderSummary.hasApiKey ?? currentProviderSummary.hasConfiguredKey ?? false;
    if (!hasKey) {
      setError('Vui lòng lưu cấu hình API Key vào cơ sở dữ liệu trước khi kiểm tra kết nối.');
      setTesting(false);
      return;
    }

    try {
      const payload: any = {
        model: currentForm.model.trim()
      };

      const token = await getAccessToken();
      const res = await fetch(`/api/admin/ai/providers/${selectedProviderCode}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const text = await res.text();
        const isHtml = text.includes('<!doctype html>');
        setTestResult({
          success: false,
          code: isHtml ? 'INGRESS_PROXY_HTML' : 'API_INVALID_CONTENT_TYPE',
          message: ERROR_MESSAGES[isHtml ? 'INGRESS_PROXY_HTML' : 'API_INVALID_CONTENT_TYPE']
        });
        setTesting(false);
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errorCode = data.code || 'AI_PROVIDER_ERROR';
        setTestResult({
          success: false,
          code: errorCode,
          message: ERROR_MESSAGES[errorCode] || data.message || data.error || 'Kiểm tra kết nối thất bại'
        });
      } else {
        setTestResult({
          success: true,
          message: data.message || 'Kết nối thành công với nhà cung cấp AI!'
        });
      }

      // Reload summaries to reflect latest status (connected / failed) and version
      const provRes = await fetch('/api/admin/ai/providers', { headers: { Authorization: `Bearer ${token}` } });
      if (provRes.ok) {
        const freshList = await provRes.json();
        setProviders(freshList);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        code: 'AI_PROVIDER_NETWORK_ERROR',
        message: ERROR_MESSAGES['AI_PROVIDER_NETWORK_ERROR'] || err.message
      });
    } finally {
      setTesting(false);
    }
  };

  const handleActivateConfirmed = async () => {
    setShowActivateModal(false);
    setActivating(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/ai/providers/${selectedProviderCode}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error('API_INVALID_CONTENT_TYPE');
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể kích hoạt nhà cung cấp');
      }

      // Reload summaries
      const provRes = await fetch('/api/admin/ai/providers', { headers: { Authorization: `Bearer ${token}` } });
      if (provRes.ok) {
        const freshList = await provRes.json();
        setProviders(freshList);
      }

      setSuccess(`Đã kích hoạt thành công nhà cung cấp ${currentProviderSummary.displayName || selectedProviderCode}! Mọi yêu cầu AI mới sẽ sử dụng provider này.`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(ERROR_MESSAGES[err.message] || err.message || 'Lỗi kích hoạt nhà cung cấp');
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" /> Đang tải cấu hình AI...</div>;
  }

  const activeProvider = providers.find(p => p.isActive) || {};
  const selectedProvider = providers.find(p => p.providerCode === selectedProviderCode) || {};
  const hasApiKey = selectedProvider.hasApiKey ?? selectedProvider.hasConfiguredKey ?? false;

  const savedModel = (selectedProvider.model || '').trim();
  const formModel = (currentForm.model || '').trim();
  const isApiKeyTyped = !!(isChangingKey[selectedProviderCode] && currentForm.apiKey.trim().length > 0);
  const isModelChanged = formModel !== '' && savedModel !== '' && formModel !== savedModel;
  const isDirty = isModelChanged || isApiKeyTyped;

  // Requirement 4: Điều kiện bật nút “Kiểm tra kết nối”
  const canTestConnection =
    selectedProvider.isEnabled !== false &&
    hasApiKey === true &&
    isDirty === false &&
    saving === false &&
    testing === false;

  // Requirement 5: Điều kiện bật nút “Kích hoạt provider này”
  const isTestedVersionMatch = (selectedProvider.testedConfigVersion ?? selectedProvider.lastTestedConfigVersion ?? 1) === (selectedProvider.configVersion || 1);
  const isConnected = selectedProvider.connectionStatus === 'connected' && 
                      selectedProvider.lastTestedAt != null && 
                      isTestedVersionMatch;

  const canActivate =
    selectedProvider.isEnabled !== false &&
    hasApiKey === true &&
    isConnected &&
    !selectedProvider.isActive &&
    isDirty === false &&
    testing === false &&
    activating === false &&
    saving === false;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button 
          onClick={() => setActiveTab('provider')}
          className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'provider' ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold' : 'text-slate-500 hover:text-indigo-600 border-b-2 border-transparent'}`}
        >
          Nhà cung cấp AI (Multi-Provider)
        </button>
        <button 
          onClick={() => setActiveTab('registry')}
          className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'registry' ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold' : 'text-slate-500 hover:text-indigo-600 border-b-2 border-transparent'}`}
        >
          Prompt Registry
        </button>
        <button 
          onClick={() => setActiveTab('audit')}
          className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'audit' ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold' : 'text-slate-500 hover:text-indigo-600 border-b-2 border-transparent'}`}
        >
          Usage / Audit
        </button>
      </div>

      {activeTab === 'provider' ? (
        <div className="space-y-6">
          {/* Header & Global System Status Block */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                <Bot className="w-6 h-6 text-indigo-600" /> Quản trị nhà cung cấp AI
              </h1>
              <p className="text-sm text-slate-500">Cấu hình, kiểm tra kết nối độc lập và kích hoạt nhà cung cấp AI (Gemini hoặc OpenAI)</p>
            </div>
            
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái hệ thống AI</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${globalEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  <span className="text-sm font-semibold text-slate-900">{globalEnabled ? 'Đang bật' : 'Đang tạm tắt'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleGlobalEnabled}
                disabled={togglingGlobal}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${globalEnabled ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                {togglingGlobal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                {globalEnabled ? 'Tạm tắt AI' : 'Bật lại AI'}
              </button>
            </div>
          </div>

          {/* Active Provider Quick Summary Banner */}
          <div className="bg-indigo-900 text-white rounded-xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-widest text-indigo-300 font-semibold">Nhà cung cấp đang hoạt động (Active Provider)</div>
              <div className="text-xl font-bold flex items-center gap-2">
                <span>{activeProvider.displayName || activeProvider.providerCode || 'Chưa chọn'}</span>
                <span className="px-2.5 py-0.5 bg-indigo-700 text-indigo-200 text-xs rounded-full font-mono font-normal">Model: {activeProvider.model || 'N/A'}</span>
              </div>
              <div className="text-xs text-indigo-200">
                Trạng thái kết nối: <span className="font-semibold text-emerald-300">{activeProvider.connectionStatus === 'connected' ? 'Đã kết nối thành công' : 'Chưa kiểm tra'}</span>
                {activeProvider.updatedAt && ` • Cập nhật: ${new Date(activeProvider.updatedAt).toLocaleString()}`}
              </div>
            </div>
            <div className="bg-indigo-800/80 px-4 py-3 rounded-lg border border-indigo-700 text-xs text-indigo-200 space-y-1">
              <div className="font-medium text-white flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-400" /> Nguyên tắc vận hành:</div>
              <div>• Không có fallback tự động giữa các provider.</div>
              <div>• Yêu cầu AI mới luôn sử dụng provider active hiện tại.</div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Provider Selection Cards / Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((prov) => {
              const isSelected = prov.providerCode === selectedProviderCode;
              const isActive = prov.isActive;
              const hasKey = prov.hasApiKey ?? prov.hasConfiguredKey ?? false;
              const isProvTestedMatch = (prov.testedConfigVersion ?? prov.lastTestedConfigVersion ?? 1) === (prov.configVersion || 1);
              const isProvConnected = prov.connectionStatus === 'connected' && 
                                     prov.lastTestedAt != null && 
                                     isProvTestedMatch;

              return (
                <div
                  key={prov.providerCode}
                  onClick={() => setSelectedProviderCode(prov.providerCode)}
                  className={`cursor-pointer rounded-xl p-5 border transition-all relative ${isSelected ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-2 ring-indigo-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${prov.providerCode === 'openai' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {prov.providerCode === 'openai' ? 'O' : 'G'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{prov.displayName}</h3>
                        <p className="text-xs text-slate-500 font-mono">Model: {prov.model}</p>
                      </div>
                    </div>
                    {isActive ? (
                      <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full flex items-center gap-1 shadow-xs">
                        <Check className="w-3.5 h-3.5" /> Đang sử dụng
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                        Chưa kích hoạt
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${hasKey ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      <span className={hasKey ? 'text-slate-700 font-medium' : 'text-amber-700'}>
                        {hasKey ? 'Đã có API Key' : 'Chưa có API Key'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      {isProvConnected ? (
                        <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Kết nối tốt</span>
                      ) : (
                        <span className="text-amber-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Cần kiểm tra lại</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Provider Detailed Configuration Form */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Network className="w-5 h-5 text-indigo-600" /> Cấu hình chi tiết: {currentProviderSummary.displayName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Thực hiện lưu cấu hình, kiểm tra kết nối độc lập, hoặc kích hoạt nhà cung cấp này.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={saving || testing || activating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 shadow-xs"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={!canTestConnection}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <RefreshCw className="w-4 h-4 text-indigo-600" />}
                  {testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowActivateModal(true)}
                  disabled={!canActivate && !selectedProvider.isActive}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-xs ${selectedProvider.isActive ? 'bg-emerald-100 text-emerald-800 cursor-default' : canActivate ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                  {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {selectedProvider.isActive ? 'Đang sử dụng' : 'Kích hoạt provider này'}
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Instruction banner */}
              <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-sm flex items-center gap-3">
                <Info className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Quy trình bắt buộc:</span> Thực hiện theo thứ tự: <b>Lưu cấu hình → Kiểm tra kết nối → Kích hoạt.</b>
                </div>
              </div>

              {isDirty && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Có thay đổi chưa lưu. Vui lòng bấm <b>"Lưu cấu hình"</b> trước khi kiểm tra kết nối hoặc kích hoạt.</span>
                </div>
              )}
              {/* Status Warning Banner if Retest Required */}
              {!isConnected && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Yêu cầu kiểm tra kết nối (Retest Required)</div>
                    <div className="text-xs mt-0.5 text-amber-700">
                      Cấu hình hoặc model/API key của nhà cung cấp này chưa được kiểm tra thành công với version hiện tại ({selectedProvider.configVersion || 1}). Vui lòng bấm <b>"Kiểm tra kết nối"</b> trước khi có thể kích hoạt.
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nhà cung cấp</label>
                  <input
                    type="text"
                    disabled
                    value={selectedProvider.displayName || currentProviderSummary.displayName || selectedProviderCode}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Model AI <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={currentForm.model}
                    onChange={e => handleFormChange('model', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-900"
                  >
                    {(ALLOWED_MODELS[selectedProviderCode] || [currentForm.model]).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Thay đổi model sẽ yêu cầu kiểm tra kết nối lại trước khi kích hoạt.</p>
                </div>
              </div>

              {/* API Key Management */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-indigo-600" /> API Key bảo mật</span>
                  <span className="text-xs text-slate-500">Mã hóa AES-256 tại backend</span>
                </label>

                {!isChangingKey[selectedProviderCode] && hasApiKey ? (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <Shield className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-emerald-800">Đã cấu hình an toàn trong cơ sở dữ liệu</div>
                      <div className="text-xs text-emerald-600 mt-0.5">Không hiển thị key bảo mật ra giao diện</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsChangingKey(prev => ({ ...prev, [selectedProviderCode]: true }))}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                    >
                      Thay đổi API Key
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative flex items-center">
                      <input
                        type={showKey[selectedProviderCode] ? 'text' : 'password'}
                        value={currentForm.apiKey}
                        onChange={e => handleFormChange('apiKey', e.target.value)}
                        placeholder={`Nhập API Key mới cho ${currentProviderSummary.displayName}...`}
                        autoComplete="new-password"
                        className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(prev => ({ ...prev, [selectedProviderCode]: !prev[selectedProviderCode] }))}
                        className="absolute right-3 text-slate-400 hover:text-slate-600"
                      >
                        {showKey[selectedProviderCode] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {hasApiKey && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setIsChangingKey(prev => ({ ...prev, [selectedProviderCode]: false }));
                            handleFormChange('apiKey', '');
                          }}
                          className="text-xs text-slate-600 hover:text-slate-900 underline"
                        >
                          Hủy thay đổi API Key
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div className={`p-4 rounded-xl border text-sm space-y-2 ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    {testResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                  {!testResult.success && testResult.code && (
                    <div className="text-xs font-mono pl-7 text-red-700">
                      Mã lỗi kỹ thuật: <span className="font-bold">{testResult.code}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'registry' ? (
        <AiPromptRegistryView />
      ) : (
        <AiUsageAuditView />
      )}

      {/* Confirmation Modal for Activation */}
      {showActivateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-100 animate-in fade-in zoom-in duration-150">
            <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-indigo-600" /> Xác nhận thay đổi nhà cung cấp AI
            </h3>
            
            <div className="text-sm text-slate-600 space-y-2">
              <p>Bạn đang chuẩn bị kích hoạt nhà cung cấp:</p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-medium text-slate-900 space-y-1">
                <div>Nhà cung cấp: <span className="text-indigo-600">{currentProviderSummary.displayName}</span></div>
                <div>Model mới: <span className="text-indigo-600">{currentForm.model}</span></div>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                • Tất cả yêu cầu AI mới trong hệ thống sẽ sử dụng nhà cung cấp này.<br/>
                • Hệ thống không tự động chuyển về nhà cung cấp cũ nếu có lỗi.<br/>
                • Thao tác được ghi vào nhật ký kiểm toán (audit log) an toàn.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowActivateModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleActivateConfirmed}
                disabled={activating}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                {activating && <Loader2 className="w-4 h-4 animate-spin" />}
                Xác nhận kích hoạt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
