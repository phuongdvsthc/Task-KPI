import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { KpiPeriod, KpiPeriodType, KpiPeriodStatus } from '../../../types/kpi';
import { kpiService } from '../../../services/kpi.service';
import { useAuth } from '../../../context/AuthContext';

interface KpiPeriodFormProps {
  period?: KpiPeriod;
  onClose: () => void;
  onSuccess: () => void;
}

export const KpiPeriodForm: React.FC<KpiPeriodFormProps> = ({ period, onClose, onSuccess }) => {
  const { isAdmin, primaryUnit } = useAuth();
  
  const [formData, setFormData] = useState<Partial<KpiPeriod>>(
    period || {
      code: '',
      name: '',
      period_type: 'monthly',
      start_date: '',
      end_date: '',
      status: 'draft',
      organization_unit_id: isAdmin ? null : primaryUnit?.id || null
    }
  );
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.code || !formData.name || !formData.start_date || !formData.end_date) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc');
      return;
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      setError('Ngày bắt đầu không được lớn hơn ngày kết thúc');
      return;
    }

    setIsSubmitting(true);
    try {
      if (period?.id) {
        const { error: updateError } = await kpiService.updatePeriod(period.id, formData);
        if (updateError) throw updateError;
      } else {
        const { error: createError } = await kpiService.createPeriod(formData);
        if (createError) throw createError;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi lưu kỳ đánh giá');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-800">
            {period ? 'Cập nhật kỳ đánh giá' : 'Tạo kỳ đánh giá mới'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mã kỳ đánh giá <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                value={formData.code || ''}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                placeholder="VD: 2024-Q1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên kỳ đánh giá <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: Quý 1 năm 2024"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Loại kỳ <span className="text-red-500">*</span></label>
                <select
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                  value={formData.period_type || 'monthly'}
                  onChange={e => setFormData({ ...formData, period_type: e.target.value as KpiPeriodType })}
                >
                  <option value="monthly">Tháng</option>
                  <option value="quarterly">Quý</option>
                  <option value="semester">Học kỳ</option>
                  <option value="academic_year">Năm học</option>
                  <option value="yearly">Năm</option>
                  <option value="custom">Tùy chỉnh</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái <span className="text-red-500">*</span></label>
                <select
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                  value={formData.status || 'draft'}
                  onChange={e => setFormData({ ...formData, status: e.target.value as KpiPeriodStatus })}
                >
                  <option value="draft">Nháp</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="closed">Đã đóng</option>
                  <option value="archived">Lưu trữ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ngày bắt đầu <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  value={formData.start_date || ''}
                  onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ngày kết thúc <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  value={formData.end_date || ''}
                  onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phạm vi</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                  value={formData.organization_unit_id === null ? 'global' : 'unit'}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData({ ...formData, organization_unit_id: val === 'global' ? null : primaryUnit?.id || null });
                  }}
                >
                  <option value="global">Toàn trường (Global)</option>
                  <option value="unit">Theo đơn vị ({primaryUnit?.name || 'Unknown'})</option>
                </select>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Lưu lại</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
