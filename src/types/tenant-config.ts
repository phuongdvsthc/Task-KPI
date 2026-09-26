/**
 * Tenant Configuration Types & Validation Rules (v0.9-C5-D)
 *
 * Defines the contract for school/institution tenant configuration.
 * Enables one codebase & migration sequence to serve distinct educational institutions,
 * each with its own isolated Supabase Project / database.
 */

export interface TenantContactInfo {
  email: string;
  phone: string;
  address: string;
}

export interface TenantRootUnit {
  code: string;
  name: string;
  unitType?: 'school' | 'board' | 'department';
  description?: string;
}

export const VALID_SYSTEM_MODULES = [
  'task',
  'kpi',
  'team_report',
  'admissions',
  'dashboard',
  'system',
  'ai',
  'notification',
  'user_org',
  'file_evidence',
  'access_control'
] as const;

export type SystemModuleCode = typeof VALID_SYSTEM_MODULES[number];

export interface TenantConfig {
  $schema?: string;
  tenantCode: string;
  tenantName: string;
  tenantShortName: string;
  contactInfo: TenantContactInfo;
  website: string;
  timezone: string;
  dateFormat?: string;
  locale?: string;
  rootUnit: TenantRootUnit;
  enabledModules: string[];
  // Optional institution-level branding/settings
  appName?: string;
  logoPath?: string;
  logoSmallPath?: string;
  faviconPath?: string;
  dailyReportDeadline?: string;
  workingDays?: string;
  appearanceMode?: 'light' | 'dark' | 'system';
  appearanceAccent?: 'indigo' | 'blue' | 'teal';
}

export interface TenantValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedConfig?: TenantConfig;
}

/**
 * Validates a TenantConfig object against strict enterprise rules.
 * Enforces security constraints:
 * - NO API keys, service role keys, passwords, or secrets in config.
 * - Format checks for tenantCode, rootUnit, contactInfo, timezone, and enabledModules.
 */
export function validateTenantConfig(raw: any): TenantValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Cấu hình tenant phải là một đối tượng JSON hợp lệ.'] };
  }

  // 1. Security Check: Detect accidental leaks of secrets/keys/credentials
  const forbiddenSecretKeys = [
    'apikey',
    'api_key',
    'service_role',
    'service_role_key',
    'secret',
    'password',
    'access_token',
    'refresh_token',
    'jwt',
    'private_key',
    'supabase_key'
  ];

  const rawKeys = Object.keys(raw).map((k) => k.toLowerCase());
  for (const secretKey of forbiddenSecretKeys) {
    if (rawKeys.includes(secretKey)) {
      errors.push(
        `VI PHẠM BẢO MẬT: Phát hiện khóa bí mật '${secretKey}' trong file cấu hình. Bí mật phải lấy từ biến môi trường, không được đặt trong file cấu hình.`
      );
    }
  }

  // Also scan string values for apparent jwt or service role keys
  const serialized = JSON.stringify(raw);
  if (/eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}/.test(serialized)) {
    errors.push('VI PHẠM BẢO MẬT: Phát hiện chuỗi token JWT/API key trong nội dung file cấu hình.');
  }

  // 2. Tenant Code Validation
  if (!raw.tenantCode || typeof raw.tenantCode !== 'string' || !raw.tenantCode.trim()) {
    errors.push('Trường bắt buộc: tenantCode (mã trường) không được để trống.');
  } else {
    const code = raw.tenantCode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
      errors.push('tenantCode phải từ 2-20 ký tự chữ hoa, số hoặc gạch nối (ví dụ: VTC, STHC, CCT).');
    }
  }

  // 3. Tenant Name & Short Name
  if (!raw.tenantName || typeof raw.tenantName !== 'string' || !raw.tenantName.trim()) {
    errors.push('Trường bắt buộc: tenantName (tên trường) không được để trống.');
  }
  if (!raw.tenantShortName || typeof raw.tenantShortName !== 'string' || !raw.tenantShortName.trim()) {
    errors.push('Trường bắt buộc: tenantShortName (tên viết tắt) không được để trống.');
  }

  // 4. Contact Info
  if (!raw.contactInfo || typeof raw.contactInfo !== 'object') {
    errors.push('Trường bắt buộc: contactInfo phải là đối tượng chứa email, phone, address.');
  } else {
    if (!raw.contactInfo.email || typeof raw.contactInfo.email !== 'string' || !raw.contactInfo.email.includes('@')) {
      errors.push('contactInfo.email không hợp lệ hoặc thiếu ký tự @.');
    }
    if (!raw.contactInfo.phone || typeof raw.contactInfo.phone !== 'string' || !raw.contactInfo.phone.trim()) {
      errors.push('contactInfo.phone không được để trống.');
    }
    if (!raw.contactInfo.address || typeof raw.contactInfo.address !== 'string' || !raw.contactInfo.address.trim()) {
      errors.push('contactInfo.address không được để trống.');
    }
  }

  // 5. Website
  if (!raw.website || typeof raw.website !== 'string' || !raw.website.trim()) {
    errors.push('Trường bắt buộc: website không được để trống.');
  } else if (!raw.website.startsWith('http://') && !raw.website.startsWith('https://')) {
    errors.push('website phải bắt đầu bằng http:// hoặc https://');
  }

  // 6. Timezone
  if (!raw.timezone || typeof raw.timezone !== 'string' || !raw.timezone.trim()) {
    errors.push('Trường bắt buộc: timezone (múi giờ) không được để trống (ví dụ: Asia/Ho_Chi_Minh).');
  }

  // 7. Root Unit
  if (!raw.rootUnit || typeof raw.rootUnit !== 'object') {
    errors.push('Trường bắt buộc: rootUnit phải là đối tượng chứa code và name.');
  } else {
    if (!raw.rootUnit.code || typeof raw.rootUnit.code !== 'string' || !raw.rootUnit.code.trim()) {
      errors.push('rootUnit.code không được để trống.');
    }
    if (!raw.rootUnit.name || typeof raw.rootUnit.name !== 'string' || !raw.rootUnit.name.trim()) {
      errors.push('rootUnit.name không được để trống.');
    }
  }

  // 8. Enabled Modules
  if (!raw.enabledModules || !Array.isArray(raw.enabledModules)) {
    errors.push('Trường bắt buộc: enabledModules phải là danh sách (mảng) các mã module.');
  } else if (raw.enabledModules.length === 0) {
    errors.push('enabledModules không được để rỗng. Phải bật ít nhất 1 module.');
  } else {
    const validSet = new Set<string>(VALID_SYSTEM_MODULES);
    const aliases: Record<string, string> = {
      tasks: 'task',
      kpis: 'kpi',
      daily_reports: 'team_report',
      reports: 'team_report',
      ai_assistant: 'ai'
    };

    for (const mod of raw.enabledModules) {
      if (typeof mod !== 'string') {
        errors.push(`Mã module không hợp lệ: ${String(mod)}`);
      } else {
        const normalized = aliases[mod.toLowerCase()] || mod.toLowerCase();
        if (!validSet.has(normalized)) {
          errors.push(`Module '${mod}' không nằm trong danh mục module hệ thống (${VALID_SYSTEM_MODULES.join(', ')}).`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Sanitize and normalize
  const sanitized: TenantConfig = {
    tenantCode: raw.tenantCode.trim().toUpperCase(),
    tenantName: raw.tenantName.trim(),
    tenantShortName: raw.tenantShortName.trim().toUpperCase(),
    contactInfo: {
      email: raw.contactInfo.email.trim(),
      phone: raw.contactInfo.phone.trim(),
      address: raw.contactInfo.address.trim()
    },
    website: raw.website.trim(),
    timezone: raw.timezone.trim(),
    dateFormat: raw.dateFormat?.trim() || 'DD/MM/YYYY',
    locale: raw.locale?.trim() || 'vi',
    rootUnit: {
      code: raw.rootUnit.code.trim().toUpperCase(),
      name: raw.rootUnit.name.trim(),
      unitType: raw.rootUnit.unitType || 'school',
      description: raw.rootUnit.description?.trim() || `Đơn vị gốc cấp trường (${raw.rootUnit.name.trim()})`
    },
    enabledModules: Array.from(
      new Set(
        raw.enabledModules.map((m: string) => {
          const lower = m.toLowerCase();
          if (lower === 'tasks') return 'task';
          if (lower === 'kpis') return 'kpi';
          if (lower === 'daily_reports' || lower === 'reports') return 'team_report';
          if (lower === 'ai_assistant') return 'ai';
          return lower;
        })
      )
    ),
    appName: raw.appName?.trim() || `Hệ thống Quản lý Công việc & Đánh giá KPI - ${raw.tenantShortName.trim().toUpperCase()}`,
    logoPath: raw.logoPath?.trim() || '/system-assets/logo.png',
    logoSmallPath: raw.logoSmallPath?.trim() || '/system-assets/logo-small.png',
    faviconPath: raw.faviconPath?.trim() || '/system-assets/favicon.ico',
    dailyReportDeadline: raw.dailyReportDeadline?.trim() || '17:30',
    workingDays: raw.workingDays?.trim() || '1,2,3,4,5',
    appearanceMode: raw.appearanceMode || 'light',
    appearanceAccent: raw.appearanceAccent || 'indigo'
  };

  return { valid: true, errors: [], sanitizedConfig: sanitized };
}
