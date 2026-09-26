-- ====================================================================
-- SEED: 00001_core_baseline_seed.sql
-- PURPOSE: Core Baseline Seed for Work + KPI software (All Schools / Tenants)
-- DEPENDENCIES: Runs AFTER all 00001 - 00009 schema migrations
-- GUARANTEE: 100% Idempotent (safe to re-run), NO STHC-specific data
-- ====================================================================

-- --------------------------------------------------------------------
-- SECTION 1: ACCESS CONTROL & RBAC FOUNDATION (11 Modules, 7 Roles, 67 Perms, 177 RolePerms)
-- --------------------------------------------------------------------
-- 1. ACCESS MODULES
INSERT INTO public.access_modules (code, name, description, sort_order, is_active)
VALUES
    ('task', 'Quản lý công việc', 'Quản lý công việc và giao việc', 10, true),
    ('kpi', 'Quản lý KPI', 'Quản lý chỉ tiêu, thực hiện và đánh giá KPI', 20, true),
    ('team_report', 'Báo cáo đội ngũ', 'Theo dõi và tổng hợp báo cáo đơn vị', 30, true),
    ('admissions', 'Tuyển sinh', 'Quản lý tuyển sinh, đợt, kế hoạch và kết quả', 40, true),
    ('dashboard', 'Dashboard', 'Dashboard theo quyền và phạm vi dữ liệu', 50, true),
    ('system', 'Cấu hình hệ thống', 'Cấu hình chung và tích hợp', 60, true),
    ('ai', 'Dịch vụ AI', 'Sinh nội dung, audit và trợ lý AI', 70, true),
    ('notification', 'Thông báo và nhắc việc', 'Thông báo, nhắc việc và broadcast', 80, true),
    ('user_org', 'Người dùng và đơn vị', 'Người dùng và cơ cấu tổ chức', 90, true),
    ('file_evidence', 'File và minh chứng', 'File đính kèm và minh chứng', 100, true),
    ('access_control', 'Phân quyền hệ thống', 'Vai trò, quyền và gán vai trò', 110, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;
    -- Note: is_active is preserved on re-run to respect tenant module enablement

-- 2. ACCESS ROLES
INSERT INTO public.access_roles (code, name, description, level, is_system, is_active)
VALUES
    ('staff', 'Nhân viên', 'Nhân viên hoặc giáo viên', 10, true, true),
    ('admissions_staff', 'Nhân viên Tuyển sinh', 'Vai trò chức năng nhân viên tuyển sinh', 10, false, true),
    ('manager', 'Quản lý', 'Quản lý đơn vị và đơn vị con', 20, true, true),
    ('admissions_manager', 'Quản lý Tuyển sinh', 'Vai trò chức năng quản lý đợt và kế hoạch tuyển sinh', 20, false, true),
    ('admissions_admin', 'Quản trị Tuyển sinh', 'Vai trò chức năng quản trị toàn diện module tuyển sinh và tích hợp Google Sheets', 30, false, true),
    ('executive', 'Ban Giám hiệu', 'Xem dữ liệu toàn trường, chỉ đọc', 30, true, true),
    ('admin', 'Quản trị hệ thống', 'Quản trị cấu hình và phân quyền', 40, true, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    level = EXCLUDED.level,
    is_system = EXCLUDED.is_system;
    -- Note: is_active is preserved on re-run to respect tenant customization

-- 3. ACCESS PERMISSIONS
INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'kpi.view', 'Xem KPI', 'Xem KPI', 'view', true, 'normal', 10, true
FROM public.access_modules WHERE code = 'kpi'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.view', 'Xem Tuyển sinh', 'Xem dữ liệu, đợt và danh mục tuyển sinh', 'view', true, 'normal', 10, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'notification.view', 'Xem thông báo', 'Xem thông báo cá nhân', 'view', false, 'normal', 10, true
FROM public.access_modules WHERE code = 'notification'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'user_org.users.view', 'Xem người dùng', 'Xem danh sách người dùng', 'view', true, 'normal', 10, true
FROM public.access_modules WHERE code = 'user_org'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'team_report.view', 'Xem báo cáo đội ngũ', 'Xem báo cáo đội ngũ', 'view', true, 'normal', 10, true
FROM public.access_modules WHERE code = 'team_report'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'access_control.roles.view', 'Xem vai trò', 'Xem danh sách vai trò', 'view', false, 'normal', 10, true
FROM public.access_modules WHERE code = 'access_control'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'system.settings.view', 'Xem cấu hình hệ thống', 'Xem cấu hình hệ thống', 'view', false, 'normal', 10, true
FROM public.access_modules WHERE code = 'system'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'dashboard.personal.view', 'Xem Dashboard cá nhân', 'Xem Dashboard cá nhân', 'view', false, 'normal', 10, true
FROM public.access_modules WHERE code = 'dashboard'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'task.view', 'Xem công việc', 'Xem danh sách và chi tiết công việc', 'view', true, 'normal', 10, true
FROM public.access_modules WHERE code = 'task'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'ai.chat.use', 'Sử dụng Trợ lý AI', 'Trò chuyện và tương tác với Trợ lý AI', 'use', false, 'normal', 10, true
FROM public.access_modules WHERE code = 'ai'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'file_evidence.view', 'Xem file', 'Xem file và minh chứng', 'view', true, 'normal', 10, true
FROM public.access_modules WHERE code = 'file_evidence'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'ai.generate', 'Sử dụng AI', 'Sử dụng chức năng AI', 'generate', true, 'normal', 10, true
FROM public.access_modules WHERE code = 'ai'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'ai.conversations.read_own', 'Xem lịch sử chat cá nhân', 'Xem các cuộc hội thoại và tin nhắn do chính mình tạo', 'read_own', true, 'normal', 12, true
FROM public.access_modules WHERE code = 'ai'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'ai.conversations.delete_own', 'Xóa lịch sử chat cá nhân', 'Xóa các cuộc hội thoại do chính mình tạo', 'delete_own', true, 'normal', 14, true
FROM public.access_modules WHERE code = 'ai'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'ai.knowledge.view', 'Sử dụng kho kiến thức AI', 'Tìm kiếm và trích dẫn tài liệu từ kho kiến thức chung đã xuất bản', 'view', false, 'normal', 20, true
FROM public.access_modules WHERE code = 'ai'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'notification.send', 'Gửi thông báo', 'Gửi thông báo', 'send', true, 'normal', 20, true
FROM public.access_modules WHERE code = 'notification'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.catalog_manage', 'Quản lý danh mục', 'Quản lý ngành và lớp tuyển sinh', 'catalog_manage', true, 'normal', 20, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'access_control.roles.manage', 'Quản lý vai trò', 'Quản lý vai trò', 'manage', false, 'critical', 20, true
FROM public.access_modules WHERE code = 'access_control'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'file_evidence.upload', 'Tải file lên', 'Tải file và minh chứng lên', 'upload', true, 'normal', 20, true
FROM public.access_modules WHERE code = 'file_evidence'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'kpi.create', 'Tạo KPI', 'Tạo KPI', 'create', true, 'normal', 20, true
FROM public.access_modules WHERE code = 'kpi'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'user_org.users.manage', 'Quản lý người dùng', 'Quản lý người dùng', 'manage', true, 'sensitive', 20, true
FROM public.access_modules WHERE code = 'user_org'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'team_report.export', 'Xuất báo cáo đội ngũ', 'Xuất báo cáo đội ngũ', 'export', true, 'normal', 20, true
FROM public.access_modules WHERE code = 'team_report'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'task.create', 'Tạo công việc', 'Tạo công việc mới', 'create', true, 'normal', 20, true
FROM public.access_modules WHERE code = 'task'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'dashboard.manager.view', 'Xem Dashboard quản lý', 'Xem Dashboard đơn vị', 'view', true, 'normal', 20, true
FROM public.access_modules WHERE code = 'dashboard'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'system.settings.manage', 'Quản lý cấu hình hệ thống', 'Thay đổi cấu hình hệ thống', 'manage', false, 'sensitive', 20, true
FROM public.access_modules WHERE code = 'system'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'ai.audit.view', 'Xem nhật ký AI', 'Xem nhật ký gọi AI', 'view', false, 'normal', 20, true
FROM public.access_modules WHERE code = 'ai'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'ai.knowledge.manage', 'Quản lý kho kiến thức AI', 'Tải lên, biên tập, xuất bản và xóa tài liệu kho kiến thức', 'manage', false, 'sensitive', 25, true
FROM public.access_modules WHERE code = 'ai'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'access_control.permissions.view', 'Xem quyền', 'Xem danh mục quyền', 'view', false, 'normal', 30, true
FROM public.access_modules WHERE code = 'access_control'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'file_evidence.download', 'Tải file xuống', 'Tải file và minh chứng xuống', 'download', true, 'normal', 30, true
FROM public.access_modules WHERE code = 'file_evidence'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.campaign_manage', 'Quản lý đợt tuyển sinh', 'Tạo và cập nhật đợt tuyển sinh', 'campaign_manage', true, 'sensitive', 30, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'ai.usage.view', 'Xem thống kê AI', 'Xem thống kê sử dụng token và lượt gọi AI', 'view', false, 'normal', 30, true
FROM public.access_modules WHERE code = 'ai'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'user_org.units.view', 'Xem đơn vị', 'Xem cây đơn vị', 'view', true, 'normal', 30, true
FROM public.access_modules WHERE code = 'user_org'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'kpi.assign', 'Giao KPI', 'Giao KPI cho cá nhân hoặc đơn vị', 'assign', true, 'normal', 30, true
FROM public.access_modules WHERE code = 'kpi'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'task.update', 'Cập nhật công việc', 'Cập nhật công việc', 'update', true, 'normal', 30, true
FROM public.access_modules WHERE code = 'task'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'team_report.remind', 'Nhắc báo cáo', 'Gửi nhắc báo cáo', 'remind', true, 'normal', 30, true
FROM public.access_modules WHERE code = 'team_report'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'dashboard.executive.view', 'Xem Dashboard Ban Giám hiệu', 'Xem Dashboard toàn trường', 'view', true, 'normal', 30, true
FROM public.access_modules WHERE code = 'dashboard'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'system.integration.manage', 'Quản lý tích hợp', 'Quản lý kết nối ngoài', 'manage', false, 'sensitive', 30, true
FROM public.access_modules WHERE code = 'system'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'notification.remind', 'Gửi nhắc việc', 'Gửi nhắc việc', 'remind', true, 'normal', 30, true
FROM public.access_modules WHERE code = 'notification'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'user_org.units.manage', 'Quản lý đơn vị', 'Quản lý cơ cấu đơn vị', 'manage', false, 'sensitive', 40, true
FROM public.access_modules WHERE code = 'user_org'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'task.assign', 'Giao công việc', 'Giao công việc cho nhân sự', 'assign', true, 'normal', 40, true
FROM public.access_modules WHERE code = 'task'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'kpi.update_actual', 'Cập nhật thực hiện KPI', 'Cập nhật số liệu thực hiện', 'update', true, 'normal', 40, true
FROM public.access_modules WHERE code = 'kpi'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'team_report.review', 'Kiểm tra báo cáo', 'Kiểm tra báo cáo nhân sự', 'review', true, 'normal', 40, true
FROM public.access_modules WHERE code = 'team_report'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'dashboard.admin.view', 'Xem Dashboard quản trị', 'Xem Dashboard quản trị hệ thống', 'view', false, 'normal', 40, true
FROM public.access_modules WHERE code = 'dashboard'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'system.ai_provider.manage', 'Quản lý AI Provider', 'Quản lý nhà cung cấp AI', 'manage', false, 'critical', 40, true
FROM public.access_modules WHERE code = 'system'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'ai.prompt_manage', 'Quản lý AI Prompt', 'Quản lý prompt hệ thống', 'manage', false, 'sensitive', 40, true
FROM public.access_modules WHERE code = 'ai'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'notification.broadcast', 'Broadcast thông báo', 'Gửi thông báo toàn trường', 'broadcast', false, 'sensitive', 40, true
FROM public.access_modules WHERE code = 'notification'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'file_evidence.delete', 'Xóa file', 'Xóa file và minh chứng', 'delete', true, 'sensitive', 40, true
FROM public.access_modules WHERE code = 'file_evidence'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'access_control.permissions.manage', 'Quản lý quyền', 'Quản lý quyền', 'manage', false, 'critical', 40, true
FROM public.access_modules WHERE code = 'access_control'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.plan_manage', 'Quản lý kế hoạch', 'Lập và điều chỉnh kế hoạch chỉ tiêu tuyển sinh', 'plan_manage', true, 'sensitive', 40, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'access_control.user_roles.view', 'Xem gán vai trò', 'Xem gán vai trò người dùng', 'view', true, 'normal', 50, true
FROM public.access_modules WHERE code = 'access_control'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'task.approve', 'Duyệt công việc', 'Duyệt hoàn thành công việc', 'approve', true, 'normal', 50, true
FROM public.access_modules WHERE code = 'task'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'ai.config.manage', 'Quản trị cấu hình AI', 'Quản lý tham số mô hình, prompt hệ thống và tích hợp AI', 'manage', false, 'critical', 50, true
FROM public.access_modules WHERE code = 'ai'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.allocate', 'Phân bổ chỉ tiêu', 'Phân bổ chỉ tiêu cho các đơn vị', 'allocate', true, 'sensitive', 50, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'kpi.review', 'Đánh giá KPI', 'Review và chấm điểm KPI', 'review', true, 'normal', 50, true
FROM public.access_modules WHERE code = 'kpi'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.result_update', 'Nhập kết quả', 'Nhập và cập nhật kết quả tuyển sinh', 'result_update', true, 'normal', 60, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'task.delete', 'Xóa công việc', 'Xóa công việc', 'delete', true, 'sensitive', 60, true
FROM public.access_modules WHERE code = 'task'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'kpi.lock', 'Chốt KPI', 'Khóa hoặc chốt kỳ KPI', 'lock', true, 'sensitive', 60, true
FROM public.access_modules WHERE code = 'kpi'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'access_control.user_roles.assign', 'Gán vai trò', 'Gán vai trò người dùng', 'assign', true, 'critical', 60, true
FROM public.access_modules WHERE code = 'access_control'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.sheet_configure', 'Cấu hình Google Sheets', 'Cấu hình liên kết Google Sheets', 'sheet_configure', false, 'sensitive', 70, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'access_control.audit.view', 'Xem nhật ký phân quyền', 'Xem nhật ký phân quyền', 'view', false, 'normal', 70, true
FROM public.access_modules WHERE code = 'access_control'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'kpi.reopen', 'Mở lại KPI', 'Mở lại KPI đã chốt', 'reopen', true, 'sensitive', 70, true
FROM public.access_modules WHERE code = 'kpi'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'kpi.delete', 'Xóa KPI', 'Xóa KPI', 'delete', true, 'sensitive', 80, true
FROM public.access_modules WHERE code = 'kpi'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.sheet_validate', 'Kiểm tra dữ liệu đồng bộ', 'Kiểm tra tính hợp lệ dữ liệu sheets', 'sheet_validate', false, 'normal', 80, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.sheet_sync_confirm', 'Xác nhận đồng bộ', 'Xác nhận đồng bộ dữ liệu sheets vào hệ thống', 'sheet_sync_confirm', false, 'critical', 90, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.lock', 'Chốt số liệu', 'Khóa dữ liệu tuyển sinh', 'lock', true, 'critical', 100, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.reopen', 'Mở lại số liệu', 'Mở khóa dữ liệu tuyển sinh', 'reopen', true, 'critical', 110, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

INSERT INTO public.access_permissions (module_id, code, name, description, action_code, supports_data_scope, risk_level, sort_order, is_active)
SELECT id, 'admissions.export', 'Xuất báo cáo', 'Xuất báo cáo tuyển sinh', 'export', true, 'normal', 120, true
FROM public.access_modules WHERE code = 'admissions'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope, risk_level = EXCLUDED.risk_level, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

-- 4. ACCESS ROLE PERMISSIONS
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_manager' AND p.code = 'admissions.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_manager' AND p.code = 'admissions.catalog_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_manager' AND p.code = 'admissions.lock'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.catalog_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.lock'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.sheet_configure'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_staff' AND p.code = 'task.update'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_staff' AND p.code = 'task.create'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_staff' AND p.code = 'task.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_staff' AND p.code = 'kpi.update_actual'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_staff' AND p.code = 'kpi.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_staff' AND p.code = 'dashboard.personal.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_staff' AND p.code = 'ai.generate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_staff' AND p.code = 'notification.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_staff' AND p.code = 'admissions.result_update'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_staff' AND p.code = 'admissions.export'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_staff' AND p.code = 'admissions.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'ai.chat.use'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'ai.chat.use'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'ai.chat.use'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'ai.chat.use'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'ai.conversations.read_own'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'ai.conversations.read_own'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'ai.conversations.read_own'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'ai.conversations.read_own'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'ai.conversations.delete_own'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'ai.conversations.delete_own'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'dashboard.personal.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'dashboard.executive.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'task.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'kpi.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'team_report.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'team_report.export'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'admissions.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'admissions.export'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'ai.audit.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'ai.usage.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'notification.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'file_evidence.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'file_evidence.download'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'task.delete'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'task.approve'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'task.assign'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'task.update'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'ai.conversations.delete_own'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'task.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'kpi.delete'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'kpi.reopen'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'kpi.lock'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'kpi.review'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'kpi.update_actual'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'kpi.assign'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'kpi.create'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'kpi.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'team_report.review'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'team_report.remind'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'team_report.export'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'team_report.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.export'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.reopen'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.lock'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.sheet_sync_confirm'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.sheet_validate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.sheet_configure'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.result_update'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.allocate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.plan_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.campaign_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.catalog_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'admissions.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'dashboard.admin.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'dashboard.executive.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'dashboard.manager.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'dashboard.personal.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'system.ai_provider.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'ai.conversations.delete_own'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'ai.knowledge.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'system.integration.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'system.settings.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'system.settings.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'ai.prompt_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'ai.audit.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'ai.generate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'notification.broadcast'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'notification.remind'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'notification.send'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'notification.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'user_org.units.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'user_org.units.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'user_org.users.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'user_org.users.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'file_evidence.delete'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'file_evidence.download'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'file_evidence.upload'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'file_evidence.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'ai.knowledge.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'executive' AND p.code = 'ai.knowledge.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'ai.knowledge.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'ai.knowledge.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'ai.config.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'ai.usage.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'task.create'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'access_control.audit.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'access_control.user_roles.assign'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'access_control.user_roles.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'access_control.permissions.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'access_control.permissions.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'access_control.roles.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admin' AND p.code = 'access_control.roles.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_manager' AND p.code = 'admissions.campaign_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_manager' AND p.code = 'admissions.allocate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_manager' AND p.code = 'admissions.reopen'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.campaign_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.allocate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.reopen'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.sheet_validate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'task.delete'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'task.approve'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'task.assign'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'task.update'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'task.create'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'task.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'kpi.delete'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'kpi.reopen'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'kpi.lock'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'kpi.review'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'kpi.update_actual'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'kpi.assign'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'kpi.create'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'kpi.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'team_report.review'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'team_report.remind'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'team_report.export'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'team_report.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'admissions.export'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'admissions.sheet_sync_confirm'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'admissions.sheet_validate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'admissions.result_update'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'admissions.allocate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'admissions.plan_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'admissions.campaign_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'admissions.catalog_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'admissions.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'dashboard.manager.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'dashboard.personal.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'ai.generate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'notification.remind'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'notification.send'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'notification.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'user_org.units.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'user_org.users.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'file_evidence.download'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'file_evidence.upload'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'manager' AND p.code = 'file_evidence.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_manager' AND p.code = 'admissions.plan_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_manager' AND p.code = 'admissions.result_update'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'unit_tree'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_manager' AND p.code = 'admissions.export'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.plan_manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.result_update'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.export'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'all'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'admissions_admin' AND p.code = 'admissions.sheet_sync_confirm'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'task.update'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'task.create'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'task.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'kpi.update_actual'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'kpi.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'team_report.export'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'team_report.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'dashboard.personal.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'ai.generate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'notification.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'user_org.units.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'user_org.users.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'file_evidence.download'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'file_evidence.upload'
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r, public.access_permissions p
WHERE r.code = 'staff' AND p.code = 'file_evidence.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- --------------------------------------------------------------------
-- SECTION 2: GENERIC EDUCATIONAL ADMISSION GROUPS (Framework Levels)
-- --------------------------------------------------------------------
INSERT INTO public.admission_groups (code, name, description, is_active, sort_order)
VALUES
    ('TRUNG_CAP', 'Trung cấp', 'Chương trình đào tạo trình độ Trung cấp chính quy', TRUE, 1),
    ('NGAN_HAN', 'Đào tạo ngắn hạn', 'Các khóa đào tạo, bồi dưỡng kỹ năng nghề và chứng chỉ ngắn hạn', TRUE, 2)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- --------------------------------------------------------------------
-- SECTION 3: SYSTEM SETTINGS BASELINE TEMPLATE (School-Agnostic Defaults)
-- --------------------------------------------------------------------
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, is_public, setting_group, label, sort_order)
VALUES
    ('app_name', 'Phần mềm Quản lý Công việc & Đánh giá Hiệu quả KPI', 'text', TRUE, 'general', 'Tên ứng dụng', 1),
    ('timezone', 'Asia/Ho_Chi_Minh', 'text', TRUE, 'general', 'Múi giờ hệ thống', 2),
    ('date_format', 'DD/MM/YYYY', 'text', TRUE, 'general', 'Định dạng ngày', 3),
    ('language', 'vi', 'text', TRUE, 'general', 'Ngôn ngữ mặc định', 4),
    ('appearance_mode', 'dark', 'text', TRUE, 'general', 'Giao diện hiển thị', 5),
    ('appearance_accent', 'indigo', 'text', TRUE, 'general', 'Màu chủ đạo', 6),
    ('logo_url', '/system-assets/logo.png', 'text', TRUE, 'general', 'Đường dẫn logo', 7),
    ('favicon_url', '/system-assets/favicon.ico', 'text', TRUE, 'general', 'Đường dẫn favicon', 8),
    ('ai_global_config', '{"provider":"gemini","enabled":true}', 'text', FALSE, 'ai', 'Cấu hình AI toàn hệ thống', 9)
ON CONFLICT (setting_key) DO UPDATE SET
    setting_type = EXCLUDED.setting_type,
    is_public = EXCLUDED.is_public,
    setting_group = EXCLUDED.setting_group,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order;

-- --------------------------------------------------------------------
-- SECTION 4: AI USAGE SETTINGS DEFAULT (Initial System Rate Limits)
-- --------------------------------------------------------------------
INSERT INTO public.ai_usage_settings (
    ai_service_enabled,
    user_daily_request_limit,
    user_daily_token_limit,
    system_monthly_token_limit,
    system_monthly_budget_limit,
    per_user_minute_request_limit,
    per_user_concurrent_limit,
    warning_threshold_pct,
    timezone,
    reservation_timeout_seconds
)
SELECT 
    TRUE,
    100,
    200000,
    5000000,
    50.0,
    10,
    2,
    80,
    'Asia/Ho_Chi_Minh',
    300
WHERE NOT EXISTS (SELECT 1 FROM public.ai_usage_settings);

-- --------------------------------------------------------------------
-- SECTION 5: DEFAULT AI PROMPT REGISTRY (Standard Prompt Templates)
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_prompt_def_id UUID;
BEGIN
    -- 1. Definition: staff_kpi_summary
    INSERT INTO public.ai_prompt_definitions (prompt_key, name, description, feature_group, enabled)
    VALUES (
        'staff_kpi_summary',
        'Tổng hợp & Đánh giá KPI Nhân viên',
        'Prompt chuẩn phân tích kết quả công việc và KPI của nhân sự hàng kỳ',
        'kpi',
        TRUE
    )
    ON CONFLICT (prompt_key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        feature_group = EXCLUDED.feature_group,
        enabled = EXCLUDED.enabled
    RETURNING id INTO v_prompt_def_id;

    IF v_prompt_def_id IS NULL THEN
        SELECT id INTO v_prompt_def_id FROM public.ai_prompt_definitions WHERE prompt_key = 'staff_kpi_summary';
    END IF;

    -- 2. Version 1 of staff_kpi_summary
    IF NOT EXISTS (SELECT 1 FROM public.ai_prompt_versions WHERE prompt_definition_id = v_prompt_def_id AND version_number = 1) THEN
        INSERT INTO public.ai_prompt_versions (
            prompt_definition_id,
            version_number,
            status,
            system_prompt,
            user_prompt_template,
            output_mode,
            default_temperature,
            default_max_output_tokens,
            notes
        )
        VALUES (
            v_prompt_def_id,
            1,
            'active',
            'Bạn là trợ lý AI chuyên nghiệp hỗ trợ phân tích hiệu quả công việc và chỉ số KPI trong môi trường giáo dục đào tạo.',
            'Phân tích kết quả KPI của nhân sự theo ngữ cảnh dữ liệu sau: {{kpi_context}}',
            'markdown',
            0.2,
            2048,
            'Phiên bản khởi tạo mặc định cho hệ thống'
        );
    END IF;
END $$;
