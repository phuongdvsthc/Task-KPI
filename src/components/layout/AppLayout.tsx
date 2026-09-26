/**
 * Master Application Layout
 * Quản lý Sidebar, Header, chuyển đổi Tab nội dung, Modal cấu hình và Route synchronization
 * Quản lý trạng thái responsive và collapse của thanh điều hướng (Sidebar)
 * Tích hợp RouteGuard kiểm soát quyền truy cập URL trực tiếp theo capability (v0.9-C4.5-E2)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar, NavTabId } from './Sidebar';
import { Header } from './Header';
import { DashboardView } from '../dashboard/DashboardView';
import { StaffDashboardView } from '../dashboard/StaffDashboardView';
import { ManagerDashboardView } from '../dashboard/ManagerDashboardView';
import { ExecutiveDashboardView } from '../dashboard/ExecutiveDashboardView';
import { TaskList } from '../tasks/TaskList';
import { MetricEntryView } from '../metrics/MetricEntryView';
import { AdminLayout } from '../admin/AdminLayout';
import { AdminDashboardView } from '../admin/dashboard/AdminDashboardView';
import { RoleManagementView } from '../admin/access-control/RoleManagementView';
import { PlaceholderView } from '../common/PlaceholderView';
import { DailyReportManager } from '../daily-reports/DailyReportManager';
import { SupabaseConfigModal } from '../config/SupabaseConfigModal';
import { SecurityView } from '../account/SecurityView';
import { KpiFoundationLayout } from '../kpis/KpiFoundationLayout';
import { StaffMyKpiView } from '../kpis/assignments/StaffMyKpiView';
import { AdmissionLayout } from '../admissions/AdmissionLayout';
import { AIAssistantView } from '../ai/AIAssistantView';
import { useAuth } from '../../context/AuthContext';
import { useAuthorization } from '../../context/AuthorizationContext';
import { CAPABILITIES } from '../../types/authorization';
import { RouteGuard } from '../../routes/RouteGuard';
import { normalizeRoutePath } from '../../routes/routeMetadata';

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

export const AppLayout: React.FC = () => {
  const getCleanHashPath = (): string => {
    if (typeof window === 'undefined') return 'overview';
    const raw = window.location.hash || '';
    return normalizeRoutePath(raw);
  };

  const mapPathToNavTab = (path: string): NavTabId => {
    if (path === 'manager-dashboard') return 'manager-dashboard';
    if (path === 'executive-dashboard') return 'executive-dashboard';
    if (path === 'staff-dashboard') return 'staff-dashboard';
    if (path === 'metrics' || path === 'metric') return 'metrics';
    if (path === 'access-control' || path.startsWith('access-control/')) return 'access-control';
    if (path === 'admin' || path.startsWith('admin/')) return 'admin';
    if (path === 'admissions' || path.startsWith('admissions/')) return 'admissions';
    if (path === 'tasks' || path.startsWith('tasks/')) return 'tasks';
    if (path === 'kpis' || path.startsWith('kpis/')) return 'kpis';
    if (path === 'daily-reports' || path.startsWith('daily-reports/')) return 'daily-reports';
    if (path === 'ai-assistant' || path.startsWith('ai-assistant/')) return 'ai-assistant';
    if (path === 'account/security') return 'account/security';
    return 'overview';
  };

  const [currentHashPath, setCurrentHashPath] = useState<string>(getCleanHashPath);
  const [activeTab, setActiveTab] = useState<NavTabId>(() => mapPathToNavTab(getCleanHashPath()));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

  // Initialize Desktop Sidebar collapsed state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    if (window.innerWidth >= 768 && window.innerWidth < 1024) {
      return true;
    }
    return false;
  });

  const { isAdmin, systemRole, refreshProfile } = useAuth();
  const { hasCapability, hasAnyCapability } = useAuthorization();

  // Listen to window hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const cleanPath = getCleanHashPath();
      setCurrentHashPath(cleanPath);
      setActiveTab(mapPathToNavTab(cleanPath));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle window resize for adaptive collapse
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Safe fallback
      }
      return next;
    });
  };

  const handleSelectTab = (tab: NavTabId) => {
    setActiveTab(tab);
    if (tab === 'admissions') {
      window.location.hash = '#/admissions/overview';
    } else {
      window.location.hash = `#/${tab}`;
    }
  };

  const canManageAdmin = hasCapability(CAPABILITIES.ADMIN_USER_MANAGE) || hasCapability(CAPABILITIES.ACCESS_VIEW) || isAdmin;
  const canManageKpi = hasCapability(CAPABILITIES.KPI_MANAGE);

  return (
    <div id="app-container" className="flex min-h-screen bg-slate-100/70 antialiased overflow-x-hidden">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onOpenConfigModal={() => setIsConfigModalOpen(true)}
        />

        <main id="main-content-viewport" className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <RouteGuard path={currentHashPath} onNavigateTab={handleSelectTab}>
              {activeTab === 'manager-dashboard' ? (
                <ManagerDashboardView />
              ) : activeTab === 'executive-dashboard' ? (
                <ExecutiveDashboardView />
              ) : activeTab === 'staff-dashboard' ? (
                <StaffDashboardView />
              ) : activeTab === 'overview' ? (
                canManageAdmin ? (
                  <AdminDashboardView onNavigateTab={handleSelectTab} />
                ) : (
                  <DashboardView onNavigateTab={handleSelectTab} />
                )
              ) : activeTab === 'tasks' ? (
                <TaskList />
              ) : activeTab === 'metrics' ? (
                <MetricEntryView />
              ) : activeTab === 'kpis' ? (
                !canManageKpi && !isAdmin && systemRole === 'staff' ? (
                  <StaffMyKpiView />
                ) : (
                  <KpiFoundationLayout />
                )
              ) : activeTab === 'daily-reports' ? (
                <DailyReportManager />
              ) : activeTab === 'ai-assistant' ? (
                <AIAssistantView />
              ) : activeTab === 'account/security' ? (
                <SecurityView />
              ) : activeTab === 'admissions' ? (
                <AdmissionLayout />
              ) : activeTab === 'admin' ? (
                <AdminLayout />
              ) : activeTab === 'access-control' ? (
                <RoleManagementView />
              ) : (
                <PlaceholderView tab={activeTab} onNavigateTab={handleSelectTab} />
              )}
            </RouteGuard>
          </div>
        </main>
      </div>

      {/* Supabase Connection Configuration Modal */}
      <SupabaseConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onConfigSaved={() => {
          refreshProfile();
        }}
      />
    </div>
  );
};
