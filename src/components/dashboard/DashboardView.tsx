/**
 * Dashboard View (Trang Tổng quan / Dashboard)
 * Hiển thị dữ liệu thực từ 3 bảng:
 * - public.profiles (qua user.id)
 * - public.organization_members (qua user_id)
 * - public.organization_units (danh sách đơn vị trực thuộc và toàn trường)
 * 
 * Nguyên tắc nghiêm ngặt:
 * - KHÔNG dùng fallback giả lập "Trường học" hay role = "staff"
 * - Hiển thị lỗi rõ ràng nếu query thất bại hoặc thiếu hồ sơ
 * - Hiển thị hướng dẫn chẩn đoán RLS & SQL khi cần thiết
 */
import React, { useEffect, useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Database, 
  Sparkles, 
  Clock, 
  ArrowRight,
  GraduationCap,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSystemSettings } from '../../context/SystemSettingsContext';
import { organizationService } from '../../services/organizationService';
import { NavTabId } from '../layout/Sidebar';

interface DashboardViewProps {
  onNavigateTab: (tab: NavTabId) => void;
}

const ROLE_LABELS: Record<string, { label: string; desc: string; badge: string }> = {
  admin: { 
    label: 'Quản trị viên (Admin)', 
    desc: 'Toàn quyền cấu hình quản trị hệ thống', 
    badge: 'bg-red-50 text-red-700 border-red-200' 
  },
  executive: { 
    label: 'Ban giám hiệu (Executive)', 
    desc: 'Xem báo cáo toàn diện và phê duyệt KPI', 
    badge: 'bg-purple-50 text-purple-700 border-purple-200' 
  },
  manager: { 
    label: 'Trưởng/Phó đơn vị (Manager)', 
    desc: 'Quản lý công việc và KPI của đơn vị trực thuộc', 
    badge: 'bg-blue-50 text-blue-700 border-blue-200' 
  },
  staff: { 
    label: 'Cán bộ / Giảng viên (Staff)', 
    desc: 'Thực hiện công việc và báo cáo chỉ số cá nhân', 
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' 
  },
  viewer: { 
    label: 'Người xem (Viewer)', 
    desc: 'Chỉ xem dữ liệu được phân quyền', 
    badge: 'bg-slate-50 text-slate-700 border-slate-200' 
  },
};

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab }) => {
  const { 
    profile, 
    user, 
    primaryUnit, 
    allUnits, 
    systemRole, 
    isAdmin, 
    profileError, 
    roleError, 
    unitError, 
    isRlsBlocked,
    refreshProfile 
  } = useAuth();
  const { settings } = useSystemSettings();

  const [totalUnitsCount, setTotalUnitsCount] = useState<number | null>(null);
  const [unitsQueryError, setUnitsQueryError] = useState<string | null>(null);
  const [loadingUnits, setLoadingUnits] = useState<boolean>(true);
  const [showSqlGuide, setShowSqlGuide] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  const fetchUnitsData = async () => {
    setLoadingUnits(true);
    setUnitsQueryError(null);
    try {
      const res = await organizationService.getUnitsWithStatus(true);
      if (res.error) {
        setUnitsQueryError(res.error);
        setTotalUnitsCount(null);
      } else {
        setTotalUnitsCount(res.count);
        setUnitsQueryError(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUnitsQueryError(`Lỗi kết nối cơ sở dữ liệu: ${msg}`);
      setTotalUnitsCount(null);
    } finally {
      setLoadingUnits(false);
    }
  };

  useEffect(() => {
    fetchUnitsData();
  }, []);

  const hasAnyError = Boolean(profileError || roleError || unitError || unitsQueryError || isRlsBlocked);

  const recommendedSql = `-- ===================================================================
-- SQL SỬA LỖI & THIẾT LẬP DỮ LIỆU CHUẨN TRÊN SUPABASE POSTGRESQL
-- Chạy đoạn script này trong Supabase Dashboard -> SQL Editor
-- ===================================================================

-- 1. Bật RLS trên 3 bảng (Bảo mật tiêu chuẩn)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 2. Thiết lập RLS Policies cho bảng profiles
-- Cho phép user đọc profile của chính mình hoặc admin đọc tất cả
DROP POLICY IF EXISTS "Allow user to read own profile" ON public.profiles;
CREATE POLICY "Allow user to read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR (SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Allow user to update own profile" ON public.profiles;
CREATE POLICY "Allow user to update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow admin full access to profiles" ON public.profiles;
CREATE POLICY "Allow admin full access to profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING ((SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- 3. Thiết lập RLS Policies cho bảng organization_units (Tất cả user đã login đều được đọc)
DROP POLICY IF EXISTS "Allow authenticated users to read organization_units" ON public.organization_units;
CREATE POLICY "Allow authenticated users to read organization_units"
  ON public.organization_units
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin to manage organization_units" ON public.organization_units;
CREATE POLICY "Allow admin to manage organization_units"
  ON public.organization_units
  FOR ALL
  TO authenticated
  USING ((SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- 4. Thiết lập RLS Policies cho bảng organization_members
DROP POLICY IF EXISTS "Allow authenticated users to read organization_members" ON public.organization_members;
CREATE POLICY "Allow authenticated users to read organization_members"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin to manage organization_members" ON public.organization_members;
CREATE POLICY "Allow admin to manage organization_members"
  ON public.organization_members
  FOR ALL
  TO authenticated
  USING ((SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- 5. Tạo/Cập nhật Hồ sơ Admin cho User đang đăng nhập hiện tại: ${user?.email || 'admin@school.edu.vn'}
-- (User ID: ${user?.id || '<user_id>'})
INSERT INTO public.profiles (
  id,
  full_name,
  email,
  system_role,
  job_title,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '${user?.id || 'PASTE_AUTH_USER_ID_HERE'}',
  'Quản trị viên Hệ thống',
  '${user?.email || 'admin@school.edu.vn'}',
  'admin',
  'Trưởng phòng CNTT / Quản trị hệ thống',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE 
SET 
  system_role = 'admin',
  full_name = EXCLUDED.full_name,
  job_title = EXCLUDED.job_title,
  is_active = true,
  updated_at = NOW();
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(recommendedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-900 text-white font-bold text-lg shadow-xs">
              <GraduationCap className="h-6 w-6 text-indigo-200" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {profile?.full_name ? `Xin chào, ${profile.full_name}!` : (user?.email ? `Tài khoản: ${user.email}` : 'Xin chào!')}
                </h2>
                {systemRole && (
                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${ROLE_LABELS[systemRole]?.badge || 'bg-slate-100 text-slate-700'}`}>
                    <ShieldCheck className="h-3 w-3" />
                    {ROLE_LABELS[systemRole]?.label || systemRole}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {profile?.job_title 
                  ? `${profile.job_title} • ${settings?.appName || 'School Task & KPI'}`
                  : settings?.organizationName || 'Nền tảng Quản lý Hiệu suất'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="refresh-dashboard-btn"
              onClick={() => {
                refreshProfile();
                fetchUnitsData();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              title="Tải lại dữ liệu từ Supabase"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
              <span>Làm mới</span>
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 font-medium">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {new Date().toLocaleDateString('vi-VN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* RLS & Diagnostic Warning Banner (if errors detected) */}
      {hasAnyError && (
        <div id="diagnostic-error-banner" className="rounded-xl border border-amber-300 bg-amber-50/90 p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-amber-900">
                Phát hiện cảnh báo trạng thái dữ liệu Supabase
              </h4>
              <div className="mt-2 space-y-1.5 text-xs text-amber-800">
                {profileError && (
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600 shrink-0" />
                    <strong>Hồ sơ người dùng:</strong> {profileError}
                  </p>
                )}
                {roleError && !systemRole && (
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600 shrink-0" />
                    <strong>Phân quyền:</strong> {roleError}
                  </p>
                )}
                {unitError && (
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600 shrink-0" />
                    <strong>Đơn vị trực thuộc:</strong> {unitError}
                  </p>
                )}
                {unitsQueryError && (
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600 shrink-0" />
                    <strong>Danh sách đơn vị:</strong> {unitsQueryError}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  id="toggle-sql-guide-btn"
                  onClick={() => setShowSqlGuide(!showSqlGuide)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 transition-colors"
                >
                  {showSqlGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  <span>{showSqlGuide ? 'Ẩn SQL khắc phục' : 'Xem SQL thiết lập Profile & RLS Policy chuẩn'}</span>
                </button>
              </div>

              {/* Collapsible SQL helper */}
              {showSqlGuide && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-slate-900 p-4 text-slate-100 font-mono text-xs overflow-x-auto">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
                    <span className="text-[11px] text-slate-400 font-sans">
                      Script SQL khắc phục phân quyền Admin & RLS Policies (Không tắt RLS)
                    </span>
                    <button
                      id="copy-sql-btn"
                      onClick={handleCopySql}
                      className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-700 px-2 py-1 text-[11px] text-white transition-colors"
                    >
                      {copiedSql ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedSql ? 'Đã sao chép!' : 'Sao chép SQL'}</span>
                    </button>
                  </div>
                  <pre className="whitespace-pre overflow-x-auto text-[11px] leading-relaxed text-emerald-400">
                    {recommendedSql}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* System Status & Architecture Overview - 4 Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Role */}
        <div id="card-system-role" className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Phân Quyền Hệ Thống
            </span>
            <ShieldCheck className="h-4 w-4 text-indigo-700" />
          </div>
          <div className="mt-2">
            {systemRole ? (
              <>
                <p className="text-base font-bold text-slate-900 capitalize">
                  {ROLE_LABELS[systemRole]?.label || systemRole}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {ROLE_LABELS[systemRole]?.desc || 'Quyền hạn người dùng'}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-red-600">
                  Không thể xác định quyền người dùng.
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Chưa có phân quyền trong public.profiles
                </p>
              </>
            )}
          </div>
        </div>

        {/* Card 2: Primary Unit */}
        <div id="card-primary-unit" className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Đơn Vị Trực Thuộc
            </span>
            <Building2 className="h-4 w-4 text-indigo-700" />
          </div>
          <div className="mt-2">
            {unitError ? (
              <>
                <p className="text-sm font-bold text-amber-700">
                  Không thể đọc dữ liệu đơn vị.
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Lỗi truy vấn organization_members
                </p>
              </>
            ) : primaryUnit ? (
              <>
                <p className="text-base font-bold truncate text-slate-900" title={primaryUnit.name}>
                  {primaryUnit.name}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Mã: <span className="font-mono font-medium">{primaryUnit.code}</span>
                  {allUnits.length > 1 && ` (+${allUnits.length - 1} đơn vị khác)`}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-700">
                  Chưa phân công đơn vị
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Chưa phân công trong hồ sơ tổ chức
                </p>
              </>
            )}
          </div>
        </div>

        {/* Card 3: Supabase Database */}
        <div id="card-supabase-units" className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cơ sở dữ liệu
            </span>
            <Database className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            {loadingUnits ? (
              <p className="text-sm font-medium text-slate-500">Đang tải dữ liệu...</p>
            ) : unitsQueryError ? (
              <>
                <p className="text-sm font-bold text-red-600">
                  Không thể đọc dữ liệu đơn vị.
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={unitsQueryError}>
                  Lỗi đọc dữ liệu đơn vị
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-bold text-slate-900">
                  {totalUnitsCount !== null ? `${totalUnitsCount} Đơn vị` : '0 Đơn vị'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Đơn vị đang hoạt động trong toàn trường
                </p>
              </>
            )}
          </div>
        </div>

        {/* Card 4: AI Service Structure */}
        <div id="card-ai-service" className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dịch vụ AI
            </span>
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <p className="text-base font-bold text-slate-900">
              Sẵn sàng
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Khung phân tích KPI & Báo cáo
            </p>
          </div>
        </div>
      </div>

      {/* Workspace & Navigation Cards */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900">
            Không Gian Làm Việc & Phân Hệ Chức Năng
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Chọn một phân hệ bên dưới hoặc truy cập nhanh qua Menu thanh điều hướng bên trái.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div 
            id="nav-card-tasks"
            onClick={() => onNavigateTab('tasks')}
            className="group cursor-pointer rounded-lg border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-900">
                1. Quản lý Công việc
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-slate-500 line-clamp-2">
              Theo dõi danh sách công việc, phân công nhiệm vụ và tiến độ các khoa/phòng ban.
            </p>
          </div>

          <div 
            id="nav-card-metrics"
            onClick={() => onNavigateTab('metrics')}
            className="group cursor-pointer rounded-lg border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-900">
                2. Chỉ số Hoạt động
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-slate-500 line-clamp-2">
              Bộ chỉ số đo lường hiệu quả hoạt động đào tạo, hành chính và nghiên cứu khoa học.
            </p>
          </div>

          <div 
            id="nav-card-kpis"
            onClick={() => onNavigateTab('kpis')}
            className="group cursor-pointer rounded-lg border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-900">
                3. Đánh giá KPI
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-slate-500 line-clamp-2">
              Đánh giá KPI theo chu kỳ học kỳ, tính điểm trọng số và xếp loại thi đua.
            </p>
          </div>

          {/* Đã ẩn shortcut "Báo cáo & Thống kê" (trỏ tới PlaceholderView /reports) theo quyết định v0.7-F2 */}

          {isAdmin && (
            <div 
              id="nav-card-admin"
              onClick={() => onNavigateTab('admin')}
              className="group cursor-pointer rounded-lg border border-red-200 bg-red-50/20 p-4 hover:border-red-300 hover:bg-red-50/40 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-red-900">
                  5. Quản trị Hệ thống
                </span>
                <ArrowRight className="h-4 w-4 text-red-400 group-hover:text-red-600 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 line-clamp-2">
                Quản lý chỉ số hoạt động, cơ cấu tổ chức và phân quyền người dùng.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
