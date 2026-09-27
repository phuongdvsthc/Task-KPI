/**
 * Header Component
 * Bao gồm:
 * - Nút mở menu mobile (Drawer)
 * - Breadcrumbs / Tiêu đề trang
 * - Nút kiểm tra / cấu hình Supabase
 * - Hiển thị vai trò (Role Badge)
 * - Nút chuông thông báo (NotificationButton)
 * - Nút hồ sơ người dùng (User Profile Menu)
 */
import React, { useState, useMemo } from 'react';
import { 
  Menu, 
  User, 
  Shield, 
  Database,
  ChevronDown,
  LogOut,
  Settings,
  Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSystemSettings } from '../../context/SystemSettingsContext';
import { NavTabId } from './Sidebar';
import { UserProfileModal } from '../profile/UserProfileModal';
import { NotificationButton } from './NotificationButton';

interface HeaderProps {
  activeTab: NavTabId;
  onOpenMobileMenu: () => void;
  onOpenConfigModal: () => void;
}

const ROLE_BADGES: Record<string, { label: string; style: string }> = {
  admin: { label: 'Admin', style: 'bg-red-100 text-red-800 border-red-200' },
  executive: { label: 'Ban Giám Hiệu', style: 'bg-purple-100 text-purple-800 border-purple-200' },
  manager: { label: 'Trưởng Đơn Vị', style: 'bg-blue-100 text-blue-800 border-blue-200' },
  staff: { label: 'Cán Bộ / Giảng Viên', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  viewer: { label: 'Người Xem', style: 'bg-slate-100 text-slate-700 border-slate-200' },
  none: { label: 'Chưa phân quyền', style: 'bg-amber-100 text-amber-800 border-amber-200' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobileMenu,
  onOpenConfigModal,
}) => {
  const { profile, user, systemRole, signOut, isConfigured, isAdmin } = useAuth();
  const { settings } = useSystemSettings();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const TAB_TITLES = useMemo<Record<NavTabId, { title: string; subtitle: string }>>(() => ({
    'daily-reports': {
      title: 'Báo cáo hằng ngày',
      subtitle: 'Nhập và quản lý báo cáo công việc hằng ngày',
    },
    overview: {
      title: 'Tổng quan hệ thống',
      subtitle: `${settings?.appName || 'Nền tảng quản lý'} - ${settings?.organizationName || 'Trường học'}`,
    },
    tasks: {
      title: 'Quản lý công việc',
      subtitle: 'Giao việc, theo dõi tiến độ và phân công phòng ban',
    },
    metrics: {
      title: 'Chỉ số đo lường',
      subtitle: 'Hệ thống chỉ số vận hành và chất lượng đào tạo',
    },
    kpis: {
      title: 'Đánh giá KPI',
      subtitle: 'Theo dõi mục tiêu và kết quả thực hiện theo chu kỳ',
    },
    reports: {
      title: 'Báo cáo & Thống kê',
      subtitle: 'Báo cáo tổng hợp tiến độ và hiệu suất trường học',
    },
    admissions: {
      title: 'Quản lý Tuyển sinh',
      subtitle: 'Danh mục ngành/lớp, kế hoạch tuyển sinh và kết quả thực hiện',
    },
    admin: {
      title: 'Quản trị hệ thống',
      subtitle: 'Cấu hình đơn vị, phân quyền cán bộ và bảo mật',
    },
    'account/security': {
      title: 'Bảo mật tài khoản',
      subtitle: 'Quản lý thông tin đăng nhập và mật khẩu cá nhân',
    },
    'staff-dashboard': {
      title: 'Tổng quan cá nhân',
      subtitle: 'Theo dõi tiến độ công việc, báo cáo hằng ngày và KPI cá nhân',
    },
    'manager-dashboard': {
      title: 'Tổng quan đơn vị',
      subtitle: 'Giám sát tiến độ công việc, báo cáo hằng ngày và kết quả KPI của đơn vị',
    },
    'executive-dashboard': {
      title: 'Tổng quan toàn trường',
      subtitle: 'Theo dõi và đối chiếu số liệu công việc, báo cáo hằng năm và KPI toàn trường',
    },
    'access-control': {
      title: 'Vai trò & Phân quyền',
      subtitle: 'Quản lý vai trò và ma trận quyền hệ thống',
    },
    'ai-assistant': {
      title: 'Trợ lý AI',
      subtitle: 'Trợ lý thông minh hỗ trợ giải đáp, tra cứu và soạn thảo nội dung',
    },
  }), [settings]);

  const currentTabInfo = useMemo(() => {
    if (activeTab === 'overview' && systemRole === 'staff') {
      return {
        title: 'Tổng quan cá nhân',
        subtitle: 'Theo dõi tiến độ công việc, báo cáo hằng ngày và KPI cá nhân',
      };
    }
    return TAB_TITLES[activeTab] || TAB_TITLES.overview;
  }, [activeTab, systemRole, TAB_TITLES]);
  const roleBadge = systemRole ? (ROLE_BADGES[systemRole] || ROLE_BADGES.staff) : ROLE_BADGES.none;

  return (
    <>
      <header
        id="app-header"
        className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 backdrop-blur-xs sm:px-6 transition-colors"
      >
        {/* Left Side: Mobile Menu Button & Tab Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            id="mobile-menu-toggle-btn"
            type="button"
            onClick={onOpenMobileMenu}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 md:hidden transition-colors"
            aria-label="Mở menu điều hướng"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex flex-col min-w-0">
            <h1 className="truncate text-base font-bold text-slate-900 dark:text-white sm:text-lg">
              {currentTabInfo.title}
            </h1>
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 font-medium sm:inline-block truncate">
              {currentTabInfo.subtitle}
            </span>
          </div>
        </div>

        {/* Right Side: Indicators, Notification Bell & Profile Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Supabase Status Indicator (Admin only) */}
          {isAdmin && (
            <button
              id="supabase-status-btn"
              type="button"
              onClick={onOpenConfigModal}
              aria-label="Cấu hình kết nối Supabase PostgreSQL"
              className={`hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors ${
                isConfigured
                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                  : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
              }`}
              title="Cấu hình kết nối Supabase PostgreSQL"
            >
              <Database className="h-3.5 w-3.5" />
              <span className="hidden md:inline">
                {isConfigured ? 'Supabase: Đã kết nối' : 'Cấu hình Supabase'}
              </span>
            </button>
          )}

          {/* Admin Read-only Reporting Mode Badge */}
          {isAdmin && (activeTab === 'manager-dashboard' || activeTab === 'executive-dashboard') && (
            <div
              id="admin-readonly-reporting-badge"
              className="hidden sm:flex items-center gap-1.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300"
              title="Quản trị viên đang xem dữ liệu ở chế độ chỉ đọc"
            >
              <Eye className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Chế độ xem báo cáo</span>
            </div>
          )}

          {/* User Role Badge (Hidden on mobile) */}
          <div
            id="user-role-badge"
            className={`hidden md:flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${roleBadge.style}`}
          >
            <Shield className="h-3 w-3" />
            <span>{roleBadge.label}</span>
          </div>

          {/* Notification Button Component */}
          <NotificationButton />

          {/* User Profile Menu */}
          <div className="relative">
            <button
              id="user-dropdown-toggle-btn"
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-label="Menu tài khoản cá nhân"
              aria-expanded={isDropdownOpen}
              className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white shadow-2xs"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="hidden max-w-[120px] truncate text-xs font-medium lg:inline-block">
                {profile?.full_name || user?.email?.split('@')[0] || 'Tài khoản'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                  aria-hidden="true"
                />
                <div
                  id="user-dropdown-menu"
                  role="menu"
                  aria-label="Tùy chọn người dùng"
                  className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 shadow-xl origin-top-right transition-all"
                >
                  <div className="border-b border-slate-100 dark:border-slate-700 px-3 py-2">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                      {profile?.full_name || 'Cán bộ'}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {profile?.email || user?.email}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      id="view-profile-btn"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-hidden focus-visible:bg-slate-100 transition-colors"
                    >
                      <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span>Xem hồ sơ chi tiết</span>
                    </button>
                    
                    <button
                      id="change-password-btn"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        window.location.hash = '#/account/security';
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-hidden focus-visible:bg-slate-100 transition-colors"
                    >
                      <Shield className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span>Đổi mật khẩu</span>
                    </button>

                    {isAdmin && (
                      <button
                        id="open-config-btn"
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onOpenConfigModal();
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-hidden focus-visible:bg-slate-100 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span>Cài đặt kết nối Database</span>
                      </button>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700 pt-1">
                    <button
                      id="header-logout-btn"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 focus:outline-hidden focus-visible:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
};
