import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Building2, Phone, Mail, Globe, Clock, Calendar, Type, Image as ImageIcon, Loader2, Upload, Trash2 } from 'lucide-react';
import { systemSettingsService } from '../../../services/system-settings.service';
import { useSystemSettings } from '../../../context/SystemSettingsContext';

export const SystemSettingsView: React.FC = () => {
  const { refreshSettings } = useSystemSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    rootOrgName: '',
    app_name: '',
    organization_short_name: '',
    organization_address: '',
    organization_phone: '',
    organization_email: '',
    organization_website: '',
    timezone: 'Asia/Ho_Chi_Minh',
    date_format: 'dd/MM/yyyy',
    locale: 'vi-VN',
    logo_path: '',
    logo_small_path: '',
    favicon_path: '',
    appearance_mode: 'light',
    appearance_accent: 'indigo'
  });

  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const handleAssetUpload = async (type: 'logo' | 'logo-small' | 'favicon', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước file không được vượt quá 5MB');
      return;
    }

    try {
      setUploadingType(type);
      setError(null);
      const { path } = await systemSettingsService.uploadSystemAsset(type, file);
      const key = type === 'logo' ? 'logo_path' : type === 'logo-small' ? 'logo_small_path' : 'favicon_path';
      setFormData(prev => ({ ...prev, [key]: path }));
      setSuccess(true);
      await refreshSettings();
    } catch (err: any) {
      setError(err.message || 'Lỗi tải lên file');
    } finally {
      setUploadingType(null);
      e.target.value = '';
    }
  };

  const handleAssetDelete = async (type: 'logo' | 'logo-small' | 'favicon') => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ảnh này?')) return;
    try {
      setUploadingType(type);
      setError(null);
      await systemSettingsService.deleteSystemAsset(type);
      const key = type === 'logo' ? 'logo_path' : type === 'logo-small' ? 'logo_small_path' : 'favicon_path';
      setFormData(prev => ({ ...prev, [key]: '' }));
      setSuccess(true);
      await refreshSettings();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa file');
    } finally {
      setUploadingType(null);
    }
  };

  const renderAssetBlock = (type: 'logo' | 'logo-small' | 'favicon', label: string, desc: string, currentPath: string) => {
    const isUploading = uploadingType === type;
    const publicUrl = currentPath ? systemSettingsService.getSystemAssetPublicUrl(currentPath) : '';
    
    return (
      <div className="flex flex-col gap-2">
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        <div className="h-32 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center p-2 relative overflow-hidden group">
          {currentPath ? (
            <img src={publicUrl} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-sm text-slate-400">Chưa thiết lập</span>
          )}
          
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <label className="cursor-pointer bg-white text-slate-700 p-2 rounded-lg hover:bg-slate-100 shadow-sm transition-colors" title="Tải lên thay thế">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/svg+xml, image/x-icon, image/vnd.microsoft.icon" onChange={(e) => handleAssetUpload(type, e)} disabled={isUploading} />
            </label>
            {currentPath && (
              <button type="button" onClick={() => handleAssetDelete(type)} disabled={isUploading} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 shadow-sm transition-colors" title="Xóa">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await systemSettingsService.getAdminSettings();
      setFormData({
        rootOrgName: data.rootOrg?.name || '',
        app_name: data.settings.app_name || '',
        organization_short_name: data.settings.organization_short_name || '',
        organization_address: data.settings.organization_address || '',
        organization_phone: data.settings.organization_phone || '',
        organization_email: data.settings.organization_email || '',
        organization_website: data.settings.organization_website || '',
        timezone: data.settings.timezone || 'Asia/Ho_Chi_Minh',
        date_format: data.settings.date_format || 'dd/MM/yyyy',
        locale: data.settings.locale || 'vi-VN',
        logo_path: data.settings.logo_path || '',
        logo_small_path: data.settings.logo_small_path || '',
        favicon_path: data.settings.favicon_path || '',
        appearance_mode: data.settings.appearance_mode || 'light',
        appearance_accent: data.settings.appearance_accent || 'indigo'
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { rootOrgName, logo_path, logo_small_path, favicon_path, ...settings } = formData;
      await systemSettingsService.updateSystemSettings(rootOrgName, settings);
      setSuccess(true);
      await refreshSettings();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cấu hình hệ thống</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý các thiết lập chung của toàn bộ ứng dụng</p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-lg text-sm flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          Cập nhật cấu hình thành công
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* THÔNG TIN CHUNG */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">1. Thông tin chung</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên đơn vị (Root Organization) <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.rootOrgName}
                onChange={e => handleChange('rootOrgName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên phần mềm <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.app_name}
                onChange={e => handleChange('app_name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên viết tắt đơn vị <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.organization_short_name}
                onChange={e => handleChange('organization_short_name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* THÔNG TIN LIÊN HỆ */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Phone className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">2. Thông tin liên hệ</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Địa chỉ</label>
              <input
                type="text"
                value={formData.organization_address}
                onChange={e => handleChange('organization_address', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Điện thoại</label>
              <input
                type="tel"
                value={formData.organization_phone}
                onChange={e => handleChange('organization_phone', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={formData.organization_email}
                  onChange={e => handleChange('organization_email', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Globe className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="url"
                  value={formData.organization_website}
                  onChange={e => handleChange('organization_website', e.target.value)}
                  placeholder="https://"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* KHU VỰC */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">3. Khu vực</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Múi giờ
              </label>
              <select
                value={formData.timezone}
                onChange={e => handleChange('timezone', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Định dạng ngày
              </label>
              <select
                value={formData.date_format}
                onChange={e => handleChange('date_format', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="dd/MM/yyyy">dd/MM/yyyy</option>
                <option value="MM/dd/yyyy">MM/dd/yyyy</option>
                <option value="yyyy-MM-dd">yyyy-MM-dd</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                <Type className="w-4 h-4" /> Ngôn ngữ
              </label>
              <select
                value={formData.locale}
                onChange={e => handleChange('locale', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="vi-VN">Tiếng Việt</option>
                <option value="en-US">English</option>
              </select>
            </div>
          </div>
        </div>

        {/* GIAO DIỆN HỆ THỐNG */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-slate-900">Giao diện hệ thống</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, appearance_mode: 'light', appearance_accent: 'indigo' }));
                setSuccess(false);
              }}
              className="text-xs font-medium text-slate-600 hover:text-indigo-600 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Khôi phục mặc định
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">A. Chế độ hiển thị</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'light', label: 'Sáng', desc: 'Giao diện nền sáng' },
                  { id: 'dark', label: 'Tối', desc: 'Giao diện nền tối' },
                  { id: 'system', label: 'Theo thiết bị', desc: 'Tự động theo hệ thống' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleChange('appearance_mode', mode.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.appearance_mode === mode.id
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-900">{mode.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">B. Màu chủ đạo</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'indigo', label: 'Tím', colorClass: 'bg-indigo-600' },
                  { id: 'blue', label: 'Xanh dương', colorClass: 'bg-blue-600' },
                  { id: 'teal', label: 'Xanh ngọc', colorClass: 'bg-teal-600' }
                ].map(accent => (
                  <button
                    key={accent.id}
                    type="button"
                    onClick={() => handleChange('appearance_accent', accent.id)}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                      formData.appearance_accent === accent.id
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full ${accent.colorClass} shadow-xs flex-shrink-0`} />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{accent.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* NHẬN DIỆN */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">4. Nhận diện & Branding</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderAssetBlock('logo', 'Logo chính', 'Khuyến nghị ảnh ngang. Định dạng PNG, JPG, WEBP, SVG. Tối đa 5MB.', formData.logo_path)}
          {renderAssetBlock('logo-small', 'Logo thu gọn', 'Khuyến nghị ảnh vuông. Hiển thị khi thu gọn menu.', formData.logo_small_path)}
          {renderAssetBlock('favicon', 'Favicon', 'Khuyến nghị ảnh vuông. Định dạng ICO, PNG, SVG.', formData.favicon_path)}
        </div>
      </div>

      </form>
    </div>
  );
};
