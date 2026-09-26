import React, { useState, useEffect } from 'react';
import {
  X,
  CalendarDays,
  Building2,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Target,
  BarChart3,
  Edit3,
  RotateCcw,
  Power,
  ShieldCheck,
  History,
  Tag,
  Loader2,
  Trash2,
} from 'lucide-react';
import { AdmissionCampaign } from '../../../types/admission';
import { admissionFoundationService } from '../../../services/admissionService';

interface CampaignDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: AdmissionCampaign | null;
  onEdit?: (campaign: AdmissionCampaign) => void;
  onChangeStatus?: (campaign: AdmissionCampaign) => void;
  onViewHistory?: (campaign: AdmissionCampaign) => void;
  canEdit?: boolean;
}

export const CampaignDetailModal: React.FC<CampaignDetailModalProps> = ({
  isOpen,
  onClose,
  campaign,
  onEdit,
  onChangeStatus,
  onViewHistory,
  canEdit = false,
}) => {
  const [dependencies, setDependencies] = useState<{
    plansCount: number;
    resultsCount: number;
    hasFinalizedResult: boolean;
  }>({ plansCount: 0, resultsCount: 0, hasFinalizedResult: false });
  const [isLoadingDeps, setIsLoadingDeps] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !campaign) return;
    const fetchDeps = async () => {
      setIsLoadingDeps(true);
      try {
        const deps = await admissionFoundationService.checkCampaignDependencies(campaign.id);
        setDependencies(deps);
      } catch (err) {
        console.warn('Error checking campaign dependencies:', err);
      } finally {
        setIsLoadingDeps(false);
      }
    };
    fetchDeps();
  }, [isOpen, campaign?.id]);

  if (!isOpen || !campaign) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'planning':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
            Nháp (Lên kế hoạch)
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Đang tuyển
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            Đã chốt
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            <span className="h-2 w-2 rounded-full bg-rose-400"></span>
            Đã hủy / Lưu trữ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div
        id="campaign-detail-modal"
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  {campaign.code}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Năm {campaign.year} • Đợt {campaign.period_number}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">{campaign.name}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* Status & Active Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Trạng thái tuyển sinh
                </div>
                {getStatusBadge(campaign.status)}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                Kích hoạt sử dụng
              </div>
              {campaign.is_active ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Đang hoạt động
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Ngừng sử dụng
                </span>
              )}
            </div>
          </div>

          {/* Grid Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                <span>Nhóm tuyển sinh</span>
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {campaign.code === 'NH-05.03' || campaign.code?.startsWith('NH-') ? 'Đào tạo ngắn hạn' : (campaign.group?.name || (campaign.group_id.includes('0001') ? 'Trung cấp' : 'Đào tạo ngắn hạn'))}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {campaign.code === 'NH-05.03' || campaign.code?.startsWith('NH-') ? 'NGAN_HAN' : (campaign.group?.code || (campaign.group_id.includes('0001') ? 'TRUNG_CAP' : 'NGAN_HAN'))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                <span>Đơn vị phụ trách</span>
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {campaign.unit?.name || 'Toàn trường (Dùng chung)'}
              </div>
              <div className="text-[11px] text-slate-400">
                {campaign.unit?.code ? `Mã đơn vị: ${campaign.unit.code}` : 'Chung cho các đơn vị'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                <span>Thời gian bắt đầu</span>
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {campaign.start_date || 'Chưa thiết lập'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                <span>Thời gian kết thúc</span>
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {campaign.end_date || 'Chưa thiết lập'}
              </div>
            </div>
          </div>

          {/* Description */}
          {campaign.description && (
            <div className="rounded-xl border border-slate-200 p-4 space-y-1.5">
              <div className="text-xs font-semibold text-slate-600">Mô tả chi tiết:</div>
              <p className="text-xs text-slate-700 leading-relaxed">{campaign.description}</p>
            </div>
          )}

          {/* Related Data / Dependencies */}
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                Dữ liệu liên quan & Tính toàn vẹn
              </span>
              {isLoadingDeps && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-white p-3 border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <Target className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Kế hoạch tuyển sinh</span>
                </div>
                <div className="text-base font-bold text-slate-800">
                  {dependencies.plansCount} <span className="text-xs font-normal text-slate-500">chỉ tiêu đã giao</span>
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Kết quả tuyển sinh</span>
                </div>
                <div className="text-base font-bold text-slate-800">
                  {dependencies.resultsCount} <span className="text-xs font-normal text-slate-500">bản ghi kết quả</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Footnote */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            <span>Ngày tạo: {campaign.created_at ? new Date(campaign.created_at).toLocaleString('vi-VN') : '—'}</span>
            <span>Cập nhật: {campaign.updated_at ? new Date(campaign.updated_at).toLocaleString('vi-VN') : '—'}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            {onViewHistory && (
              <button
                type="button"
                onClick={() => onViewHistory(campaign)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
              >
                <History className="h-3.5 w-3.5 text-slate-500" />
                <span>Xem lịch sử thay đổi</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`Bạn có chắc chắn muốn xóa đợt tuyển sinh "${campaign.code} - ${campaign.name}" không?`)) return;
                  try {
                    await admissionFoundationService.deleteCampaign(campaign.id);
                    onClose();
                    window.location.reload();
                  } catch (err: any) {
                    alert(err.message || 'Không thể xóa đợt tuyển sinh.');
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa đợt</span>
              </button>
            )}
            {canEdit && onChangeStatus && (
              <button
                type="button"
                onClick={() => onChangeStatus(campaign)}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Chuyển trạng thái</span>
              </button>
            )}
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(campaign)}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Chỉnh sửa</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
