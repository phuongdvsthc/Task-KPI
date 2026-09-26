import React, { useState, useEffect } from 'react';
import { MetricAdminView } from './metrics/MetricAdminView';
import { UserManagementView } from './users/UserManagementView';
import { UserForm } from './users/UserForm';
import { OrganizationListView } from './organizations/OrganizationListView';
import { OrganizationFormView } from './organizations/OrganizationFormView';
import { SystemSettingsView } from './settings/SystemSettingsView';
import { AiSettingsView } from './settings/AiSettingsView';
import { KnowledgeManagementView } from '../ai/admin/KnowledgeManagementView';
import { ReportSourceAdminView } from './ReportSourceAdminView';
import { AdminDashboardView } from './dashboard/AdminDashboardView';
import { useAuth } from '../../context/AuthContext';
import { useAuthorization } from '../../context/AuthorizationContext';
import { CAPABILITIES } from '../../types/authorization';
import { AccessDeniedView } from '../common/AccessDeniedView';

export const AdminLayout: React.FC = () => {
  const { isAdmin } = useAuth();
  const { hasCapability, hasAnyCapability } = useAuthorization();

  const canManageUsers = hasAnyCapability([CAPABILITIES.ADMIN_USER_MANAGE, CAPABILITIES.ADMIN_USER_VIEW, 'user_org.users.view', 'user_org.users.manage', CAPABILITIES.ACCESS_VIEW]) || isAdmin;
  const canManageOrgs = hasAnyCapability([CAPABILITIES.ADMIN_UNIT_MANAGE, CAPABILITIES.ADMIN_UNIT_VIEW, 'user_org.units.manage', 'user_org.units.view', CAPABILITIES.ADMIN_USER_MANAGE]) || isAdmin;
  const canManageMetrics = hasAnyCapability([CAPABILITIES.ADMIN_USER_MANAGE, CAPABILITIES.KPI_MANAGE, 'system.settings.manage']) || isAdmin;
  const canManageSettings = hasAnyCapability([CAPABILITIES.SYSTEM_SETTINGS_MANAGE, CAPABILITIES.SYSTEM_SETTINGS_VIEW, CAPABILITIES.ADMIN_USER_MANAGE]) || isAdmin;
  const canManageAi = hasAnyCapability([CAPABILITIES.SYSTEM_AI_MANAGE, CAPABILITIES.ADMIN_USER_MANAGE]) || isAdmin;
  const canManageKnowledge = hasCapability(CAPABILITIES.AI_KNOWLEDGE_MANAGE) || isAdmin;
  const canViewAdmissions = hasCapability(CAPABILITIES.ADMISSIONS_VIEW) || isAdmin;

  // Routes:
  // admin/dashboard
  // admin/metrics
  // admin/metrics/new
  // admin/metrics/:id/edit
  // admin/users
  // admin/users/new
  // admin/users/:id/edit
  const [currentRoute, setCurrentRoute] = useState<'dashboard' | 'metrics' | 'users' | 'users/new' | 'users/edit' | 'orgs' | 'orgs/new' | 'orgs/edit' | 'settings' | 'ai-settings' | 'knowledge-base' | 'report-sources' | 'report-sources/new' | 'report-sources/edit'>('dashboard');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const isDashboard = currentRoute === 'dashboard';
  const isUsers = currentRoute.startsWith('users');
  const isOrgs = currentRoute.startsWith('orgs');
  const isMetrics = currentRoute === 'metrics';
  const isReportSources = currentRoute.startsWith('report-sources');
  const isSettings = currentRoute === 'settings';
  const isAiSettings = currentRoute === 'ai-settings';
  const isKnowledgeBase = currentRoute === 'knowledge-base';

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash === 'admin/dashboard' || hash === 'admin') {
        setCurrentRoute('dashboard');
      } else if (hash === 'admin/report-sources/new') {
        setCurrentRoute('report-sources/new');
      } else if (hash.startsWith('admin/report-sources/') && hash.endsWith('/edit')) {
        setCurrentRoute('report-sources/edit');
      } else if (hash === 'admin/report-sources') {
        setCurrentRoute('report-sources');
      } else if (hash.startsWith('admin/metrics')) {
        setCurrentRoute('metrics');
      } else if (hash === 'admin/users/new') {
        setCurrentRoute('users/new');
        setSelectedUserId(null);
      } else if (hash.startsWith('admin/users/') && hash.endsWith('/edit')) {
        const parts = hash.split('/');
        if (parts.length >= 3) {
          setSelectedUserId(parts[2]);
          setCurrentRoute('users/edit');
        }
      } else if (hash === 'admin/organization-units/new') {
        setCurrentRoute('orgs/new');
        setSelectedOrgId(null);
      } else if (hash.startsWith('admin/organization-units/') && hash.endsWith('/edit')) {
        const parts = hash.split('/');
        if (parts.length >= 3) {
          setSelectedOrgId(parts[2]);
          setCurrentRoute('orgs/edit');
        }
      } else if (hash === 'admin/organization-units') {
        setCurrentRoute('orgs');
      } else if (hash === 'admin/ai-settings') {
        setCurrentRoute('ai-settings');
      } else if (hash === 'admin/knowledge-base') {
        setCurrentRoute('knowledge-base');
      } else if (hash === 'admin/settings') {
        setCurrentRoute('settings');
      } else if (hash === 'admin/users') {
        setCurrentRoute('users');
        setSelectedUserId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderTabs = () => {
    return (
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
        <a href="#/admin/dashboard" className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${isDashboard ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}`}>
          Tổng quan hệ thống
        </a>
        {canManageUsers && (
          <a href="#/admin/users" className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${isUsers ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}`}>
            Quản lý Người dùng
          </a>
        )}
        {canManageOrgs && (
          <a href="#/admin/organization-units" className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${isOrgs ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}`}>
            Cơ cấu tổ chức
          </a>
        )}
        {canManageMetrics && (
          <a href="#/admin/metrics" className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${isMetrics ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}`}>
            Quản lý Chỉ số
          </a>
        )}
        {canManageSettings && (
          <a href="#/admin/report-sources" className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${isReportSources ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}`}>
            Kênh / Nguồn báo cáo
          </a>
        )}
        {canViewAdmissions && (
          <a href="#/admissions" className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent">
            Danh mục Tuyển sinh
          </a>
        )}
        {canManageSettings && (
          <a href="#/admin/settings" className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${isSettings ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}`}>
            Cấu hình hệ thống
          </a>
        )}
        {canManageAi && (
          <a href="#/admin/ai-settings" className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${isAiSettings ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}`}>
            Cấu hình AI
          </a>
        )}
        {canManageKnowledge && (
          <a href="#/admin/knowledge-base" className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${isKnowledgeBase ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}`}>
            Kho tài liệu AI
          </a>
        )}
      </div>
    );
  };

  if (currentRoute === 'dashboard') {
    return (
      <div className="space-y-4">
        {renderTabs()}
        <AdminDashboardView />
      </div>
    );
  }

  if (currentRoute === 'metrics') {
    if (!canManageMetrics) {
      return <AccessDeniedView requestedPath="admin/metrics" missingCapabilities={[CAPABILITIES.ADMIN_USER_MANAGE, CAPABILITIES.KPI_MANAGE]} />;
    }
    return (
      <div className="space-y-4">
        {renderTabs()}
        <MetricAdminView />
      </div>
    );
  }

  if (currentRoute === 'orgs/new' || currentRoute === 'orgs/edit') {
    if (!canManageOrgs) {
      return <AccessDeniedView requestedPath="admin/organization-units" missingCapabilities={[CAPABILITIES.ADMIN_UNIT_MANAGE]} />;
    }
    return <OrganizationFormView id={selectedOrgId || undefined} />;
  }

  if (currentRoute === 'orgs') {
    if (!canManageOrgs) {
      return <AccessDeniedView requestedPath="admin/organization-units" missingCapabilities={[CAPABILITIES.ADMIN_UNIT_MANAGE]} />;
    }
    return (
      <div className="space-y-4">
        {renderTabs()}
        <OrganizationListView />
      </div>
    );
  }

  if (currentRoute === 'report-sources') {
    if (!canManageSettings) {
      return <AccessDeniedView requestedPath="admin/report-sources" missingCapabilities={[CAPABILITIES.ADMIN_USER_MANAGE]} />;
    }
    return (
      <div className="space-y-4">
        {renderTabs()}
        <ReportSourceAdminView />
      </div>
    );
  }

  if (currentRoute === 'settings') {
    if (!canManageSettings) {
      return <AccessDeniedView requestedPath="admin/settings" missingCapabilities={[CAPABILITIES.SYSTEM_SETTINGS_MANAGE]} />;
    }
    return (
      <div className="space-y-4">
        {renderTabs()}
        <SystemSettingsView />
      </div>
    );
  }

  if (currentRoute === 'ai-settings') {
    if (!canManageAi) {
      return <AccessDeniedView requestedPath="admin/ai-settings" missingCapabilities={[CAPABILITIES.SYSTEM_AI_MANAGE]} />;
    }
    return (
      <div className="space-y-4">
        {renderTabs()}
        <AiSettingsView />
      </div>
    );
  }

  if (currentRoute === 'knowledge-base') {
    if (!canManageKnowledge) {
      return <AccessDeniedView requestedPath="admin/knowledge-base" missingCapabilities={[CAPABILITIES.AI_KNOWLEDGE_MANAGE]} />;
    }
    return (
      <div className="space-y-4">
        {renderTabs()}
        <KnowledgeManagementView />
      </div>
    );
  }

  if (currentRoute === 'users/new' || currentRoute === 'users/edit') {
    if (!canManageUsers) {
      return <AccessDeniedView requestedPath="admin/users" missingCapabilities={[CAPABILITIES.ADMIN_USER_MANAGE]} />;
    }
    return <UserForm userId={selectedUserId} onBack={() => { window.location.hash = '/admin/users'; }} />;
  }

  if (!canManageUsers) {
    return <AccessDeniedView requestedPath="admin/users" missingCapabilities={[CAPABILITIES.ADMIN_USER_MANAGE]} />;
  }

  return (
    <div className="space-y-4">
      {renderTabs()}
      <UserManagementView />
    </div>
  );
};
