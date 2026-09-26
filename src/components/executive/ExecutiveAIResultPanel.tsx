import React from 'react';
import { 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Layers, 
  Calendar, 
  ShieldCheck, 
  Clock,
  Activity,
  FileText,
  Target
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { ExecutiveEvidenceList } from './ExecutiveEvidenceList';

export interface ExecutiveAIResultPanelProps {
  result: any;
  isLoading?: boolean;
  error?: string | null;
  onDrillDownEvidence?: (type: string, id: string, assignmentId?: string) => void;
  className?: string;
}

const getErrorMessage = (error: string) => {
  if (error.includes('AI_DISABLED')) return 'Tính năng AI hiện đang được tắt.';
  if (error.includes('AI_NOT_CONFIGURED')) return 'Tính năng AI chưa được cấu hình.';
  if (error.includes('TIMEOUT')) return 'Yêu cầu AI mất quá nhiều thời gian. Vui lòng thử lại.';
  if (error.includes('RATE_LIMITED')) return 'Hệ thống AI đang bận. Vui lòng thử lại sau.';
  if (error.includes('PROVIDER_UNAVAILABLE')) return 'Dịch vụ AI tạm thời chưa khả dụng.';
  if (error.includes('CONTENT_BLOCKED')) return 'AI không thể tạo nội dung cho yêu cầu này.';
  return 'AI chưa thể tạo kết quả hợp lệ. Vui lòng thử lại.';
};

export const ExecutiveAIResultPanel: React.FC<ExecutiveAIResultPanelProps> = ({
  result,
  isLoading,
  error,
  onDrillDownEvidence,
  className = ''
}) => {
  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 flex flex-col items-center justify-center text-center ${className}`}>
        <Sparkles className="w-8 h-8 text-blue-500 animate-pulse mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Đang phân tích dữ liệu điều hành...</h3>
        <p className="text-gray-500 dark:text-gray-400">AI đang tổng hợp dữ liệu điều hành...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md ${className}`}>
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Lỗi AI</h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              {getErrorMessage(error)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!result || !result.moduleOverview) return null;

  const { moduleOverview, metadata } = result;
  
  // All empty check
  if (
    moduleOverview.dailyReport.status === 'empty' &&
    moduleOverview.task.status === 'empty' &&
    moduleOverview.kpi.status === 'empty'
  ) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center ${className}`}>
        <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Info className="w-6 h-6 text-gray-500" />
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Chưa có đủ dữ liệu trong phạm vi và thời gian đã chọn để tạo bản tin điều hành.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bản tin điều hành</h2>
        </div>
        
        {result.summary && (
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm bg-white/50 dark:bg-gray-800/50 p-4 rounded-md shadow-sm border border-white/20 dark:border-gray-600/20">
            {result.summary}
          </p>
        )}
      </div>

      {/* Module Overview & Context */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 text-xs">
        
        {metadata?.scope?.targetUnitName && (
           <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Đơn vị: <span className="font-medium">{metadata.scope.targetUnitName}</span></span>
              {metadata.scope.scopeType === 'descendants' && (
                <span className="text-gray-500"> (Bao gồm đơn vị và đơn vị trực thuộc)</span>
              )}
           </div>
        )}
        
        {(!metadata?.scope?.targetUnitName) && (
           <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Phạm vi: <span className="font-medium">Toàn bộ phạm vi được phép xem</span></span>
           </div>
        )}

        {metadata?.reportingWindow?.dateFrom && (
           <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <Calendar className="w-3.5 h-3.5" />
              <span>Thời gian báo cáo: {new Date(metadata.reportingWindow.dateFrom).toLocaleDateString('vi-VN')} – {metadata.reportingWindow.dateTo ? new Date(metadata.reportingWindow.dateTo).toLocaleDateString('vi-VN') : 'Hiện tại'}</span>
           </div>
        )}

        {moduleOverview.kpi.status !== 'empty' && moduleOverview.kpi.kpiPeriod && (
           <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <Target className="w-3.5 h-3.5" />
              <span>Kỳ KPI: <span className="font-medium">{moduleOverview.kpi.kpiPeriod}</span></span>
           </div>
        )}

      </div>

      {/* Coverage area */}
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-2 items-center text-xs">
         <span className="text-gray-500 font-medium">Nguồn sử dụng:</span>
         
         {metadata?.includedModules?.includes('daily_report') ? (
            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
              Báo cáo ngày ({moduleOverview.dailyReport.count})
            </Badge>
         ) : (
            <Badge className="bg-gray-50 text-gray-400 border-gray-200 line-through">Báo cáo ngày</Badge>
         )}

         {metadata?.includedModules?.includes('task') ? (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200">
              Công việc ({moduleOverview.task.count})
            </Badge>
         ) : (
            <Badge className="bg-gray-50 text-gray-400 border-gray-200 line-through">Công việc</Badge>
         )}

         {metadata?.includedModules?.includes('kpi') ? (
            <Badge className="bg-purple-50 text-purple-700 border-purple-200">
              KPI ({moduleOverview.kpi.assignmentCount} bảng, {moduleOverview.kpi.itemCount} chỉ tiêu)
            </Badge>
         ) : (
            <Badge className="bg-gray-50 text-gray-400 border-gray-200 line-through">KPI</Badge>
         )}

         {metadata?.truncated && (
           <div className="w-full mt-2 text-amber-600 dark:text-amber-400 flex gap-1.5 items-center">
             <AlertCircle className="w-4 h-4" />
             <span>Kết quả được tạo từ một phần dữ liệu do giới hạn ngữ cảnh. Hãy mở dữ liệu gốc để kiểm tra đầy đủ.</span>
           </div>
         )}
      </div>

      <div className="p-5 space-y-8">
        
        {/* Highlights */}
        <section>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Điểm nổi bật
          </h3>
          {result.highlights?.length > 0 ? (
            <ul className="space-y-4">
              {result.highlights.map((item: any, idx: number) => (
                <li key={idx} className="bg-white dark:bg-gray-800 rounded-md">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{item.text}</p>
                  <ExecutiveEvidenceList 
                    evidenceIds={item.evidence} 
                    evidenceMap={result.evidenceMap} 
                    onDrillDown={onDrillDownEvidence} 
                  />
                </li>
              ))}
            </ul>
          ) : (
             <p className="text-sm text-gray-500 italic">Chưa ghi nhận điểm nổi bật trong phạm vi dữ liệu hiện có.</p>
          )}
        </section>

        {/* Issues */}
        <section>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            Vấn đề cần chú ý
          </h3>
          {result.issues?.length > 0 ? (
            <ul className="space-y-4">
              {result.issues.map((item: any, idx: number) => (
                <li key={item.groupId || item.id || idx} className="bg-rose-50/50 dark:bg-rose-900/10 p-3 rounded-md border border-rose-100 dark:border-rose-800/30">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {item.title || item.text}
                  </p>
                  {item.categories && item.categories.length > 0 && (
                     <div className="mt-2 flex flex-wrap gap-1">
                        {item.categories.map((c: string) => <Badge key={c} className="bg-rose-100 text-rose-700 px-1.5 py-0.5 text-[10px] uppercase">{c.replace(/_/g, ' ')}</Badge>)}
                     </div>
                  )}
                  <ExecutiveEvidenceList 
                    evidenceIds={item.evidence} 
                    evidenceMap={result.evidenceMap} 
                    onDrillDown={onDrillDownEvidence} 
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 italic">Không có vấn đề nào cần chú ý trong phạm vi dữ liệu này.</p>
          )}
        </section>

        {/* Follow Ups */}
        <section>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            Nội dung cần theo dõi
          </h3>
          {result.followUps?.length > 0 ? (
            <ul className="space-y-4">
              {result.followUps.map((item: any, idx: number) => (
                <li key={item.followUpId || idx} className="bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-md border border-indigo-100 dark:border-indigo-800/30">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                      {item.text}
                    </p>
                    {item.type === 'explicit' ? (
                       <Badge className="bg-blue-100 text-blue-700 shrink-0 text-[10px]">Đã ghi nhận</Badge>
                    ) : (
                       <Badge className="bg-indigo-100 text-indigo-700 shrink-0 text-[10px]">Gợi ý theo dõi</Badge>
                    )}
                  </div>
                  {item.category && (
                    <div className="mt-2">
                      <Badge className="bg-gray-100 text-gray-600 px-1.5 py-0.5 text-[10px] uppercase">{item.category.replace(/_/g, ' ')}</Badge>
                    </div>
                  )}
                  <ExecutiveEvidenceList 
                    evidenceIds={item.evidence} 
                    evidenceMap={result.evidenceMap} 
                    onDrillDown={onDrillDownEvidence} 
                  />
                </li>
              ))}
            </ul>
          ) : (
             <p className="text-sm text-gray-500 italic">Chưa có gợi ý theo dõi nào.</p>
          )}
        </section>

      </div>

      {/* Footer Disclaimer */}
      <div className="bg-gray-50 dark:bg-gray-800/80 px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-center">
        <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
          <Info className="w-3 h-3" />
          Nội dung AI chỉ hỗ trợ tổng hợp và gợi ý theo dõi. Vui lòng đối chiếu dữ liệu gốc khi cần.
        </p>
      </div>

    </div>
  );
};
