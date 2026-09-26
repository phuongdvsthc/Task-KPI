-- ==============================================================================
-- MIGRATION: v0.9-AI-A4_assistant_rbac_integration.sql
-- Description: AI Assistant v1 - RBAC Permission Registration & Role-Permission Grants
-- Capabilities: ai.chat.use, ai.conversations.read_own, ai.conversations.delete_own,
--               ai.knowledge.view, ai.knowledge.manage, ai.config.manage, ai.usage.view
-- ==============================================================================

BEGIN;

-- 1. Ensure 'ai' module exists in access_modules (Module ID lookup)
INSERT INTO public.access_modules (code, name, description, is_active, sort_order)
VALUES ('ai', 'Dịch vụ AI', 'Sinh nội dung, audit và trợ lý AI', true, 70)
ON CONFLICT (code) DO UPDATE
SET is_active = true,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 2. Upsert the 7 AI Assistant Capabilities into access_permissions
-- Note: 'ai.usage.view' already exists in baseline, ON CONFLICT will safely update attributes.
-- Data scope: 
-- - 'ai.conversations.read_own' and 'ai.conversations.delete_own' support data scope (scope: own)
-- - Others are feature/action capabilities with supports_data_scope = false
INSERT INTO public.access_permissions (
    module_id,
    code,
    name,
    description,
    action_code,
    supports_data_scope,
    risk_level,
    sort_order,
    is_active
) VALUES
(
    (SELECT id FROM public.access_modules WHERE code = 'ai'),
    'ai.chat.use',
    'Sử dụng Trợ lý AI',
    'Trò chuyện và tương tác với Trợ lý AI',
    'use',
    false,
    'normal',
    10,
    true
),
(
    (SELECT id FROM public.access_modules WHERE code = 'ai'),
    'ai.conversations.read_own',
    'Xem lịch sử chat cá nhân',
    'Xem các cuộc hội thoại và tin nhắn do chính mình tạo',
    'read_own',
    true,
    'normal',
    12,
    true
),
(
    (SELECT id FROM public.access_modules WHERE code = 'ai'),
    'ai.conversations.delete_own',
    'Xóa lịch sử chat cá nhân',
    'Xóa các cuộc hội thoại do chính mình tạo',
    'delete_own',
    true,
    'normal',
    14,
    true
),
(
    (SELECT id FROM public.access_modules WHERE code = 'ai'),
    'ai.knowledge.view',
    'Sử dụng kho kiến thức AI',
    'Tìm kiếm và trích dẫn tài liệu từ kho kiến thức chung đã xuất bản',
    'view',
    false,
    'normal',
    20,
    true
),
(
    (SELECT id FROM public.access_modules WHERE code = 'ai'),
    'ai.knowledge.manage',
    'Quản lý kho kiến thức AI',
    'Tải lên, biên tập, xuất bản và xóa tài liệu kho kiến thức',
    'manage',
    false,
    'sensitive',
    25,
    true
),
(
    (SELECT id FROM public.access_modules WHERE code = 'ai'),
    'ai.config.manage',
    'Quản trị cấu hình AI',
    'Quản lý tham số mô hình, prompt hệ thống và tích hợp AI',
    'manage',
    false,
    'critical',
    50,
    true
),
(
    (SELECT id FROM public.access_modules WHERE code = 'ai'),
    'ai.usage.view',
    'Xem thống kê AI',
    'Xem thống kê sử dụng token và lượt gọi AI',
    'view',
    false,
    'normal',
    30,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    action_code = EXCLUDED.action_code,
    supports_data_scope = EXCLUDED.supports_data_scope,
    risk_level = EXCLUDED.risk_level,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = NOW();

-- 3. Grant Default Base Capabilities to 4 System Roles: staff, manager, executive, admin
-- Base capabilities: ai.chat.use (none), ai.conversations.read_own (own), ai.conversations.delete_own (own), ai.knowledge.view (none)

-- 3.1. ai.chat.use (scope: none)
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r
CROSS JOIN public.access_permissions p
WHERE r.code IN ('staff', 'manager', 'executive', 'admin')
  AND p.code = 'ai.chat.use'
ON CONFLICT (role_id, permission_id) DO UPDATE SET scope_code = EXCLUDED.scope_code, updated_at = NOW();

-- 3.2. ai.conversations.read_own (scope: own)
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r
CROSS JOIN public.access_permissions p
WHERE r.code IN ('staff', 'manager', 'executive', 'admin')
  AND p.code = 'ai.conversations.read_own'
ON CONFLICT (role_id, permission_id) DO UPDATE SET scope_code = EXCLUDED.scope_code, updated_at = NOW();

-- 3.3. ai.conversations.delete_own (scope: own)
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'own'
FROM public.access_roles r
CROSS JOIN public.access_permissions p
WHERE r.code IN ('staff', 'manager', 'executive', 'admin')
  AND p.code = 'ai.conversations.delete_own'
ON CONFLICT (role_id, permission_id) DO UPDATE SET scope_code = EXCLUDED.scope_code, updated_at = NOW();

-- 3.4. ai.knowledge.view (scope: none)
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r
CROSS JOIN public.access_permissions p
WHERE r.code IN ('staff', 'manager', 'executive', 'admin')
  AND p.code = 'ai.knowledge.view'
ON CONFLICT (role_id, permission_id) DO UPDATE SET scope_code = EXCLUDED.scope_code, updated_at = NOW();

-- 4. Grant Admin Capabilities EXCLUSIVELY to Admin: ai.knowledge.manage, ai.config.manage, ai.usage.view
-- Admin capabilities: scope: none (non-data-scope system administrative controls)

-- 4.1. ai.knowledge.manage -> admin only
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r
CROSS JOIN public.access_permissions p
WHERE r.code = 'admin'
  AND p.code = 'ai.knowledge.manage'
ON CONFLICT (role_id, permission_id) DO UPDATE SET scope_code = EXCLUDED.scope_code, updated_at = NOW();

-- 4.2. ai.config.manage -> admin only
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r
CROSS JOIN public.access_permissions p
WHERE r.code = 'admin'
  AND p.code = 'ai.config.manage'
ON CONFLICT (role_id, permission_id) DO UPDATE SET scope_code = EXCLUDED.scope_code, updated_at = NOW();

-- 4.3. ai.usage.view -> ensure admin has grant (preserving executive grant if existing)
INSERT INTO public.access_role_permissions (role_id, permission_id, scope_code)
SELECT r.id, p.id, 'none'
FROM public.access_roles r
CROSS JOIN public.access_permissions p
WHERE r.code = 'admin'
  AND p.code = 'ai.usage.view'
ON CONFLICT (role_id, permission_id) DO UPDATE SET scope_code = EXCLUDED.scope_code, updated_at = NOW();

COMMIT;
