/**
 * Route Authorization Metadata & Evaluation Engine (v0.9-C4.5-E2)
 * Central registry mapping frontend routes to required capabilities.
 */

import {
  CAPABILITIES,
  ACCESS_ROLES_VIEW,
  KPI_MANAGE,
  TASKS_MANAGE,
  REPORTS_VIEW,
  ADMISSIONS_SYNC,
  ACCESS_PERMISSIONS_MANAGE
} from '../types/authorization';

export type RouteAuthStatus =
  | 'authorized'
  | 'unauthenticated'
  | 'loading'
  | 'error'
  | 'forbidden'
  | 'not_found'
  | 'module_disabled';

export interface RouteAuthConfig {
  path: string;
  pattern: RegExp;
  module: string;
  title: string;
  authRequired: boolean;
  requiredCapability?: string;
  requiredAnyCapabilities?: string[];
  requiredAllCapabilities?: string[];
  adminSafetyFallback?: boolean;
}

/**
 * Global Route Authorization Registry
 */
export const ROUTE_REGISTRY: RouteAuthConfig[] = [
  // 1. Core / Landing routes (All authenticated users)
  {
    path: 'overview',
    pattern: /^(overview)?$/,
    module: 'dashboard',
    title: 'Tổng quan',
    authRequired: true,
  },
  {
    path: 'staff-dashboard',
    pattern: /^staff-dashboard$/,
    module: 'dashboard',
    title: 'Tổng quan cá nhân',
    authRequired: true,
  },
  {
    path: 'account/security',
    pattern: /^account\/security$/,
    module: 'account',
    title: 'Bảo mật tài khoản',
    authRequired: true,
  },

  // 2. Dashboards (Manager & Executive)
  {
    path: 'manager-dashboard',
    pattern: /^manager-dashboard$/,
    module: 'dashboard',
    title: 'Tổng quan đơn vị',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.DASHBOARD_MANAGER_VIEW,
      KPI_MANAGE,
      TASKS_MANAGE,
      'manager.view',
      'kpi.view',
      'task.view'
    ],
    adminSafetyFallback: true,
  },
  {
    path: 'executive-dashboard',
    pattern: /^executive-dashboard(\/.*)?$/,
    module: 'dashboard',
    title: 'Tổng quan toàn trường',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.DASHBOARD_EXECUTIVE_VIEW,
      'executive.view'
    ],
    adminSafetyFallback: true,
  },

  // 3. Operational Modules (Tasks, KPI, Daily Reports, Metrics, Reports)
  {
    path: 'tasks',
    pattern: /^tasks(\/.*)?$/,
    module: 'tasks',
    title: 'Quản lý công việc',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.TASKS_VIEW,
      'task.view'
    ],
  },
  {
    path: 'daily-reports',
    pattern: /^daily-reports(\/.*)?$/,
    module: 'daily-reports',
    title: 'Báo cáo hằng ngày',
    authRequired: true,
    requiredAnyCapabilities: [
      REPORTS_VIEW,
      'team_report.view'
    ],
  },
  {
    path: 'kpis',
    pattern: /^kpis(\/.*)?$/,
    module: 'kpis',
    title: 'Quản lý KPI',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.KPI_VIEW,
      'kpi.view'
    ],
  },
  {
    path: 'metrics',
    pattern: /^metrics(\/.*)?$/,
    module: 'metrics',
    title: 'Chỉ số đo lường',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.KPI_VIEW,
      'kpi.view'
    ],
  },
  {
    path: 'ai-assistant',
    pattern: /^ai-assistant(\/.*)?$/,
    module: 'ai-assistant',
    title: 'Trợ lý AI',
    authRequired: true,
    requiredCapability: CAPABILITIES.AI_CHAT_USE,
  },

  // 4. Admissions Module (Detailed Sub-routes & Action Scopes)
  // Admissions Sync / Google Sheets configuration (Requires sync / sheet capability)
  {
    path: 'admissions/sheets',
    pattern: /^admissions\/sheets(\/.*)?$/,
    module: 'admissions',
    title: 'Đồng bộ Google Sheets Tuyển sinh',
    authRequired: true,
    requiredAnyCapabilities: [
      ADMISSIONS_SYNC,
      CAPABILITIES.ADMISSIONS_SHEET_CONFIGURE,
      'admissions.manage_sheets',
      'admissions.sync_sheets'
    ],
    adminSafetyFallback: true,
  },
  // Admissions Main & Subtabs (Requires admissions.view capability)
  {
    path: 'admissions',
    pattern: /^admissions(\/(overview|programs|campaigns|plans|results)?)?$/,
    module: 'admissions',
    title: 'Quản lý Tuyển sinh',
    authRequired: true,
    requiredCapability: CAPABILITIES.ADMISSIONS_VIEW,
    adminSafetyFallback: true,
  },
  // Admissions Detailed & Dynamic Sub-routes (e.g. /admissions/campaigns/:id)
  {
    path: 'admissions/campaigns/:id',
    pattern: /^admissions\/campaigns\/.+$/,
    module: 'admissions',
    title: 'Chi tiết Đợt tuyển sinh',
    authRequired: true,
    requiredCapability: CAPABILITIES.ADMISSIONS_VIEW,
    adminSafetyFallback: true,
  },
  {
    path: 'admissions/plans/:id',
    pattern: /^admissions\/plans\/.+$/,
    module: 'admissions',
    title: 'Chi tiết Kế hoạch tuyển sinh',
    authRequired: true,
    requiredCapability: CAPABILITIES.ADMISSIONS_VIEW,
    adminSafetyFallback: true,
  },
  {
    path: 'admissions/results/:id',
    pattern: /^admissions\/results\/.+$/,
    module: 'admissions',
    title: 'Chi tiết Kết quả tuyển sinh',
    authRequired: true,
    requiredCapability: CAPABILITIES.ADMISSIONS_VIEW,
    adminSafetyFallback: true,
  },

  // 5. Access Control & Role Management
  {
    path: 'access-control',
    pattern: /^access-control(\/.*)?$/,
    module: 'access-control',
    title: 'Vai trò và Phân quyền',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.ACCESS_VIEW,
      CAPABILITIES.ACCESS_MANAGE,
      ACCESS_ROLES_VIEW,
      CAPABILITIES.ACCESS_ROLES_MANAGE,
    ],
    adminSafetyFallback: true,
  },

  // 6. Admin System Module Sub-routes
  {
    path: 'admin/users',
    pattern: /^admin\/users(\/.*)?$/,
    module: 'admin',
    title: 'Quản lý Người dùng',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.ADMIN_USER_MANAGE,
      CAPABILITIES.ADMIN_USER_VIEW,
      'user_org.users.manage',
      'user_org.users.view',
      CAPABILITIES.ACCESS_VIEW
    ],
    adminSafetyFallback: true,
  },
  {
    path: 'admin/organization-units',
    pattern: /^admin\/organization-units(\/.*)?$/,
    module: 'admin',
    title: 'Cơ cấu Tổ chức',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.ADMIN_UNIT_MANAGE,
      CAPABILITIES.ADMIN_UNIT_VIEW,
      'user_org.units.manage',
      'user_org.units.view',
      CAPABILITIES.ADMIN_USER_MANAGE
    ],
    adminSafetyFallback: true,
  },
  {
    path: 'admin/metrics',
    pattern: /^admin\/metrics(\/.*)?$/,
    module: 'admin',
    title: 'Quản lý Chỉ số Admin',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.ADMIN_USER_MANAGE,
      KPI_MANAGE,
      'system.settings.manage'
    ],
    adminSafetyFallback: true,
  },
  {
    path: 'admin/report-sources',
    pattern: /^admin\/report-sources(\/.*)?$/,
    module: 'admin',
    title: 'Kênh / Nguồn Báo cáo Admin',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.ADMIN_USER_MANAGE,
      'system.settings.manage'
    ],
    adminSafetyFallback: true,
  },
  {
    path: 'admin/settings',
    pattern: /^admin\/settings$/,
    module: 'admin',
    title: 'Cấu hình Hệ thống',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.SYSTEM_SETTINGS_MANAGE,
      CAPABILITIES.SYSTEM_SETTINGS_VIEW,
      CAPABILITIES.ADMIN_USER_MANAGE
    ],
    adminSafetyFallback: true,
  },
  {
    path: 'admin/ai-settings',
    pattern: /^admin\/ai-settings$/,
    module: 'admin',
    title: 'Cấu hình AI',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.AI_CONFIG_MANAGE,
      CAPABILITIES.SYSTEM_AI_MANAGE,
      CAPABILITIES.ADMIN_USER_MANAGE
    ],
    adminSafetyFallback: true,
  },
  {
    path: 'admin/knowledge-base',
    pattern: /^admin\/knowledge-base(\/.*)?$/,
    module: 'admin',
    title: 'Kho tài liệu AI',
    authRequired: true,
    requiredCapability: CAPABILITIES.AI_KNOWLEDGE_MANAGE,
    adminSafetyFallback: true,
  },
  {
    path: 'admin',
    pattern: /^admin(\/dashboard)?$/,
    module: 'admin',
    title: 'Quản trị Hệ thống',
    authRequired: true,
    requiredAnyCapabilities: [
      CAPABILITIES.ADMIN_USER_MANAGE,
      CAPABILITIES.ACCESS_VIEW,
      CAPABILITIES.DASHBOARD_ADMIN_VIEW
    ],
    adminSafetyFallback: true,
  }
];

/**
 * Normalizes a raw hash or path to a clean path string
 */
export function normalizeRoutePath(rawPath: string): string {
  if (!rawPath) return 'overview';
  let clean = rawPath.replace(/^#\/?/, '').replace(/^\//, '');
  const qIndex = clean.indexOf('?');
  if (qIndex !== -1) {
    clean = clean.substring(0, qIndex);
  }
  clean = clean.replace(/\/+$/, '');
  return clean || 'overview';
}

/**
 * Finds matching route configuration from registry
 */
export function matchRouteConfig(pathOrHash: string): RouteAuthConfig | null {
  const normalized = normalizeRoutePath(pathOrHash);
  for (const config of ROUTE_REGISTRY) {
    if (config.pattern.test(normalized)) {
      return config;
    }
  }
  return null;
}

export interface RouteEvaluationParams {
  pathOrHash: string;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isAuthzLoading: boolean;
  isAuthzReady: boolean;
  authzError: string | null;
  hasCapability: (cap: string) => boolean;
  hasAnyCapability: (caps: string[]) => boolean;
  hasAllCapabilities: (caps: string[]) => boolean;
  isAdmin?: boolean;
  systemRole?: string | null;
  enabledModules?: string[];
}

export interface RouteEvaluationResult {
  status: RouteAuthStatus;
  config: RouteAuthConfig | null;
  missingCapabilities: string[];
  reason?: string;
}

/**
 * Evaluates route authorization with strict precedence
 */
export function evaluateRouteAuthorization(params: RouteEvaluationParams): RouteEvaluationResult {
  const {
    pathOrHash,
    isAuthenticated,
    isAuthLoading,
    isAuthzLoading,
    isAuthzReady,
    authzError,
    hasCapability,
    hasAnyCapability,
    hasAllCapabilities,
    isAdmin,
    systemRole,
    enabledModules,
  } = params;

  // 1. Check Auth Loading State
  if (isAuthLoading) {
    return {
      status: 'loading',
      config: null,
      missingCapabilities: [],
      reason: 'Authentication state is loading',
    };
  }

  // 2. Check Authentication
  if (!isAuthenticated) {
    return {
      status: 'unauthenticated',
      config: null,
      missingCapabilities: [],
      reason: 'User is not authenticated (401)',
    };
  }

  // 3. Match Route in Registry
  const config = matchRouteConfig(pathOrHash);
  if (!config) {
    return {
      status: 'not_found',
      config: null,
      missingCapabilities: [],
      reason: 'Route does not exist (404)',
    };
  }

  // 3.1. Check Tenant Module Enablement
  if (config.module && enabledModules && enabledModules.length > 0) {
    const isModEnabled = (moduleCode: string): boolean => {
      const target = moduleCode.toLowerCase();
      return enabledModules.some((m) => {
        const mn = m.toLowerCase();
        if (mn === target) return true;
        if ((target === 'task' || target === 'tasks') && (mn === 'tasks' || mn === 'task')) return true;
        if ((target === 'kpi' || target === 'kpis') && (mn === 'kpis' || mn === 'kpi')) return true;
        if (target === 'team_report' || target === 'daily-reports') {
          if (mn === 'daily_reports' || mn === 'team_report' || mn === 'reports' || mn === 'daily-reports') return true;
        }
        if (target === 'ai' || target === 'ai-assistant') {
          if (mn === 'ai_assistant' || mn === 'ai' || mn === 'ai-assistant') return true;
        }
        if (target === 'access-control' || target === 'access_control') {
          if (mn === 'access_control' || mn === 'access-control') return true;
        }
        if (target === 'admin') {
          if (mn === 'system' || mn === 'access_control' || mn === 'user_org' || mn === 'admin') return true;
        }
        if (target === 'account') {
          if (mn === 'system' || mn === 'user_org' || mn === 'account' || mn === 'dashboard') return true;
        }
        if (target === 'metrics') {
          if (mn === 'kpi' || mn === 'kpis' || mn === 'metrics' || mn === 'system') return true;
        }
        return false;
      });
    };

    if (!isModEnabled(config.module)) {
      return {
        status: 'module_disabled',
        config,
        missingCapabilities: [],
        reason: `Phân hệ '${config.title}' (${config.module}) hiện chưa được kích hoạt cho cơ sở đào tạo này. Vui lòng liên hệ Quản trị viên để mở rộng cấu hình.`,
      };
    }
  }

  // 4. Check Authorization Loading State (Fail closed)
  if (isAuthzLoading || !isAuthzReady) {
    return {
      status: 'loading',
      config,
      missingCapabilities: [],
      reason: 'Authorization permissions are loading',
    };
  }

  // 5. Check Authorization Error (Fail closed)
  if (authzError) {
    return {
      status: 'error',
      config,
      missingCapabilities: [],
      reason: `Authorization load error: ${authzError}`,
    };
  }

  // 6. Admin Bootstrap Safety Check (Transition fallback)
  const isAdminUser = Boolean(isAdmin || systemRole === 'admin');
  if (config.adminSafetyFallback && isAdminUser) {
    return {
      status: 'authorized',
      config,
      missingCapabilities: [],
      reason: 'Admin bootstrap safety override (transition)',
    };
  }

  // 7. Check Single Required Capability
  const missing: string[] = [];
  if (config.requiredCapability) {
    if (!hasCapability(config.requiredCapability)) {
      missing.push(config.requiredCapability);
    }
  }

  // 8. Check Required Any Capabilities
  if (config.requiredAnyCapabilities && config.requiredAnyCapabilities.length > 0) {
    if (!hasAnyCapability(config.requiredAnyCapabilities)) {
      missing.push(...config.requiredAnyCapabilities);
    }
  }

  // 9. Check Required All Capabilities
  if (config.requiredAllCapabilities && config.requiredAllCapabilities.length > 0) {
    if (!hasAllCapabilities(config.requiredAllCapabilities)) {
      missing.push(...config.requiredAllCapabilities);
    }
  }

  if (missing.length > 0) {
    return {
      status: 'forbidden',
      config,
      missingCapabilities: missing,
      reason: `User lacks required capabilities: ${missing.join(', ')}`,
    };
  }

  return {
    status: 'authorized',
    config,
    missingCapabilities: [],
    reason: 'Authorized by capability',
  };
}
