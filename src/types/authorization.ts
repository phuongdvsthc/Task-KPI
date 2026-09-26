export type ScopeCode = 'none' | 'own' | 'unit' | 'unit_tree' | 'all';

export const CAPABILITIES = {
  // Admissions capabilities (12 unique)
  ADMISSIONS_VIEW: 'admissions.view',
  ADMISSIONS_MANAGE: 'admissions.campaign_manage',
  ADMISSIONS_CATALOG_MANAGE: 'admissions.catalog_manage',
  ADMISSIONS_PLAN_MANAGE: 'admissions.plan_manage',
  ADMISSIONS_RESULT_UPDATE: 'admissions.result_update',
  ADMISSIONS_ALLOCATE: 'admissions.allocate',
  ADMISSIONS_LOCK: 'admissions.lock',
  ADMISSIONS_REOPEN: 'admissions.reopen',
  ADMISSIONS_EXPORT: 'admissions.export',
  ADMISSIONS_SHEET_CONFIGURE: 'admissions.sheet_configure',
  ADMISSIONS_SHEET_VALIDATE: 'admissions.sheet_validate',
  ADMISSIONS_SYNC: 'admissions.sheet_sync_confirm',

  // Access Control & Roles (7 unique)
  ACCESS_VIEW: 'access_control.roles.view',
  ACCESS_ROLES_MANAGE: 'access_control.roles.manage',
  ACCESS_PERMISSIONS_VIEW: 'access_control.permissions.view',
  ACCESS_MANAGE: 'access_control.permissions.manage',
  ACCESS_USER_ROLES_VIEW: 'access_control.user_roles.view',
  ACCESS_USER_ROLES_ASSIGN: 'access_control.user_roles.assign',
  ACCESS_AUDIT_VIEW: 'access_control.audit.view',

  // Admin & Organization Users (4 unique)
  ADMIN_USER_MANAGE: 'user_org.users.manage',
  ADMIN_USER_VIEW: 'user_org.users.view',
  ADMIN_UNIT_MANAGE: 'user_org.units.manage',
  ADMIN_UNIT_VIEW: 'user_org.units.view',

  // System Settings (4 unique)
  SYSTEM_SETTINGS_VIEW: 'system.settings.view',
  SYSTEM_SETTINGS_MANAGE: 'system.settings.manage',
  SYSTEM_AI_MANAGE: 'system.ai_provider.manage',
  SYSTEM_INTEGRATION_MANAGE: 'system.integration.manage',

  // Dashboards (4 unique)
  DASHBOARD_PERSONAL_VIEW: 'dashboard.personal.view',
  DASHBOARD_MANAGER_VIEW: 'dashboard.manager.view',
  DASHBOARD_EXECUTIVE_VIEW: 'dashboard.executive.view',
  DASHBOARD_ADMIN_VIEW: 'dashboard.admin.view',

  // Tasks (6 unique)
  TASKS_VIEW: 'task.view',
  TASKS_MANAGE: 'task.create',
  TASKS_UPDATE: 'task.update',
  TASKS_DELETE: 'task.delete',
  TASKS_ASSIGN: 'task.assign',
  TASKS_APPROVE: 'task.approve',

  // KPI (8 unique)
  KPI_VIEW: 'kpi.view',
  KPI_CREATE: 'kpi.create',
  KPI_MANAGE: 'kpi.assign',
  KPI_UPDATE_ACTUAL: 'kpi.update_actual',
  KPI_REVIEW: 'kpi.review',
  KPI_LOCK: 'kpi.lock',
  KPI_REOPEN: 'kpi.reopen',
  KPI_DELETE: 'kpi.delete',

  // Daily Reports & Team Reports (4 unique)
  REPORTS_VIEW: 'team_report.view',
  DAILY_REPORTS_REVIEW: 'team_report.review',
  DAILY_REPORTS_REMIND: 'team_report.remind',
  DAILY_REPORTS_EXPORT: 'team_report.export',

  // Notifications (4 unique)
  NOTIFICATION_VIEW: 'notification.view',
  NOTIFICATION_SEND: 'notification.send',
  NOTIFICATION_REMIND: 'notification.remind',
  NOTIFICATION_BROADCAST: 'notification.broadcast',

  // AI Assistant & Evidence (14 unique)
  AI_GENERATE: 'ai.generate',
  AI_USAGE_VIEW: 'ai.usage.view',
  AI_PROMPT_MANAGE: 'ai.prompt_manage',
  AI_AUDIT_VIEW: 'ai.audit.view',
  AI_CHAT_USE: 'ai.chat.use',
  AI_CONVERSATIONS_READ_OWN: 'ai.conversations.read_own',
  AI_CONVERSATIONS_DELETE_OWN: 'ai.conversations.delete_own',
  AI_KNOWLEDGE_VIEW: 'ai.knowledge.view',
  AI_KNOWLEDGE_MANAGE: 'ai.knowledge.manage',
  AI_CONFIG_MANAGE: 'ai.config.manage',
  FILE_EVIDENCE_VIEW: 'file_evidence.view',
  FILE_EVIDENCE_UPLOAD: 'file_evidence.upload',
  FILE_EVIDENCE_DOWNLOAD: 'file_evidence.download',
  FILE_EVIDENCE_DELETE: 'file_evidence.delete',
} as const;

// Aliases for compatibility
export const ADMISSIONS_CAMPAIGN_MANAGE = CAPABILITIES.ADMISSIONS_MANAGE;
export const ADMISSIONS_SHEET_SYNC_CONFIRM = CAPABILITIES.ADMISSIONS_SYNC;
export const ADMISSIONS_SYNC = CAPABILITIES.ADMISSIONS_SYNC;
export const ACCESS_ROLES_VIEW = CAPABILITIES.ACCESS_VIEW;
export const ACCESS_PERMISSIONS_MANAGE = CAPABILITIES.ACCESS_MANAGE;
export const TASKS_CREATE = CAPABILITIES.TASKS_MANAGE;
export const TASKS_MANAGE = CAPABILITIES.TASKS_MANAGE;
export const KPI_ASSIGN = CAPABILITIES.KPI_MANAGE;
export const KPI_MANAGE = CAPABILITIES.KPI_MANAGE;
export const DAILY_REPORTS_VIEW = CAPABILITIES.REPORTS_VIEW;
export const REPORTS_VIEW = CAPABILITIES.REPORTS_VIEW;

export type CapabilityCode = (typeof CAPABILITIES)[keyof typeof CAPABILITIES] | string;

export const CANONICAL_USER_MANAGE_CAPABILITY = 'user_org.users.manage';
export const CANONICAL_USER_VIEW_CAPABILITY = 'user_org.users.view';

export type PermissionsMap = Record<string, ScopeCode>;

export interface AuthorizationContextValue {
  can: (capabilityCode: string, minimumScope?: ScopeCode) => boolean;
  hasCapability: (capabilityCode: string, minimumScope?: ScopeCode) => boolean;
  hasAnyCapability: (capabilityCodes: string[], minimumScope?: ScopeCode) => boolean;
  hasAllCapabilities: (capabilityCodes: string[], minimumScope?: ScopeCode) => boolean;
  scopeOf: (capabilityCode: string) => ScopeCode | null;
  refreshPermissions: () => Promise<void>;
  permissions: PermissionsMap;
  capabilities: string[];
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
}
