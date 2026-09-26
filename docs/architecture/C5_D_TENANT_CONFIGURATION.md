# Báo Cáo Triển Khai v0.9-C5-D: Tạo Cấu Hình Riêng Cho Từng Trường (Tenant Configuration & Isolation)

> **Trạng thái:** HOÀN THÀNH (100% PASS SELF-TESTS)  
> **Thời điểm thực hiện:** 26/09/2026  
> **Nguyên tắc tuân thủ:**
> - Tuyệt đối không chạy migration/seed trên production, không sửa đổi dữ liệu STHC đang vận hành.
> - Cơ chế Single Codebase – Isolated Database: mỗi trường sở hữu một Supabase Project / database riêng biệt.
> - Tuyệt đối không lưu API Key, Service Role Key, Password vào file cấu hình JSON hay Git.
> - Chặn triệt để API/nút nạp dữ liệu mẫu STHC ở mọi trường khác.
> - Không tạo tài khoản Admin/ROOT tại bước này (thuộc phạm vi C5-E).
> - Dừng lại tại mốc C5-D; chưa tuyên bố cài đặt database trắng thành công trước C5-G.

---

## 1. Kiến Trúc Cấu Hình Đa Cơ Sở (Multi-Tenant by Database Isolation)

Hệ thống được thiết kế theo mô hình **Database-per-Tenant** (Mỗi cơ sở đào tạo sử dụng một Supabase Project / PostgreSQL database độc lập):
1. **Dùng chung mã nguồn (Single Codebase):** Toàn bộ Frontend (React + Vite) và Backend (Node.js/Express) phục vụ chung cho tất cả các cơ sở đào tạo.
2. **Dùng chung chuỗi Migration Schema & Seed Nền:** 9 migration file (`supabase/migrations/`) và seed nền chuẩn (`supabase/seeds/00001_core_baseline_seed.sql`) được chạy đồng nhất trên database của bất kỳ trường nào.
3. **Cấu hình độc lập (Tenant Parameterization):** Thông tin nhận diện trường, đơn vị ROOT, và danh sách module được kích hoạt được định nghĩa qua file cấu hình `tenant.config.json` và nạp vào database thông qua engine `scripts/apply-tenant-config.ts`.

---

## 2. File Mẫu `tenant.config.example.json` & Quy Tắc Xác Thực

### 2.1. File mẫu chuẩn (`tenant.config.example.json`)
File mẫu được đặt tại thư mục gốc của dự án kèm JSON Schema (`docs/architecture/tenant.config.schema.json`):

```json
{
  "$schema": "./docs/architecture/tenant.config.schema.json",
  "tenantCode": "VTC",
  "tenantName": "Trường Cao đẳng Công nghệ và Du lịch",
  "tenantShortName": "VTC",
  "contactInfo": {
    "email": "tuyensinh@vtc.edu.vn",
    "phone": "028 3822 5900",
    "address": "Số 123 Đường Nguyễn Tri Phương, Phường 5, Quận 10, TP. Hồ Chí Minh"
  },
  "website": "https://vtc.edu.vn",
  "timezone": "Asia/Ho_Chi_Minh",
  "dateFormat": "DD/MM/YYYY",
  "locale": "vi",
  "rootUnit": {
    "code": "VTC",
    "name": "Trường Cao đẳng Công nghệ và Du lịch",
    "unitType": "school",
    "description": "Đơn vị gốc cấp trường (ROOT)"
  },
  "enabledModules": [
    "task",
    "kpi",
    "team_report",
    "admissions",
    "dashboard",
    "system",
    "ai",
    "notification",
    "user_org",
    "file_evidence",
    "access_control"
  ],
  "appName": "Hệ thống Quản lý Công việc & Đánh giá KPI - VTC",
  "logoPath": "/system-assets/logo.png",
  "logoSmallPath": "/system-assets/logo-small.png",
  "faviconPath": "/system-assets/favicon.ico",
  "dailyReportDeadline": "17:30",
  "workingDays": "1,2,3,4,5",
  "appearanceMode": "light",
  "appearanceAccent": "indigo"
}
```

### 2.2. Quy tắc kiểm tra cấu hình (`validateTenantConfig`)
Bộ kiểm tra tại `src/types/tenant-config.ts` thực thi các ràng buộc nghiêm ngặt:
1. **Kiểm tra an toàn bí mật (Zero-Secret Invariant):**
   - Quét toàn bộ khóa JSON: Nếu phát hiện bất kỳ khóa nào như `apikey`, `api_key`, `service_role`, `service_role_key`, `password`, `jwt`, `private_key`, hệ thống **lập tức từ chối** cấu hình với cảnh báo vi phạm bảo mật.
   - Quét regex chuỗi token JWT trong giá trị để ngăn việc vô tình dán token vào URL/text.
   - Mọi thông tin xác thực database **bắt buộc** phải cung cấp qua biến môi trường (`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
2. **Định dạng `tenantCode`:** Bắt buộc từ 2-20 ký tự chữ in hoa, chữ số hoặc gạch nối (Regex: `^[A-Z0-9_-]{2,20}$`).
3. **Thông tin liên hệ (`contactInfo`):** Email bắt buộc hợp lệ, điện thoại và địa chỉ không được rỗng.
4. **Đơn vị ROOT (`rootUnit`):** Bắt buộc có `code`, `name`.
5. **Danh mục module (`enabledModules`):** Phải là danh sách con hợp lệ thuộc 11 module hệ thống:
   `task`, `kpi`, `team_report`, `admissions`, `dashboard`, `system`, `ai`, `notification`, `user_org`, `file_evidence`, `access_control`.

---

## 3. Quy Trình Áp Dụng Cấu Hình (`scripts/apply-tenant-config.ts`)

Quy trình nạp cấu hình được thực hiện sau chuỗi 9 migration DDL và seed nền:

```
[Blank Supabase DB] 
        ↓ 
1. 00001 - 00009 DDL Migrations (Tạo 57 bảng, 2 views, RPCs, Storage)
        ↓ 
2. 00001_core_baseline_seed.sql (Tạo 11 modules, 7 roles, 67 perms, 177 role_perms)
        ↓ 
3. scripts/apply-tenant-config.ts (Nạp tenant.config.json & tạo ROOT unit)
        ↓ 
4. [DỪNG TẠI ĐÂY] (Chưa tạo tài khoản Admin - dành riêng cho C5-E)
```

### Các chốt chặn an toàn trong script:
1. **Ngăn chặn xung đột Tenant (Cross-Tenant Collision Guard):**
   - Đọc giá trị `tenant_code` từ bảng `system_settings`.
   - Nếu database đã có `tenant_code` và khác với `config.tenantCode`, script **hủy bỏ ngay lập tức** với lỗi nghiêm trọng:
     `NGĂN CHẶN XUNG ĐỘT TENANT (CROSS-TENANT VIOLATION): Cơ sở dữ liệu hiện đã được cấu hình cho trường có mã 'STHC'. Không thể áp dụng cấu hình của trường 'VTC'.`
2. **Khởi tạo và bảo vệ đơn vị ROOT (`organization_units`):**
   - Kiểm tra xem đã có đơn vị ROOT (`parent_id IS NULL`) chưa.
   - Nếu chưa có: Tạo đơn vị ROOT duy nhất với mã và tên trường từ cấu hình.
   - Nếu đã có: Cập nhật thông tin nếu là cài đặt ban đầu; tuyệt đối không tạo đơn vị ROOT thứ hai gây gãy cây tổ chức.
3. **Bảo toàn thiết lập tùy chỉnh của Quản trị viên (Admin Customization Invariant):**
   - Khi chạy lại (idempotent re-run), script kiểm tra cột `updated_by` trên từng bản ghi của `system_settings`.
   - Nếu `updated_by IS NOT NULL` (nghĩa là Quản trị viên đã chỉnh sửa thông số này trên giao diện), script **bỏ qua và bảo toàn nguyên vẹn giá trị của trường**, không ghi đè giá trị mặc định từ file cấu hình.
4. **Đồng bộ trạng thái `access_modules.is_active`:**
   - Cập nhật cờ `is_active` trong `access_modules` tương ứng với `enabledModules`.
   - **Cam kết:** Việc tắt module chỉ chuyển `is_active = false`, **hoàn toàn không xóa dữ liệu** lịch sử và **không thay đổi phân quyền RBAC** đã lưu.
5. **Chính sách Zero-User (Không tạo tài khoản người dùng):**
   - Script hoàn toàn không thao tác với Supabase Auth, bảng `profiles`, hay `access_user_roles`. Việc tạo First Admin được bảo lưu riêng cho bước C5-E.

---

## 4. Xóa Bỏ Hardcode STHC & Chuyển Sang Nhận Diện Động

Đã rà soát và loại bỏ toàn bộ các điểm phụ thuộc cứng vào STHC trong mã nguồn:

| Vị trí mã nguồn | Trạng thái cũ (Hardcoded STHC) | Trạng thái mới (Dynamic Tenant / Generic Fallback) |
| :--- | :--- | :--- |
| `src/services/ai/gateway/aiAssistantPromptBuilder.ts` | `'Trường Cao đẳng Du lịch Sài Gòn (STHC)'` | `'Cơ sở đào tạo / Nhà trường'` (hoặc lấy từ `options.organizationName`) |
| `src/lib/supabase/client.ts` | `'x-client-info': 'sthc-work-kpi'` | `'x-client-info': 'school-work-kpi'` |
| `src/components/admin/users/UserForm.tsx` | `placeholder="email@sthc.edu.vn"` | `placeholder="user@school.edu.vn"` |
| `src/components/dashboard/DashboardView.tsx` | `'admin@sthc.edu.vn'` | `'admin@school.edu.vn'` |
| `src/components/layout/Header.tsx` | Đã đọc từ `settings.organizationName` | Tiếp tục củng cố với generic fallback |
| `src/components/layout/Sidebar.tsx` | Đã đọc từ `settings.organizationShortName` | Tiếp tục củng cố với generic fallback |

---

## 5. Cơ Chế Chặn Module Bị Tắt (Menu, Route & API)

Khi một module bị tắt trong `enabledModules` (ví dụ trường chỉ dùng Công việc và KPI, không dùng Tuyển sinh):

### 5.1. Menu Điều Hướng (`Sidebar.tsx`)
Hàm `isModuleEnabled(moduleCode)` lọc danh sách menu trước khi render:
- Không hiển thị mục menu của các module bị tắt.
- Tự động phản ứng ngay khi `settings.enabledModules` thay đổi.

### 5.2. Chặn Route Trực Tiếp (`RouteGuard.tsx` & `routeMetadata.ts`)
Khi người dùng cố tình truy cập trực tiếp bằng URL/hash (ví dụ `#/admissions/overview`):
- `evaluateRouteAuthorization` đối chiếu `config.module` với `enabledModules`.
- Nếu module bị tắt, trả về trạng thái `status: 'module_disabled'`.
- `RouteGuard.tsx` chặn không mount component con hay gọi network request, hiển thị thông báo thân thiện:  
  *"Tính năng chưa được kích hoạt: Phân hệ này hiện chưa được bật trong cấu hình của cơ sở đào tạo. Vui lòng liên hệ Quản trị viên hệ thống để mở rộng cấu hình."* kèm nút *"Quay về Tổng quan"*.

### 5.3. Chặn Backend API (`server.ts`)
Middleware `requireTenantModule(moduleCode)` bảo vệ các endpoint backend:
- Kiểm tra danh sách `enabled_modules` từ `system_settings` (có in-memory cache 10 giây).
- Nếu module bị tắt, API trả về ngay **HTTP 403 Forbidden**:
  ```json
  {
    "success": false,
    "error": "Phân hệ 'admissions' đã bị vô hiệu hóa cho cơ sở đào tạo này.",
    "code": "MODULE_DISABLED",
    "module": "admissions"
  }
  ```
- Đã gắn middleware vào: `/api/admissions`, `/api/rpc/finalize_admission_result`, `/api/rpc/reopen_admission_result`, `/api/admin/ai`, `/api/ai`.

---

## 6. Chặn Triệt Để Nút & API Nạp Dữ Liệu Mẫu STHC

Dữ liệu mẫu tuyển sinh của STHC (12 ngành học, kế hoạch 2026 với 1.320 học viên) là dữ liệu riêng của STHC, tuyệt đối không được phép nạp vào các trường khác:

1. **Chặn tại Service Frontend (`admissionService.ts` & `admissionPlanService.ts`):**
   - Trong `seedStandardPrograms()`: Kiểm tra `publicSettings.tenantCode !== 'STHC'`. Nếu không phải STHC, ném lỗi:  
     *“Chức năng nạp danh mục ngành chuẩn STHC chỉ được phép sử dụng cho cơ sở STHC.”*
   - Trong `seedOfficial2026Plans()`: Kiểm tra `publicSettings.tenantCode !== 'STHC'`. Nếu không phải STHC, ném lỗi:  
     *“Chức năng nạp kế hoạch mẫu 2026 của STHC chỉ được phép sử dụng cho cơ sở STHC.”*
2. **Ẩn nút bấm trên Giao diện (`ProgramListView.tsx` & `AnnualPlanListView.tsx`):**
   - Nút `seed-standard-sthc-btn` (“Nạp 12 ngành chuẩn STHC”) chỉ hiển thị khi `isAdmin && settings?.tenantCode === 'STHC'`.
   - Nút `btn-seed-2026-official-plans` (“Khởi tạo kế hoạch 2026 (1.320)”) chỉ hiển thị khi `(isAdmin || isManager) && settings?.tenantCode === 'STHC'`.
3. **Chặn tại Backend Router (`server.ts`):**
   - Middleware `guardSthcOnlySeed` chặn toàn bộ request gửi tới `/api/admissions/seed*` hoặc `/api/seed*` nếu `system_settings.tenant_code !== 'STHC'`.

---

## 7. Rà Soát & Đối Chiếu `ON CONFLICT DO UPDATE` Trong Seed Nền

Để đảm bảo khi chạy lại `00001_core_baseline_seed.sql` không ghi đè lên cấu hình và phân quyền tùy chỉnh của trường, toàn bộ các mệnh đề `ON CONFLICT` đã được rà soát và chuẩn hóa:

| Bảng dữ liệu | Mệnh đề xử lý xung đột | Cột cho phép cập nhật khi chạy lại | Cột BẢO TOÀN (Không ghi đè) | Đánh giá an toàn |
| :--- | :--- | :--- | :--- | :--- |
| `access_modules` | `ON CONFLICT (code) DO UPDATE` | `name`, `description`, `sort_order` | **`is_active`** (Bảo toàn trạng thái tắt/bật module của từng trường) |  AN TOÀN |
| `access_roles` | `ON CONFLICT (code) DO UPDATE` | `name`, `description`, `level`, `is_system` | **`is_active`** (Bảo toàn tùy chỉnh vai trò; các vai trò riêng không bị ảnh hưởng) |  AN TOÀN |
| `access_permissions` | `ON CONFLICT (code) DO UPDATE` | `name`, `description`, `action_code`, `supports_data_scope`, `risk_level`, `sort_order`, `is_active` | Giữ chuẩn hóa permission hệ thống |  AN TOÀN |
| `access_role_permissions` (177 bản ghi) | **`ON CONFLICT (role_id, permission_id) DO NOTHING`** | *(Không cập nhật)* | **Toàn bộ bản ghi đã có** (Bảo toàn phạm vi scope_code mà trường đã tùy biến) |  AN TOÀN TUYỆT ĐỐI |
| `system_settings` (Template) | `ON CONFLICT (setting_key) DO UPDATE` | `setting_type`, `is_public`, `setting_group`, `label`, `sort_order` | **`setting_value`** (Bảo toàn 100% giá trị thiết lập của trường) |  AN TOÀN TUYỆT ĐỐI |
| `ai_usage_settings` | `WHERE NOT EXISTS` | *(Không cập nhật)* | Toàn bộ thông số rate-limit của trường |  AN TOÀN TUYỆT ĐỐI |
| `ai_prompt_definitions` | `WHERE NOT EXISTS` | *(Không cập nhật)* | Toàn bộ prompt đã chỉnh sửa của trường |  AN TOÀN TUYỆT ĐỐI |
| `admission_groups` | `ON CONFLICT (code) DO UPDATE` | `name`, `description`, `sort_order` | **`is_active`** |  AN TOÀN |

> **LƯU Ý ĐẶC BIỆT VỀ 57 BẢNG:**  
> Con số **57 bảng** và **2 views** hiện tại chỉ xác nhận **số lượng bảng và cấu trúc cột chính qua PostgREST/OpenAPI**, **chưa xác nhận schema khớp 100% từng kiểu dữ liệu, index, trigger nội bộ** so với production database do chưa có bằng chứng catalog đầy đủ từ Supabase SQL Editor. Chi tiết này được giữ ở trạng thái chưa xác minh và sẽ kiểm chứng đối chiếu trên database trắng tại bước **C5-G**.

---

## 8. Kết Quả Tự Kiểm Tra Tự Động (Self-Test Suite)

Script tự kiểm `scripts/test-c5-d-tenant-config.ts` đã chạy 24 test cases mô phỏng 2 trường giả định:
- **Trường Alpha (`VTC`):** Trường Cao đẳng Công nghệ và Du lịch, ROOT: `VTC`, tắt module `admissions` và `ai`.
- **Trường Beta (`CCT`):** Trường Cao đẳng Công Thương TP.HCM, ROOT: `CCT`, tắt module `kpi` và `team_report`.

### Kết quả chi tiết (24/24 PASS):
```
================================================================
   v0.9-C5-D TENANT CONFIGURATION & ISOLATION SELF-TEST SUITE   
================================================================

--- TEST GROUP 1: Config Validation & Secret Leak Prevention ---
[PASS] Test 1: Valid Alpha config passes validation
[PASS] Test 2: Valid Beta config passes validation
[PASS] Test 3: Rejects config containing API key/secret
[PASS] Test 4: Rejects config containing JWT token
[PASS] Test 5: Rejects invalid tenantCode format
[PASS] Test 6: Rejects unsupported module code

--- TEST GROUP 2: Provisioning Engine on Fresh Database ---
[PASS] Test 7: Successfully applied Tenant Alpha (VTC) config
[PASS] Test 8: Detected as initial tenant setup
[PASS] Test 9: Created exactly 1 ROOT unit
[PASS] Test 10: ROOT unit code is VTC
[PASS] Test 11: tenant_code setting is VTC
[PASS] Test 12: Admissions module is set to is_active=false for VTC

--- TEST GROUP 3: Cross-Tenant Protection & Collision Guard ---
[PASS] Test 13: Cross-Tenant Collision Guard successfully aborted Beta application to Alpha database

--- TEST GROUP 4: Idempotent Re-Run & Admin Setting Protection ---
[PASS] Test 14: Safe re-run of Alpha config succeeded
[PASS] Test 15: Correctly detected as safe update (not initial setup)
[PASS] Test 16: Preserved admin-customized setting without overwrite
[PASS] Test 17: Admin-customized app_name was NOT overwritten on re-run

--- TEST GROUP 5: Frontend Route & Module Enablement Enforcement ---
[PASS] Test 18: Route evaluation blocks admissions when module is disabled in tenant config
[PASS] Test 19: Route evaluation authorizes tasks when module is enabled
[PASS] Test 20: Route evaluation authorizes admissions for Beta tenant

--- TEST GROUP 6: STHC Seed Blocker for Non-STHC Tenants ---
[PASS] Test 21: STHC standard programs seed is strictly blocked for Tenant Alpha (VTC)
[PASS] Test 22: STHC standard programs seed is strictly blocked for Tenant Beta (CCT)
[PASS] Test 23: STHC tenant retains permission to run STHC sample seeds

--- TEST GROUP 7: Zero-User Policy Verification ---
[PASS] Test 24: Zero User/Admin accounts created by C5-D (strictly reserved for C5-E)

================================================================
  ALL 24/24 TESTS PASSED SUCCESSFULLY! (100% PASS) 
================================================================
```

---

## 9. Hướng Dẫn Vận Hành Triển Khai Cho Trường Mới

Khi triển khai một trường mới (chạy ở C5-G):

1. **Chuẩn bị cấu hình:**
   ```bash
   cp tenant.config.example.json tenant.config.json
   # Chỉnh sửa mã trường, tên trường, ROOT unit, và danh sách enabledModules
   ```
2. **Thiết lập biến môi trường kết nối database của trường:**
   ```bash
   export VITE_SUPABASE_URL="https://<school-project-id>.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="<school-service-role-key>"
   ```
3. **Chạy Migration & Seed Nền:**
   - Chạy tuần tự 9 migration tại `supabase/migrations/00001_...` đến `00009_...`.
   - Chạy file seed nền: `supabase/seeds/00001_core_baseline_seed.sql`.
4. **Áp dụng cấu hình trường:**
   ```bash
   npx tsx scripts/apply-tenant-config.ts tenant.config.json
   ```
5. **Tiếp theo:** Tiến hành bước **C5-E (First Admin Bootstrap)** để tạo tài khoản Quản trị viên đầu tiên cho trường.

---

## 10. Điểm Dừng Kỹ Thuật & Trạng Thái Bàn Giao

- **ĐÃ HOÀN THÀNH ĐẦY ĐỦ C5-D**: Cấu hình mẫu, schema xác thực, script provisioning, cơ chế bảo vệ cross-tenant, chặn module bị tắt, chặn dữ liệu STHC và chuẩn hóa `ON CONFLICT DO NOTHING`.
- **TUYỆT ĐỐI KHÔNG TẠO ADMIN**: Không có tài khoản admin hay user nào được sinh ra ở bước này.
- **CHƯA TUYÊN BỐ CÀI ĐẶT DATABASE TRẮNG**: Chỉ tuyên bố hoàn thành triển khai thực tế trên database trắng sau khi hoàn tất diễn tập tại **C5-G**.
- **DỪNG TẠI C5-D** theo đúng yêu cầu đề bài.
