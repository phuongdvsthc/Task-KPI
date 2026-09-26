/**
 * Tenant Configuration Provisioning Engine (v0.9-C5-D)
 *
 * Usage:
 *   npx tsx scripts/apply-tenant-config.ts [path-to-tenant-config.json] [--dry-run]
 *
 * Guarantees:
 * 1. Validates all tenant config fields before database connection.
 * 2. Cross-Tenant Protection: Aborts if DB is already provisioned for a different tenant.
 * 3. Safe Idempotency: Re-runs do not overwrite admin-customized settings (`updated_by IS NOT NULL`).
 * 4. ROOT Unit Integrity: Creates or links ROOT unit without duplicate creation.
 * 5. Strict Zero-User Policy: Does NOT create Admin or User accounts (reserved for C5-E).
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { validateTenantConfig, TenantConfig } from '../src/types/tenant-config';
import { validateSupabaseEnvironment } from './utils/supabase-guard';

dotenv.config();

export interface ApplyTenantConfigOptions {
  configPath?: string;
  configObject?: TenantConfig;
  dryRun?: boolean;
  supabaseClient?: any;
}

export interface ApplyTenantResult {
  success: boolean;
  tenantCode: string;
  isInitialSetup: boolean;
  settingsApplied: number;
  settingsPreserved: number;
  rootUnitId?: string;
  message: string;
  error?: string;
}

export async function applyTenantConfig(options: ApplyTenantConfigOptions = {}): Promise<ApplyTenantResult> {
  const { configPath, configObject, dryRun = false } = options;

  // 0. Pre-Execution Supabase Guard Validation
  const guard = await validateSupabaseEnvironment();
  if (!guard.success) {
    throw new Error(guard.message);
  }

  // 1. Load configuration
  let rawConfig: any;
  if (configObject) {
    rawConfig = configObject;
  } else {
    const targetFile = configPath || path.resolve(process.cwd(), 'tenant.config.json');
    if (!fs.existsSync(targetFile)) {
      throw new Error(`Không tìm thấy file cấu hình tenant tại '${targetFile}'. Vui lòng tạo file dựa trên tenant.config.example.json.`);
    }
    const fileContent = fs.readFileSync(targetFile, 'utf8');
    try {
      rawConfig = JSON.parse(fileContent);
    } catch (parseErr: any) {
      throw new Error(`Lỗi cú pháp JSON trong '${targetFile}': ${parseErr.message}`);
    }
  }

  // 2. Validate configuration schema & safety rules
  const validation = validateTenantConfig(rawConfig);
  if (!validation.valid || !validation.sanitizedConfig) {
    const errorMsg = `Cấu hình tenant không hợp lệ:\n  - ${validation.errors.join('\n  - ')}`;
    throw new Error(errorMsg);
  }

  const config = validation.sanitizedConfig;

  // 3. Connect to Supabase using Environment Variables
  let supabase = options.supabaseClient;
  if (!supabase) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Thiếu biến môi trường kết nối cơ sở dữ liệu: VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY không tồn tại trong .env.'
      );
    }

    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  // 4. Cross-Tenant Protection Guard
  const { data: existingSettings, error: readSettingsErr } = await supabase
    .from('system_settings')
    .select('setting_key, setting_value, updated_by');

  if (readSettingsErr) {
    throw new Error(`Không thể đọc bảng system_settings để kiểm tra trạng thái tenant: ${readSettingsErr.message}`);
  }

  const settingsMap = new Map<string, { value: string; updated_by: string | null }>();
  (existingSettings || []).forEach((row: any) => {
    settingsMap.set(row.setting_key, { value: row.setting_value, updated_by: row.updated_by });
  });

  const existingTenantCode = settingsMap.get('tenant_code')?.value || settingsMap.get('institution_code')?.value;

  if (existingTenantCode && existingTenantCode.toUpperCase() !== config.tenantCode) {
    const errMsg = `NGĂN CHẶN XUNG ĐỘT TENANT (CROSS-TENANT VIOLATION): Cơ sở dữ liệu hiện đã được cấu hình cho trường có mã '${existingTenantCode}'. Không thể áp dụng cấu hình của trường '${config.tenantCode}'. Quy trình bị hủy bỏ lập tức để bảo vệ dữ liệu.`;
    throw new Error(errMsg);
  }

  const isInitialSetup = !existingTenantCode;

  if (dryRun) {
    return {
      success: true,
      tenantCode: config.tenantCode,
      isInitialSetup,
      settingsApplied: 0,
      settingsPreserved: 0,
      message: `[DRY-RUN] Kiểm tra hợp lệ: Cấu hình của ${config.tenantName} (${config.tenantCode}) đã sẵn sàng để áp dụng.`
    };
  }

  // 5. ROOT Unit Management (Idempotent, Zero Duplication)
  const { data: existingRootUnits, error: rootFetchErr } = await supabase
    .from('organization_units')
    .select('id, code, name, unit_type, parent_id')
    .is('parent_id', null);

  if (rootFetchErr) {
    throw new Error(`Không thể kiểm tra đơn vị ROOT trong organization_units: ${rootFetchErr.message}`);
  }

  let rootUnitId: string;

  if (existingRootUnits && existingRootUnits.length > 0) {
    const currentRoot = existingRootUnits[0];
    rootUnitId = currentRoot.id;

    // Check code compatibility
    if (currentRoot.code !== config.rootUnit.code && !isInitialSetup) {
      console.warn(`[TenantConfig] Lưu ý: Đơn vị ROOT hiện tại có mã '${currentRoot.code}', cấu hình mới đề xuất '${config.rootUnit.code}'. Giữ nguyên mã hiện tại để bảo toàn toàn vẹn cây đơn vị.`);
    } else if (currentRoot.code !== config.rootUnit.code && isInitialSetup) {
      // Update placeholder root unit to match newly configured tenant root
      await supabase
        .from('organization_units')
        .update({
          code: config.rootUnit.code,
          name: config.rootUnit.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentRoot.id);
    }
  } else {
    // Insert initial ROOT unit
    const { data: newRoot, error: insertRootErr } = await supabase
      .from('organization_units')
      .insert({
        code: config.rootUnit.code,
        name: config.rootUnit.name,
        unit_type: 'school',
        parent_id: null,
        description: config.rootUnit.description || `Đơn vị gốc cấp trường (${config.tenantName})`,
        sort_order: 1,
        is_active: true
      })
      .select('id')
      .single();

    if (insertRootErr) {
      throw new Error(`Không thể tạo đơn vị ROOT '${config.rootUnit.code}': ${insertRootErr.message}`);
    }
    rootUnitId = newRoot.id;
  }

  // 6. Apply System Settings with Admin Customization Protection
  const settingsToApply: Array<{
    key: string;
    value: string;
    type: string;
    isPublic: boolean;
    group: string;
    label: string;
  }> = [
    { key: 'tenant_code', value: config.tenantCode, type: 'text', isPublic: true, group: 'general', label: 'Mã định danh trường' },
    { key: 'organization_name', value: config.tenantName, type: 'text', isPublic: true, group: 'general', label: 'Tên trường / Cơ sở' },
    { key: 'organization_short_name', value: config.tenantShortName, type: 'text', isPublic: true, group: 'general', label: 'Tên viết tắt' },
    { key: 'app_name', value: config.appName || `Hệ thống Quản lý Công việc & Đánh giá KPI - ${config.tenantShortName}`, type: 'text', isPublic: true, group: 'general', label: 'Tên phần mềm' },
    { key: 'organization_email', value: config.contactInfo.email, type: 'text', isPublic: true, group: 'general', label: 'Email liên hệ' },
    { key: 'organization_phone', value: config.contactInfo.phone, type: 'text', isPublic: true, group: 'general', label: 'Số điện thoại' },
    { key: 'organization_address', value: config.contactInfo.address, type: 'text', isPublic: true, group: 'general', label: 'Địa chỉ trụ sở' },
    { key: 'organization_website', value: config.website, type: 'text', isPublic: true, group: 'general', label: 'Website chính thức' },
    { key: 'timezone', value: config.timezone, type: 'text', isPublic: true, group: 'general', label: 'Múi giờ hệ thống' },
    { key: 'date_format', value: config.dateFormat || 'DD/MM/YYYY', type: 'text', isPublic: true, group: 'general', label: 'Định dạng ngày' },
    { key: 'locale', value: config.locale || 'vi', type: 'text', isPublic: true, group: 'general', label: 'Ngôn ngữ' },
    { key: 'enabled_modules', value: JSON.stringify(config.enabledModules), type: 'text', isPublic: true, group: 'general', label: 'Danh sách module kích hoạt' },
    { key: 'logo_path', value: config.logoPath || '/system-assets/logo.png', type: 'text', isPublic: true, group: 'general', label: 'Đường dẫn logo' },
    { key: 'logo_small_path', value: config.logoSmallPath || '/system-assets/logo-small.png', type: 'text', isPublic: true, group: 'general', label: 'Đường dẫn logo nhỏ' },
    { key: 'favicon_path', value: config.faviconPath || '/system-assets/favicon.ico', type: 'text', isPublic: true, group: 'general', label: 'Đường dẫn favicon' },
    { key: 'daily_report_deadline', value: config.dailyReportDeadline || '17:30', type: 'text', isPublic: true, group: 'general', label: 'Hạn nộp báo cáo hằng ngày' },
    { key: 'working_days', value: config.workingDays || '1,2,3,4,5', type: 'text', isPublic: true, group: 'general', label: 'Ngày làm việc trong tuần' },
    { key: 'appearance_mode', value: config.appearanceMode || 'light', type: 'text', isPublic: true, group: 'general', label: 'Chế độ giao diện mặc định' },
    { key: 'appearance_accent', value: config.appearanceAccent || 'indigo', type: 'text', isPublic: true, group: 'general', label: 'Màu sắc chủ đạo' }
  ];

  let settingsApplied = 0;
  let settingsPreserved = 0;

  for (const item of settingsToApply) {
    const existing = settingsMap.get(item.key);

    // Rule: "không ghi đè cấu hình đã được quản trị viên chỉnh sau khi cài đặt"
    // If the setting already exists AND has been customized by an admin (updated_by is set), preserve it!
    if (existing && existing.updated_by) {
      settingsPreserved++;
      continue;
    }

    const { error: upsertErr } = await supabase
      .from('system_settings')
      .upsert({
        setting_key: item.key,
        setting_value: item.value,
        setting_type: item.type,
        is_public: item.isPublic,
        setting_group: item.group,
        label: item.label,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

    if (upsertErr) {
      console.warn(`[TenantConfig] Cảnh báo khi ghi setting '${item.key}':`, upsertErr.message);
    } else {
      settingsApplied++;
    }
  }

  // 7. Synchronize access_modules active state based on enabled_modules
  // Crucial: "việc tắt module không được xóa dữ liệu hoặc thay đổi quyền RBAC đã lưu."
  // Only update is_active in access_modules without deleting any permissions or role mappings!
  const enabledSet = new Set(config.enabledModules);
  const { data: modulesList } = await supabase.from('access_modules').select('id, code, is_active');
  if (modulesList) {
    for (const mod of modulesList) {
      const shouldBeActive = enabledSet.has(mod.code);
      if (mod.is_active !== shouldBeActive) {
        await supabase
          .from('access_modules')
          .update({ is_active: shouldBeActive, updated_at: new Date().toISOString() })
          .eq('id', mod.id);
      }
    }
  }

  return {
    success: true,
    tenantCode: config.tenantCode,
    isInitialSetup,
    settingsApplied,
    settingsPreserved,
    rootUnitId,
    message: `Đã áp dụng thành công cấu hình cho trường ${config.tenantName} (${config.tenantCode}). (Áp dụng: ${settingsApplied}, Bảo toàn tùy chỉnh admin: ${settingsPreserved}). Tài khoản Admin/ROOT chưa được tạo tại bước này (thuộc C5-E).`
  };
}

// CLI Execution Entry Point
if (process.argv[1] && process.argv[1].endsWith('apply-tenant-config.ts')) {
  const args = process.argv.slice(2);
  const configPath = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  console.log('=== KHỞI CHẠY QUY TRÌNH ÁP DỤNG CẤU HÌNH TRƯỜNG (TENANT PROVISIONING) ===');
  applyTenantConfig({ configPath, dryRun })
    .then((res) => {
      console.log(`\n KẾT QUẢ: ${res.message}`);
      console.log(`   - Mã trường: ${res.tenantCode}`);
      console.log(`   - Khởi tạo lần đầu: ${res.isInitialSetup ? 'Có' : 'Không (Cập nhật an toàn)'}`);
      console.log(`   - Đơn vị ROOT ID: ${res.rootUnitId || 'N/A'}`);
      console.log('\n[LƯU Ý AN TOÀN]: Chưa tạo tài khoản Admin/ROOT tại bước này (tuân thủ C5-D, việc đó thuộc C5-E).');
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n THẤT BẠI: ${err.message}`);
      process.exit(1);
    });
}
