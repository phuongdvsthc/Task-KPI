/**
 * Placeholder View Component
 * Đáp ứng yêu cầu:
 * "6. Chưa xây chức năng TASK, METRIC, KPI.
 *  7. Nếu chưa có chức năng thì hiển thị placeholder."
 */
import React from 'react';
import { 
  CheckSquare, 
  BarChart3, 
  Target, 
  FileText, 
  ShieldCheck, 
  Layers,
  Database,
  Sparkles,
  GraduationCap,
  Bot
} from 'lucide-react';
import { NavTabId } from '../layout/Sidebar';
import { useAuth } from '../../context/AuthContext';

interface PlaceholderViewProps {
  tab: NavTabId;
  onNavigateTab?: (tab: NavTabId) => void;
}

interface TabMeta {
  title: string;
  badge: string;
  description: string;
  icon: React.ElementType;
  plannedFeatures: string[];
  dbIntegration: string;
  readyForNextPhase: boolean;
}

const TAB_CONFIGS: Record<Exclude<NavTabId, 'overview'>, TabMeta> = {
  'manager-dashboard': {
    title: 'Tổng quan đơn vị',
    badge: 'Đang hoạt động',
    description: 'Bảng điều khiển tổng quan cho cán bộ quản lý đơn vị',
    icon: FileText,
    plannedFeatures: ['Tổng quan công việc', 'Báo cáo hằng ngày', 'Chỉ số công việc', 'KPI đơn vị', 'Nhân viên cần theo dõi', 'Nội dung cần chú ý'],
    dbIntegration: 'getUnifiedDashboard',
    readyForNextPhase: true
  },
  'executive-dashboard': {
    title: 'Tổng quan toàn trường',
    badge: 'Đang hoạt động',
    description: 'Bảng điều khiển tổng quan cho ban giám hiệu',
    icon: BarChart3,
    plannedFeatures: ['Chỉ số điều hành', 'Tình hình công việc', 'Tình hình báo cáo', 'Chỉ số công việc', 'KPI toàn trường'],
    dbIntegration: 'getUnifiedDashboard',
    readyForNextPhase: true
  },
  'staff-dashboard': {
    title: 'Tổng quan công việc cá nhân',
    badge: 'Đang hoạt động',
    description: 'Bảng điều khiển cá nhân cho cán bộ giảng viên',
    icon: FileText,
    plannedFeatures: ['Tổng quan công việc', 'Báo cáo hằng ngày', 'Chỉ số', 'KPI'],
    dbIntegration: 'getUnifiedDashboard',
    readyForNextPhase: true
  },
  'daily-reports': {
    title: 'Báo cáo hằng ngày',
    badge: 'Đang phát triển',
    description: 'Quản lý báo cáo hằng ngày',
    icon: FileText,
    plannedFeatures: [],
    dbIntegration: '',
    readyForNextPhase: false
  },
  tasks: {
    title: 'Phân hệ Quản lý Công Việc (Task Management)',
    badge: 'Sẵn sàng triển khai Giai đoạn 2',
    description: 'Chức năng giao việc, theo dõi tiến độ công việc theo đơn vị phòng ban, khoa và tổ bộ môn.',
    icon: CheckSquare,
    plannedFeatures: [
      'Giao việc theo đơn vị (organization_units) và cá nhân (profiles)',
      'Phân quyền phê duyệt: Trưởng đơn vị, Cán bộ phụ trách',
      'Theo dõi hạn hoàn thành, mức độ ưu tiên và trạng thái',
      'Tích hợp AI hỗ trợ phân rã mục tiêu lớn thành các đầu việc con',
    ],
    dbIntegration: 'Liên kết trực tiếp với organization_units và profiles qua lớp Service độc lập',
    readyForNextPhase: true,
  },
  metrics: {
    title: 'Phân hệ Chỉ Số Đo Lường (Metrics)',
    badge: 'Sẵn sàng triển khai Giai đoạn 2',
    description: 'Định nghĩa và thu thập các chỉ số hoạt động định lượng, định tính của trường học.',
    icon: BarChart3,
    plannedFeatures: [
      'Khung chỉ số giảng dạy, nghiên cứu khoa học và hành chính',
      'Đo lường tần suất theo tuần, tháng, quý và học kỳ',
      'Phân bổ chỉ tiêu về từng khoa, phòng ban chuyên trách',
    ],
    dbIntegration: 'Dữ liệu chỉ số gắn theo mã đơn vị (unit code)',
    readyForNextPhase: true,
  },
  kpis: {
    title: 'Phân hệ Đánh Giá KPI (Key Performance Indicators)',
    badge: 'Sẵn sàng triển khai Giai đoạn 2',
    description: 'Hệ thống thiết lập trọng số mục tiêu và đánh giá kết quả KPI theo chu kỳ học đường.',
    icon: Target,
    plannedFeatures: [
      'Thiết lập cây mục tiêu chiến lược của trường và đơn vị',
      'Tự động tính điểm trọng số KPI theo tỷ lệ hoàn thành',
      'Xếp loại thi đua cán bộ, giảng viên và tập thể đơn vị',
      'Trợ lý AI phân tích điểm nghẽn và đưa ra khuyến nghị cải thiện',
    ],
    dbIntegration: 'Tổng hợp từ bảng profiles và kết quả thực hiện của đơn vị',
    readyForNextPhase: true,
  },
  admin: {
    title: 'Phân hệ Quản Trị Hệ Thống (Admin Control)',
    badge: 'Chỉ dành cho Admin',
    description: 'Quản lý cơ cấu tổ chức trường học, danh mục đơn vị và phân quyền tài khoản.',
    icon: ShieldCheck,
    plannedFeatures: [
      'Quản lý cây đơn vị: Ban giám hiệu, Khoa, Phòng ban, Tổ bộ môn (organization_units)',
      'Quản lý hồ sơ cán bộ và gán vai trò hệ thống: admin, executive, manager, staff, viewer (profiles)',
      'Phân bổ nhân sự vào các đơn vị trực thuộc (organization_members)',
      'Phân quyền truy cập và kiểm toán hệ thống',
    ],
    dbIntegration: 'Đồng bộ trực tiếp 3 bảng organization_units, profiles, organization_members',
    readyForNextPhase: true,
  },
  'account/security': {
    title: 'Bảo mật tài khoản',
    badge: 'Đang phát triển',
    description: 'Quản lý thông tin đăng nhập và mật khẩu cá nhân.',
    icon: ShieldCheck,
    plannedFeatures: [
      'Đổi mật khẩu',
      'Xác thực 2 yếu tố (2FA)',
      'Quản lý thiết bị đăng nhập',
    ],
    dbIntegration: 'Bảo mật với Supabase Auth',
    readyForNextPhase: false,
  },
  'access-control': {
    title: 'Vai trò và phân quyền',
    badge: 'Quản trị hệ thống',
    description: 'Quản lý vai trò người dùng và ma trận phân quyền hệ thống.',
    icon: ShieldCheck,
    plannedFeatures: [
      'Xem danh sách vai trò hệ thống',
      'Cấu hình quyền cho từng vai trò',
      'Quản lý phạm vi truy cập dữ liệu',
    ],
    dbIntegration: 'Tích hợp access_roles và access_role_permissions',
    readyForNextPhase: true,
  },
  admissions: {
    title: 'Phân hệ Quản trị Tuyển sinh',
    badge: 'v0.8-B1 Hoạt động',
    description: 'Danh mục ngành, đợt tuyển sinh, kế hoạch chỉ tiêu và kết quả thực hiện.',
    icon: GraduationCap,
    plannedFeatures: [
      'Danh mục ngành / lớp đào tạo (v0.8-B1)',
      'Quản lý đợt tuyển sinh (v0.8-B2)',
      'Kế hoạch tuyển sinh & Giao chỉ tiêu (v0.8-B3)',
      'Kết quả tuyển sinh & Báo cáo tỷ lệ chuyển đổi (v0.8-B4)',
    ],
    dbIntegration: 'Đồng bộ PostgreSQL admission_groups, admission_programs với RLS',
    readyForNextPhase: true,
  },
  'ai-assistant': {
    title: 'Trợ lý AI (AI Assistant)',
    badge: 'v0.9-AI-B3 Hoạt động',
    description: 'Hỗ trợ tra cứu, giải đáp thắc mắc về công việc, quy trình và soạn thảo văn bản.',
    icon: Bot,
    plannedFeatures: [
      'Trò chuyện hỏi đáp streaming với AI Gateway',
      'Quản lý lịch sử hội thoại cá nhân',
      'Lưu trữ và phục hồi cuộc trò chuyện',
      'Tích hợp RAG tra cứu văn bản nội bộ (AI-C)',
    ],
    dbIntegration: 'Đồng bộ bảng ai_conversations, ai_messages với RLS',
    readyForNextPhase: true,
  },
};

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({ tab, onNavigateTab }) => {
  const { isAdmin } = useAuth();
  if (tab === 'overview') return null;

  const config = TAB_CONFIGS[tab];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Admin Quick Action for Metrics */}
      {tab === 'metrics' && isAdmin && onNavigateTab && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Phân hệ Quản trị Danh mục Chỉ số (/admin/metrics)
              </h4>
              <p className="text-xs text-slate-600">
                Bạn đang đăng nhập với quyền Admin. Bạn có thể thiết lập, thêm mới hoặc cấu hình chỉ số đo lường.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('admin')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-900 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800 transition-colors shadow-2xs shrink-0"
          >
            <span>Mở Quản Trị Chỉ Số</span>
            <ShieldCheck className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Notice Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-6">
          <div className="mb-4 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-900 border border-indigo-100 sm:mb-0">
            <Icon className="h-8 w-8" />
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-xl font-bold text-slate-900">{config.title}</h2>
              <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-semibold text-indigo-800">
                {config.badge}
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {config.description}
            </p>
          </div>
        </div>

        {/* Phase Checklist */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            <Layers className="h-4 w-4 text-indigo-700" />
            Các tính năng dự kiến triển khai trong giai đoạn tiếp theo:
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {config.plannedFeatures.map((feat, index) => (
              <div
                key={index}
                className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-700"
              >
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-900">
                  {index + 1}
                </div>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture & AI Scaffold Notice */}
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-slate-500 shrink-0" />
            <span>{config.dbIntegration}</span>
          </div>
          <div className="flex items-center gap-2 text-indigo-900 font-medium">
            <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>Đã tích hợp cấu trúc AI Service độc lập</span>
          </div>
        </div>
      </div>
    </div>
  );
};
