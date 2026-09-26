import React, { useState, useEffect } from 'react';
import { Target, Calendar, ListTree, BookOpen, Layers, Send, UserCheck, LayoutDashboard, Building2, BarChart3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { KpiManagerDashboardView } from './dashboard/KpiManagerDashboardView';
import { KpiExecutiveDashboardView } from './dashboard/KpiExecutiveDashboardView';
import { TeacherDepartmentKpiProgressDashboard } from './dashboard/TeacherDepartmentKpiProgressDashboard';
import { KpiPeriodView } from './periods/KpiPeriodView';
import { KpiObjectiveView } from './objectives/KpiObjectiveView';
import { KpiDefinitionView } from './definitions/KpiDefinitionView';
import { KpiTemplateView } from './templates/KpiTemplateView';
import { KpiAssignmentListView } from './assignments/KpiAssignmentListView';
import { StaffMyKpiView } from './assignments/StaffMyKpiView';

export const KpiFoundationLayout: React.FC = () => {
  const { systemRole, isAdmin } = useAuth();
  
  const canAccessManagerDashboard = systemRole === 'manager' || isAdmin;
  const canAccessExecutiveDashboard = systemRole === 'executive' || isAdmin;
  const isStrictlyExecutive = systemRole === 'executive' && !isAdmin;
  
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#/', '');
    if (hash.startsWith('kpis/executive-dashboard')) return 'executive-dashboard';
    if (hash.startsWith('kpis/progress-dashboard')) return 'progress-dashboard';
    if (hash.startsWith('kpis/dashboard') || hash.startsWith('kpis/overview')) return 'dashboard';
    if (hash.startsWith('kpis/assignments')) return 'assignments';
    if (hash.startsWith('kpis/periods')) return 'periods';
    if (hash.startsWith('kpis/objectives')) return 'objectives';
    if (hash.startsWith('kpis/definitions')) return 'definitions';
    if (hash.startsWith('kpis/templates')) return 'templates';
    if (hash.startsWith('kpis/my-kpi')) return 'my-kpi';
    
    if (canAccessExecutiveDashboard && isStrictlyExecutive) return 'executive-dashboard';
    if (canAccessManagerDashboard) return 'dashboard';
    return 'assignments';
  };

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'executive-dashboard' | 'progress-dashboard' | 'assignments' | 'periods' | 'objectives' | 'definitions' | 'templates' | 'my-kpi'
  >(getInitialTab);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveTab(getInitialTab());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [canAccessManagerDashboard, canAccessExecutiveDashboard, isStrictlyExecutive]);

  const handleTabChange = (
    tab: 'dashboard' | 'executive-dashboard' | 'progress-dashboard' | 'assignments' | 'periods' | 'objectives' | 'definitions' | 'templates' | 'my-kpi'
  ) => {
    setActiveTab(tab);
    window.location.hash = `#/kpis/${tab}`;
  };

  return (
    <div className="space-y-4">
      {/* KPI Foundation Navigation */}
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
        {canAccessExecutiveDashboard && (
          <button
            id="kpi-nav-executive-dashboard-tab"
            onClick={() => handleTabChange('executive-dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'executive-dashboard'
                ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'
            }`}
          >
            <Building2 className="h-4 w-4" />
            KPI toàn trường
          </button>
        )}
        
        {canAccessManagerDashboard && (
          <button
            id="kpi-nav-dashboard-tab"
            onClick={() => handleTabChange('dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Tổng quan quản lý
          </button>
        )}

        <button
          id="kpi-nav-progress-dashboard-tab"
          onClick={() => handleTabChange('progress-dashboard')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'progress-dashboard'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Tiến độ GV & Bộ phận
        </button>

        {/* Mutation-oriented tabs (hidden for strictly Executive role) */}
        {!isStrictlyExecutive && (
          <>
            <button
              id="kpi-nav-assignments-tab"
              onClick={() => handleTabChange('assignments')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'assignments'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                  : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'
              }`}
            >
              <Send className="h-4 w-4" />
              Giao KPI
            </button>
            <button
              onClick={() => handleTabChange('periods')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'periods'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                  : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'
              }`}
            >
              <Calendar className="h-4 w-4" />
              Kỳ đánh giá
            </button>
            <button
              onClick={() => handleTabChange('objectives')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'objectives'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                  : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'
              }`}
            >
              <ListTree className="h-4 w-4" />
              Mục tiêu
            </button>
            <button
              onClick={() => handleTabChange('definitions')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'definitions'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                  : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Danh mục KPI
            </button>
            <button
              onClick={() => handleTabChange('templates')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'templates'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                  : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'
              }`}
            >
              <Layers className="h-4 w-4" />
              Mẫu KPI
            </button>
            <button
              onClick={() => handleTabChange('my-kpi')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'my-kpi'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                  : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              KPI của tôi
            </button>
          </>
        )}
      </div>

      {activeTab === 'dashboard' && canAccessManagerDashboard ? (
        <KpiManagerDashboardView onNavigateToAssignments={() => handleTabChange('assignments')} />
      ) : activeTab === 'executive-dashboard' && canAccessExecutiveDashboard ? (
        <KpiExecutiveDashboardView />
      ) : activeTab === 'progress-dashboard' ? (
        <TeacherDepartmentKpiProgressDashboard onSelectAssignment={() => handleTabChange('assignments')} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
          {activeTab === 'assignments' && !isStrictlyExecutive && <KpiAssignmentListView />}
          {activeTab === 'periods' && !isStrictlyExecutive && <KpiPeriodView />}
          {activeTab === 'objectives' && !isStrictlyExecutive && <KpiObjectiveView />}
          {activeTab === 'definitions' && !isStrictlyExecutive && <KpiDefinitionView />}
          {activeTab === 'templates' && !isStrictlyExecutive && <KpiTemplateView />}
          {activeTab === 'my-kpi' && !isStrictlyExecutive && <StaffMyKpiView />}
        </div>
      )}
    </div>
  );
};
