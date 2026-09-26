import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  BookOpen,
  CalendarDays,
  Target,
  BarChart3,
  FileSpreadsheet,
  Sparkles,
  ShieldCheck,
  Building2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAuthorization } from '../../context/AuthorizationContext';
import { ProgramListView } from './programs/ProgramListView';
import { CampaignListView } from './campaigns/CampaignListView';
import { AnnualPlanListView } from './plans/AnnualPlanListView';
import { ResultEntryView } from './results/ResultEntryView';
import { GoogleSheetsSyncView } from './sheets/GoogleSheetsSyncView';
import { AdmissionOverviewDashboard } from './overview/AdmissionOverviewDashboard';
import { AccessDeniedView } from '../common/AccessDeniedView';
import { CAPABILITIES } from '../../types/authorization';

export type AdmissionSubTab = 'overview' | 'programs' | 'campaigns' | 'plans' | 'results' | 'sheets';

export const AdmissionLayout: React.FC = () => {
  const { isAdmin, primaryUnit } = useAuth();
  const { can, hasAnyCapability } = useAuthorization();
  const hasOverviewAccess = can('admissions.view');
  const canManageSheets = hasAnyCapability([
    CAPABILITIES.ADMISSIONS_SYNC,
    CAPABILITIES.ADMISSIONS_SHEET_CONFIGURE,
    'admissions.sheet_sync_confirm',
    'admissions.manage_sheets',
    'admissions.sync_sheets'
  ]) || isAdmin;

  const getInitialSubTab = (): AdmissionSubTab => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash === 'admissions/campaigns') return 'campaigns';
    if (hash === 'admissions/plans') return 'plans';
    if (hash === 'admissions/results') return 'results';
    if (hash.startsWith('admissions/sheets')) return 'sheets';
    if (hash === 'admissions/programs') return 'programs';
    return 'overview';
  };

  const [activeSubTab, setActiveSubTab] = useState<AdmissionSubTab>(getInitialSubTab);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash === 'admissions/campaigns') setActiveSubTab('campaigns');
      else if (hash === 'admissions/plans') setActiveSubTab('plans');
      else if (hash === 'admissions/results') setActiveSubTab('results');
      else if (hash.startsWith('admissions/sheets')) setActiveSubTab('sheets');
      else if (hash === 'admissions/programs') setActiveSubTab('programs');
      else if (hash === 'admissions/overview' || hash === 'admissions' || hash === '') setActiveSubTab('overview');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectSubTab = (tab: AdmissionSubTab) => {
    setActiveSubTab(tab);
    window.location.hash = `#/admissions/${tab}`;
  };

  return (
    <div id="admissions-module-layout" className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto bg-white px-4 rounded-t-2xl pt-2 shadow-2xs">
        {hasOverviewAccess && (
          <button
            id="admission-subtab-overview"
            type="button"
            onClick={() => handleSelectSubTab('overview')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
              activeSubTab === 'overview'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Tổng quan tuyển sinh</span>
          </button>
        )}

        <button
          id="admission-subtab-programs"
          type="button"
          onClick={() => handleSelectSubTab('programs')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeSubTab === 'programs'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Danh mục ngành / lớp</span>
        </button>

        <button
          id="admission-subtab-campaigns"
          type="button"
          onClick={() => handleSelectSubTab('campaigns')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeSubTab === 'campaigns'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          <span>Đợt tuyển sinh</span>
        </button>

        <button
          id="admission-subtab-plans"
          type="button"
          onClick={() => handleSelectSubTab('plans')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeSubTab === 'plans'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <Target className="h-4 w-4" />
          <span>Kế hoạch tuyển sinh</span>
        </button>

        <button
          id="admission-subtab-results"
          type="button"
          onClick={() => handleSelectSubTab('results')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeSubTab === 'results'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Kết quả & Báo cáo</span>
        </button>

        {canManageSheets && (
          <button
            id="admission-subtab-sheets"
            type="button"
            onClick={() => handleSelectSubTab('sheets')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
              activeSubTab === 'sheets'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Đồng bộ Google Sheets</span>
          </button>
        )}
      </div>

      {/* Sub-tab Content Viewport */}
      <div>
        {activeSubTab === 'overview' && (
          hasOverviewAccess ? (
            <AdmissionOverviewDashboard />
          ) : (
            <AccessDeniedView
              requestedPath="admissions/overview"
              missingCapabilities={[CAPABILITIES.ADMISSIONS_VIEW]}
            />
          )
        )}

        {activeSubTab === 'programs' && <ProgramListView />}

        {activeSubTab === 'campaigns' && <CampaignListView />}

        {activeSubTab === 'plans' && <AnnualPlanListView />}

        {activeSubTab === 'results' && <ResultEntryView />}

        {activeSubTab === 'sheets' && (
          canManageSheets ? (
            <GoogleSheetsSyncView />
          ) : (
            <AccessDeniedView
              requestedPath="admissions/sheets"
              missingCapabilities={[CAPABILITIES.ADMISSIONS_SYNC, CAPABILITIES.ADMISSIONS_SHEET_CONFIGURE]}
            />
          )
        )}
      </div>
    </div>
  );
};
