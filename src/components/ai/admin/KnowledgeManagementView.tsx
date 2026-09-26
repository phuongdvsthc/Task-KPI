import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  PowerOff,
  AlertCircle,
  FileCheck,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Play,
  RotateCw
} from 'lucide-react';
import {
  AIKnowledgeDocument,
  AIKnowledgeDocumentStatus,
  AIKnowledgeProcessingStatus
} from '../../../types/aiKnowledge';
import { knowledgeApiClient } from '../../../services/ai/knowledge/knowledgeApiClient';
import { KnowledgeUploadModal } from './KnowledgeUploadModal';
import { KnowledgeDetailModal } from './KnowledgeDetailModal';
import { useAuthorization } from '../../../context/AuthorizationContext';
import { CAPABILITIES } from '../../../types/authorization';
import { AccessDeniedView } from '../../common/AccessDeniedView';

export const KnowledgeManagementView: React.FC = () => {
  const { hasCapability } = useAuthorization();
  const canManageKnowledge = hasCapability(CAPABILITIES.AI_KNOWLEDGE_MANAGE);

  const [documents, setDocuments] = useState<AIKnowledgeDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AIKnowledgeDocumentStatus | 'all'>('all');
  const [processingFilter, setProcessingFilter] = useState<AIKnowledgeProcessingStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);

  const handleTriggerProcess = async (documentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setProcessingDocId(documentId);
      setErrorMessage(null);
      await knowledgeApiClient.processDocument(documentId);
      await loadDocuments();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi xử lý tài liệu.');
    } finally {
      setProcessingDocId(null);
    }
  };

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const res = await knowledgeApiClient.listDocuments({
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter,
        processing_status: processingFilter,
        category: categoryFilter,
        sort_by: 'updated_at',
        sort_order: 'desc'
      });

      setDocuments(res.documents);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi tải danh sách kho tài liệu.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter, processingFilter, categoryFilter]);

  useEffect(() => {
    if (canManageKnowledge) {
      loadDocuments();
    }
  }, [canManageKnowledge, loadDocuments]);

  if (!canManageKnowledge) {
    return (
      <AccessDeniedView
        requestedPath="admin/knowledge-base"
        missingCapabilities={[CAPABILITIES.AI_KNOWLEDGE_MANAGE]}
      />
    );
  }

  const handleOpenDetail = (docId: string) => {
    setSelectedDocId(docId);
    setIsDetailModalOpen(true);
  };

  const getStatusBadge = (status: AIKnowledgeDocumentStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Đã xuất bản
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" /> Bản nháp
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
            <PowerOff className="h-3 w-3" /> Ngừng sử dụng
          </span>
        );
      default:
        return null;
    }
  };

  const getProcessingBadge = (doc: AIKnowledgeDocument) => {
    switch (doc.processing_status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 border border-teal-200">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            Sẵn sàng ({doc.chunk_count || 0} đoạn)
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 border border-sky-200 animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin text-sky-600" />
            Đang xử lý...
          </span>
        );
      case 'failed':
        return (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 border border-rose-200"
            title={doc.error_message || undefined}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Lỗi xử lý
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Chờ xử lý
          </span>
        );
    }
  };

  return (
    <div id="ai-knowledge-management-view" className="space-y-6">
      {/* Top Banner / Explanatory Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Kho tài liệu nội bộ AI Assistant</h1>
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                AI-C1 Admin
              </span>
            </div>
            <p className="text-sm text-slate-600 max-w-3xl">
              Quản lý tài liệu nguồn, siêu dữ liệu, phiên bản và thời hạn hiệu lực làm cơ sở tri thức cho
              Trợ lý AI. Tất cả tài liệu được lưu trong Private Storage và kiểm soát truy cập nghiêm ngặt.
            </p>
          </div>

          <button
            id="open-upload-modal-btn"
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors shrink-0"
          >
            <Upload className="h-4 w-4" />
            Thêm tài liệu mới
          </button>
        </div>

        {/* Security Warning Notice */}
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 leading-relaxed">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <strong>Lưu ý bảo mật:</strong> Tài liệu sau khi xuất bản có thể được AI sử dụng để trả
            lời cho tất cả người dùng được cấp quyền AI. Tuyệt đối không tải lên tài liệu mật, thông
            tin cá nhân nhạy cảm hoặc tài liệu chỉ dành riêng cho một cá nhân, phòng ban.
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="search-documents-input"
              type="text"
              placeholder="Tìm theo tiêu đề, tên tệp..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Status filter */}
          <div>
            <select
              id="filter-status-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Tất cả trạng thái xuất bản</option>
              <option value="published">Đã xuất bản (Published)</option>
              <option value="draft">Bản nháp (Draft)</option>
              <option value="inactive">Ngừng sử dụng (Inactive)</option>
            </select>
          </div>

          {/* Processing status filter */}
          <div>
            <select
              id="filter-processing-select"
              value={processingFilter}
              onChange={(e) => {
                setProcessingFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Tất cả trạng thái xử lý</option>
              <option value="ready">Sẵn sàng xuất bản (Ready)</option>
              <option value="pending">Chờ xử lý (Pending)</option>
              <option value="processing">Đang trích xuất (Processing)</option>
              <option value="failed">Lỗi xử lý (Failed)</option>
            </select>
          </div>

          {/* Category filter */}
          <div>
            <select
              id="filter-category-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Tất cả danh mục</option>
              <option value="quy_che_quy_dinh">Quy chế / Quy định</option>
              <option value="tuyen_sinh">Tuyển sinh</option>
              <option value="dao_tao">Đào tạo & Khảo thí</option>
              <option value="nhan_su_to_chuc">Nhân sự & Tổ chức</option>
              <option value="hanh_chinh_quan_tri">Hành chính - Quản trị</option>
              <option value="huong_dan_bieu_mau">Hướng dẫn & Biểu mẫu</option>
              <option value="khac">Khác</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={loadDocuments}
            className="ml-auto underline font-medium text-rose-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Documents Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table id="knowledge-documents-table" className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3.5">
                  Tài liệu & Phiên bản
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Danh mục
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Trạng thái
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Xử lý kỹ thuật
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Hiệu lực
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Cập nhật
                </th>
                <th scope="col" className="px-4 py-3.5 text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
                    Đang tải danh sách tài liệu...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <FileText className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                    Chưa có tài liệu nào trong kho tri thức.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => handleOpenDetail(doc.id)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-semibold text-xs mt-0.5">
                          {doc.mime_type.includes('pdf')
                            ? 'PDF'
                            : doc.mime_type.includes('word') || doc.original_file_name.endsWith('.docx')
                            ? 'DOC'
                            : 'TXT'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors line-clamp-1">
                            {doc.title}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>{doc.original_file_name}</span>
                            <span>•</span>
                            <span>{(doc.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                            <span>•</span>
                            <span className="font-mono text-indigo-600">{doc.version_label}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-600 capitalize">
                      {doc.category.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">{getStatusBadge(doc.status)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getProcessingBadge(doc)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-600">
                      {doc.effective_from
                        ? new Date(doc.effective_from).toLocaleDateString('vi-VN')
                        : 'Vô hạn'}{' '}
                      -{' '}
                      {doc.effective_until
                        ? new Date(doc.effective_until).toLocaleDateString('vi-VN')
                        : 'Vô hạn'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500">
                      {new Date(doc.updated_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {(doc.processing_status === 'pending' || doc.processing_status === 'failed') && doc.status !== 'published' && (
                          <button
                            type="button"
                            onClick={(e) => handleTriggerProcess(doc.id, e)}
                            disabled={processingDocId === doc.id}
                            title={doc.processing_status === 'failed' ? 'Thử lại tiến trình chia đoạn & embedding' : 'Tiến hành chia đoạn & embedding'}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                          >
                            {processingDocId === doc.id ? (
                              <>
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                Đang xử lý...
                              </>
                            ) : doc.processing_status === 'failed' ? (
                              <>
                                <RotateCw className="h-3 w-3" />
                                Thử lại
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3" />
                                Xử lý
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(doc.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" /> Chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500">
            <div>
              Hiển thị <span className="font-medium text-slate-700">{documents.length}</span> trên tổng số{' '}
              <span className="font-medium text-slate-700">{total}</span> tài liệu
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2">
                Trang {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <KnowledgeUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          loadDocuments();
        }}
      />

      {/* Detail / Edit / Action Modal */}
      <KnowledgeDetailModal
        documentId={selectedDocId}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedDocId(null);
        }}
        onRefresh={() => {
          loadDocuments();
        }}
      />
    </div>
  );
};
