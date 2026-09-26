-- ============================================================================
-- MIGRATION v0.9-C4.5-B: Functional Roles & Capability Foundation (Idempotent)
-- ============================================================================

BEGIN;

-- 1. Ensure admissions module is active
INSERT INTO public.access_modules (code, name, description, is_active, display_order)
VALUES ('admissions', 'Tuyển sinh', 'Quản lý tuyển sinh, đợt, kế hoạch và kết quả', true, 40)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = EXCLUDED.is_active;

-- 2. Ensure baseline roles exist with is_system = true
INSERT INTO public.access_roles (code, name, description, level, is_system, is_active) VALUES
('staff', 'Nhân viên', 'Vai trò nền nhân viên', 10, true, true),
('manager', 'Quản lý', 'Vai trò nền quản lý đơn vị', 20, true, true),
('executive', 'Ban Giám hiệu', 'Vai trò nền lãnh đạo trường', 30, true, true),
('admin', 'Quản trị hệ thống', 'Vai trò nền quản trị tối cao', 40, true, true)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, level = EXCLUDED.level, is_system = true, is_active = true;

-- 3. Ensure functional roles exist with is_system = false
INSERT INTO public.access_roles (code, name, description, level, is_system, is_active) VALUES
('admissions_staff', 'Nhân viên Tuyển sinh', 'Vai trò chức năng nhân viên tuyển sinh', 10, false, true),
('admissions_manager', 'Quản lý Tuyển sinh', 'Vai trò chức năng quản lý đợt và kế hoạch tuyển sinh', 20, false, true),
('admissions_admin', 'Quản trị Tuyển sinh', 'Vai trò chức năng quản trị toàn diện module tuyển sinh và tích hợp Google Sheets', 30, false, true)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, level = EXCLUDED.level, is_system = false, is_active = true;

-- 4. Seed and ensure all 12 admissions capabilities
INSERT INTO public.access_permissions (module_code, code, name, description, action_code, supports_data_scope, risk_level) VALUES
('admissions', 'admissions.view', 'Xem Tuyển sinh', 'Xem dữ liệu, đợt và danh mục tuyển sinh', 'view', true, 'normal'),
('admissions', 'admissions.campaign_manage', 'Quản lý đợt tuyển sinh', 'Tạo và cập nhật đợt tuyển sinh', 'campaign_manage', true, 'sensitive'),
('admissions', 'admissions.plan_manage', 'Quản lý kế hoạch', 'Lập và điều chỉnh kế hoạch chỉ tiêu tuyển sinh', 'plan_manage', true, 'sensitive'),
('admissions', 'admissions.catalog_manage', 'Quản lý danh mục', 'Quản lý ngành và lớp tuyển sinh', 'catalog_manage', true, 'normal'),
('admissions', 'admissions.allocate', 'Phân bổ chỉ tiêu', 'Phân bổ chỉ tiêu cho các đơn vị', 'allocate', true, 'sensitive'),
('admissions', 'admissions.result_update', 'Nhập kết quả', 'Nhập và cập nhật kết quả tuyển sinh', 'result_update', true, 'normal'),
('admissions', 'admissions.lock', 'Chốt số liệu', 'Khóa dữ liệu tuyển sinh', 'lock', true, 'critical'),
('admissions', 'admissions.reopen', 'Mở lại số liệu', 'Mở khóa dữ liệu tuyển sinh', 'reopen', true, 'critical'),
('admissions', 'admissions.export', 'Xuất báo cáo', 'Xuất báo cáo tuyển sinh', 'export', true, 'normal'),
('admissions', 'admissions.sheet_configure', 'Cấu hình Google Sheets', 'Cấu hình liên kết Google Sheets', 'sheet_configure', false, 'sensitive'),
('admissions', 'admissions.sheet_validate', 'Kiểm tra dữ liệu đồng bộ', 'Kiểm tra tính hợp lệ dữ liệu sheets', 'sheet_validate', false, 'normal'),
('admissions', 'admissions.sheet_sync_confirm', 'Xác nhận đồng bộ', 'Xác nhận đồng bộ dữ liệu sheets vào hệ thống', 'sheet_sync_confirm', false, 'critical')
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code, supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level;

-- 5. Seed Role-Permissions Mapping for Functional Roles
-- 5.1. admissions_staff (view, result_update, export with scope: unit)
INSERT INTO public.access_role_permissions (role_code, permission_id, scope_code)
SELECT 'admissions_staff', id, 'unit'
FROM public.access_permissions
WHERE code IN ('admissions.view', 'admissions.result_update', 'admissions.export')
ON CONFLICT (role_code, permission_id) DO UPDATE SET scope_code = EXCLUDED.scope_code;

-- 5.2. admissions_manager (view, campaign_manage, plan_manage, catalog_manage, allocate, result_update, lock, reopen, export with scope: unit_tree)
INSERT INTO public.access_role_permissions (role_code, permission_id, scope_code)
SELECT 'admissions_manager', id, 'unit_tree'
FROM public.access_permissions
WHERE code IN ('admissions.view', 'admissions.campaign_manage', 'admissions.plan_manage', 'admissions.catalog_manage', 'admissions.allocate', 'admissions.result_update', 'admissions.lock', 'admissions.reopen', 'admissions.export')
ON CONFLICT (role_code, permission_id) DO UPDATE SET scope_code = EXCLUDED.scope_code;

-- 5.3. admissions_admin (all admissions permissions with scope: all)
INSERT INTO public.access_role_permissions (role_code, permission_id, scope_code)
SELECT 'admissions_admin', id, 'all'
FROM public.access_permissions
WHERE module_code = 'admissions'
ON CONFLICT (role_code, permission_id) DO UPDATE SET scope_code = EXCLUDED.scope_code;

COMMIT;
