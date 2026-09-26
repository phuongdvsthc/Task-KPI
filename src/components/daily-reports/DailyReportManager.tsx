import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAuthorization } from '../../context/AuthorizationContext';
import { DailyReportCalendarView } from './DailyReportCalendarView';
import { ManagerTeamDailyReportView } from './manager/ManagerTeamDailyReportView';
import { dailyReportService } from '../../services/daily-report.service';
import { User, Users } from 'lucide-react';

export const DailyReportManager: React.FC = () => {
  const { systemRole, profile } = useAuth();
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const cleanRoute = currentHash.replace(/^#\/?/, '').split('?')[0];

  // Handle redirect from old /daily-reports/new -> /daily-reports?date=today
  if (cleanRoute === 'daily-reports/new') {
    const todayStr = new Date().toISOString().split('T')[0];
    const monthStr = todayStr.substring(0, 7);
    window.location.replace(`#/daily-reports?month=${monthStr}&date=${todayStr}`);
    return null;
  }

  // Handle redirect from old /daily-reports/:id/edit
  const editMatch = cleanRoute.match(/^daily-reports\/([^/]+)\/edit$/);
  if (editMatch) {
    const id = editMatch[1];
    dailyReportService
      .getDailyReportById(id)
      .then((rep) => {
        if (rep?.report_date) {
          const m = rep.report_date.substring(0, 7);
          window.location.replace(`#/daily-reports?month=${m}&date=${rep.report_date}`);
        } else {
          window.location.replace('#/daily-reports');
        }
      })
      .catch(() => {
        window.location.replace('#/daily-reports');
      });
    return null;
  }

  const { can, isLoading: isAuthLoading, error: authError } = useAuthorization();

  // Read view type from hash if present (?scope=personal vs ?scope=team)
  const isPersonalScope = currentHash.includes('scope=personal');

  if (isAuthLoading || authError) return null; // Fail closed

  // If user is regular staff, render Staff Calendar
  if (!can('report.view.team')) {
    return <DailyReportCalendarView key="calendar-staff-reports" />;
  }

  // If user is manager/admin, default to Manager Team Calendar
  // Allow toggling to personal report view if desired
  return (
    <div className="space-y-2">
      {/* Role View Toggle Bar for Managers & Admins */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 pt-2">
        <div className="flex items-center justify-end">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => {
                const targetHash = window.location.hash.includes('?')
                  ? window.location.hash.replace('scope=personal', 'scope=team')
                  : '#/daily-reports?scope=team';
                window.location.hash = targetHash.replace(/[?&]scope=personal/, '');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                !isPersonalScope
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Báo cáo Đội ngũ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const sep = window.location.hash.includes('?') ? '&' : '?';
                window.location.hash = `${window.location.hash}${sep}scope=personal`;
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                isPersonalScope
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Báo cáo Cá nhân</span>
            </button>
          </div>
        </div>
      </div>

      {isPersonalScope ? (
        <DailyReportCalendarView key="calendar-personal-reports" />
      ) : (
        <ManagerTeamDailyReportView key="calendar-team-reports" />
      )}
    </div>
  );
};

export default DailyReportManager;
