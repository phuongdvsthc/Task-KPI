# Tài Liệu Runbook & Checklist Cài Đặt Thử Nghiệm Trên Supabase Project Trắng (v0.9-C5-G)

> **Trạng thái:** CHUẨN BỊ RUNBOOK & CHECKLIST HOÀN TẤT (DỪNG TẠI C5-G)  
> **Nguyên tắc cốt lõi:**
> - Tuyệt đối không sử dụng môi trường production STHC để thay thế cho project trắng.
> - Do chưa được cung cấp một Supabase Project trắng chuyên dụng hoàn toàn trống ngoài môi trường vận hành hiện tại, tuân thủ nghiêm ngặt chỉ thị: **Chuẩn bị đầy đủ lệnh và checklist vận hành, dừng lại tại C5-G, không tự động đánh PASS giả định.**

---

## 1. Tổng Quan Quy Trình Cài Đặt Trắng (Trial Installation Pipeline)

Quy trình chuẩn hóa để triển khai ứng dụng lên một Supabase Project hoàn toàn trống (Blank Project) gồm 4 giai đoạn tuần tự:
1. **Giai đoạn 1: Khởi tạo Schema DDL (Migrations 00001 - 00009)**
2. **Giai đoạn 2: Nạp Seed Nền Chuẩn (Core Baseline Seed)**
3. **Giai đoạn 3: Nạp Cấu Hình Trường (Tenant Configuration Provisioning)**
4. **Giai đoạn 4: Bootstrap Quản Trị Viên Đầu Tiên (First Admin Bootstrap)**

---

## 2. Checklist Xác Minh Trước Khi Chạy (Pre-Execution Verification)

Trước khi thực thi lệnh trên project trắng, operator bắt buộc phải hoàn thành checklist sau và ghi nhận bằng chứng:
- [ ] **Xác minh Project URL & Project ID:** Ghi nhận URL chính thức của project thử nghiệm (ví dụ: `https://<trial-project-id>.supabase.co`).
- [ ] **Xác nhận Database Trống:** Kết nối qua Supabase SQL Editor hoặc CLI và chạy câu lệnh kiểm tra catalog `information_schema.tables`:
  ```sql
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public';
  ```
  *Yêu cầu kết quả:* Phải trả về danh sách **rỗng (0 bảng)**. Nếu database đã tồn tại bảng ứng dụng, dừng lại ngay lập tức để tránh ghi đè dữ liệu cũ.
- [ ] **Thiết lập Biến Môi Trường Bảo Mật:**
  ```bash
  export VITE_SUPABASE_URL="https://<trial-project-id>.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="<trial-service-role-key>"
  ```

---

## 3. Các Bước Thực Thi Chi Tiết (Execution Runbook)

### Bước 1: Chạy Chuỗi 9 Migration DDL
Thực thi tuần tự các file migration trong `supabase/migrations/` hoặc chạy script tự động migration qua Node.js:
```bash
node run_migration.cjs
# Hoặc thực thi tuần tự qua Supabase CLI / SQL Editor:
# - 00001_core_schema_and_extensions.sql
# - 00002_rbac_and_profiles.sql
# - 00003_access_control_rbac.sql
# - ... đến 00009
```
*Bằng chứng log cần lưu:* Nhật ký migration thành công, xác nhận tạo lập 57 bảng và 2 views.

### Bước 2: Chạy Seed Nền Chuẩn (Core Baseline Seed)
Thực thi seed nền trường trung lập (không có dữ liệu STHC):
```bash
psql "$DATABASE_URL" -f supabase/seeds/00001_core_baseline_seed.sql
```
*Kiểm tra:* Xác nhận nạp thành công 11 modules, 7 roles (4 system + 3 domain), 67 permissions, và 177 role-permission matrix mappings với `ON CONFLICT DO NOTHING`.

### Bước 3: Áp Dụng Cấu Hình Trường (Tenant Configuration)
Tạo file `tenant.config.json` (dựa trên `tenant.config.example.json`):
```json
{
  "$schema": "./docs/architecture/tenant.config.schema.json",
  "tenantCode": "TRIAL",
  "tenantName": "Trường Cao đẳng Thử Nghiệm",
  "tenantShortName": "TRIAL",
  "contactInfo": {
    "email": "contact@trial.edu.vn",
    "phone": "028 0000 0000",
    "address": "123 Đường Test, TP.HCM"
  },
  "website": "https://trial.edu.vn",
  "timezone": "Asia/Ho_Chi_Minh",
  "rootUnit": {
    "code": "TRIAL",
    "name": "Trường Cao đẳng Thử Nghiệm",
    "unitType": "school"
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
  ]
}
```
Thực thi lệnh cấu hình:
```bash
npx tsx scripts/apply-tenant-config.ts tenant.config.json
```
*Bằng chứng log cần lưu:* Xác nhận khởi tạo thành công đơn vị ROOT và thiết lập các thông số cơ sở trong `system_settings`.

### Bước 4: Bootstrap Quản Trị Viên Đầu Tiên (First Admin Bootstrap)
Thực thi lệnh bootstrap admin gắn với đơn vị ROOT:
```bash
export BOOTSTRAP_ADMIN_EMAIL="admin@trial.edu.vn"
export BOOTSTRAP_ADMIN_FULL_NAME="Quản trị viên Trial"
npx tsx scripts/bootstrap-first-admin.ts
```
*Lưu ý:* Lưu trữ mật khẩu ngẫu nhiên được sinh ra ở stdout.

---

## 4. Checklist Kiểm Tra Thực Tế Sau Khi Cài Đặt (Post-Installation Verification)

Sau khi hoàn tất 4 bước trên trên Supabase Project trắng, thực hiện các bài kiểm tra thực tế sau:

1. **Kiểm tra Schema Catalog Chi Tiết:**
   - Đối chiếu tên bảng, view, hàm (`pg_proc`), triggers, Foreign Keys, Unique/Check constraints, Indexes, và RLS policies.
   - Xác nhận 4 Storage buckets chuẩn đã được khởi tạo (`system-assets`, `task-evidence`, `daily-reports`, `admissions-evidence`).
2. **Kiểm tra Đăng Nhập & Phân Quyền Admin:**
   - Đăng nhập bằng tài khoản Admin mới tạo.
   - Kiểm tra hồ sơ cá nhân: Thuộc đúng đơn vị ROOT (`TRIAL`), mang vai trò `admin`, có đầy đủ quyền hiệu lực.
   - Kiểm tra người dùng chưa đăng nhập (Anonymous): Không đọc được dữ liệu riêng tư qua RLS.
3. **Kiểm Tra Luồng Nghiệp Vụ Cốt Lõi:**
   - Mở ứng dụng với cấu hình trường giả `TRIAL`: Xác nhận hiển thị đúng tên trường TRIAL trên header/sidebar.
   - Thử bật/tắt module (ví dụ: tắt module `admissions`): Xác nhận menu sidebar ẩn đi, route `#/admissions` chặn hiển thị `module_disabled`, và API trả về HTTP 403 `MODULE_DISABLED`.
   - Tạo một bản ghi công việc (Task) và đọc lại theo phân quyền.
4. **Xác Nhận Chặn Dữ Liệu & Fixture Mẫu:**
   - Cố gắng gọi API/nút nạp dữ liệu mẫu STHC: Xác nhận bị chặn hoàn toàn với lỗi yêu cầu chỉ dành cho cơ sở STHC.

---

## 5. Quy Trình Dọn Dẹp Database Thử Nghiệm Sau Nghiệm Thu

Để làm sạch Supabase Project thử nghiệm sau khi kết thúc đợt kiểm thử:
1. Tuyệt đối không dùng lệnh xóa hàng loạt mù quáng.
2. Sử dụng script dọn dẹp theo định danh test (ví dụ: xóa các user có email kết thúc bằng `@trial.edu.vn` hoặc `@test.local`, kèm cascade xóa profiles, org_members và auth users tương ứng qua Supabase Auth Admin API).

---

## 6. Trạng Thái Bàn Giao C5-G
- Do chưa có Supabase Project trắng chuyên dụng được cung cấp trong môi trường thực thi hiện tại, **C5-G dừng ở việc chuẩn hóa runbook, checklist và lệnh thực thi chuẩn**, cam kết không sử dụng môi trường production STHC thay thế.
- Trạng thái: **CHUẨN BỊ HOÀN TẤT (CHỜ PROJECT TRẮNG ĐỂ CHẠY THỰC TẾ)**.
