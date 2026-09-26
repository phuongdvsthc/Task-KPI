# Runbook Triển Khai Cho Trường Mới (v0.9-C5-I)

> **Trạng thái tài liệu:** **OFFICIAL / ĐÃ XÁC MINH THỰC TẾ QUA C5-G & C5-H PASS**  
> **Thời điểm ban hành:** 26/09/2026  
> **Phạm vi áp dụng:** Cài đặt mới cho một cơ sở đào tạo (trường) độc lập sử dụng chung mã nguồn (Single Codebase) nhưng tách biệt hoàn toàn cơ sở dữ liệu (Database-per-Tenant Supabase Project).

---

## Phần 1: Nguyên Tắc An Toàn & Chuẩn Bị Trước Khi Cài Đặt

1. **Cô lập tuyệt đối:** Mỗi trường bắt buộc phải có một Supabase Project / Database riêng biệt. **Nghiêm cấm** dùng chung database giữa các trường hoặc dùng chung với môi trường production STHC.
2. **Bảo mật tuyệt đối:** Không bao giờ đưa Service Role Key, Database Password hay API Key vào Git hoặc tài liệu viết tay. Các khóa này chỉ được khai báo qua biến môi trường (`.env` hoặc GitHub Secrets / Cloud Run Env).
3. **Tuân thủ đúng thứ tự:** Phải thực hiện tuần tự từ Bước 1 đến Bước 10. Không nhảy cóc hoặc chạy đè lên database đang vận hành.

---

## Phần 2: 10 Bước Triển Khai Chi Tiết

### Bước 1: Điều kiện cần chuẩn bị & Nhận diện Supabase Project đích
- **Đầu vào:** Thông tin Supabase Project mới từ Supabase Dashboard (Project URL, Project ID, Service Role Key).
- **Cách kiểm tra trước khi chạy:** Truy cập Supabase SQL Editor và chạy câu lệnh kiểm tra catalog:
  ```sql
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
  ```
- **Kết quả mong đợi:** Trả về danh sách **rỗng (0 bảng)**, xác nhận đây là database trắng hoàn toàn.
- **Xử lý lỗi:** Nếu database đã có bảng, dừng lại ngay lập tức và chọn một Project hoàn toàn mới.

---

### Bước 2: Cấu hình biến môi trường và quản lý khóa bí mật
- **Tệp tin cấu hình:** `.env` (không commit lên Git).
- **Lệnh thực hiện:**
  ```bash
  cp .env.example .env
  ```
- **Đầu vào cấu hình:**
  ```env
  VITE_SUPABASE_URL=https://<your-new-project-id>.supabase.co
  VITE_SUPABASE_ANON_KEY=<your-new-anon-key>
  SUPABASE_SERVICE_ROLE_KEY=<your-new-service-role-key>
  ```
- **Cách kiểm tra:** Chạy lệnh kiểm tra kết nối môi trường:
  ```bash
  node -e 'require("dotenv").config(); console.log(process.env.VITE_SUPABASE_URL ? "OK" : "MISSING");'
  ```
- **Kết quả mong đợi:** In ra `OK`.

---

### Bước 3: Chạy 9 Migration DDL theo thứ tự
- **Thư mục migration:** `supabase/migrations/` (Các file từ `00001_...` đến `00009_...`).
- **Lệnh thực hiện:** Thực thi tuần tự các file SQL trên Supabase SQL Editor hoặc qua công cụ migrate chuẩn của dự án.
- **Kết quả mong đợi:** Tạo thành công 57 bảng, 2 views, các hàm RPC, policies và 4 storage buckets (`system-assets`, `task-evidence`, `daily-reports`, `admissions-evidence`).
- **Cách kiểm tra:**
  ```sql
  SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
  ```
  *(Kết quả mong đợi: 57)*.

---

### Bước 4: Chạy seed nền chuẩn (Core Baseline Seed)
- **Tệp tin seed:** `supabase/seeds/00001_core_baseline_seed.sql`
- **Lệnh thực hiện:** Thực thi file seed này trên Supabase SQL Editor.
- **Xác nhận:** Đảm bảo **không nạp** `supabase/seeds/00002_sthc_sample_data.sql` hay bất kỳ fixture test nào.
- **Kết quả mong đợi:** Nạp thành công 11 access modules, 7 access roles, 67 permissions và 177 role-permission mappings.
- **Cách kiểm tra:**
  ```sql
  SELECT code FROM access_modules;
  ```
  *(Kết quả mong đợi: trả về 11 module cốt lõi)*.

---

### Bước 5: Điền cấu hình trường, tạo đơn vị ROOT và chọn module
- **Tệp tin cấu hình trường:** `tenant.config.json` (tạo từ `tenant.config.example.json`).
- **Đầu vào (Ví dụ cho trường `VTC`):**
  ```json
  {
    "tenantCode": "VTC",
    "tenantName": "Trường Cao đẳng Công nghệ và Du lịch",
    "tenantShortName": "VTC",
    "rootUnit": {
      "code": "VTC",
      "name": "Trường Cao đẳng Công nghệ và Du lịch",
      "unitType": "school"
    },
    "enabledModules": ["task", "kpi", "dashboard", "system", "access_control"]
  }
  ```
- **Lệnh thực hiện:**
  ```bash
  npx tsx scripts/apply-tenant-config.ts tenant.config.json
  ```
- **Kết quả mong đợi:** Khởi tạo thành công bản ghi cấu hình trong `system_settings` và tạo đơn vị ROOT trong `organization_units`.
- **Cách kiểm tra:** Kiểm tra bảng `system_settings` có `tenant_code = 'VTC'` và `organization_units` có 1 bản ghi `parent_id IS NULL`.

---

### Bước 6: Chạy script bootstrap Admin đầu tiên
- **Script thực hiện:** `scripts/bootstrap-first-admin.ts`
- **Lệnh thực hiện:**
  ```bash
  npx tsx scripts/bootstrap-first-admin.ts --email=admin@vtc.edu.vn --name="Quản trị viên VTC"
  ```
- **Đầu vào:** Email và họ tên quản trị viên. Mật khẩu sẽ được sinh ngẫu nhiên an toàn nếu không cung cấp qua biến môi trường `BOOTSTRAP_ADMIN_PASSWORD`.
- **Kết quả mong đợi:** Tạo tài khoản qua Supabase Auth Admin API, gán hồ sơ (`profiles`), gán vai trò `admin` (`access_user_roles`) và gắn vào đơn vị ROOT (`organization_members`).
- **Cách kiểm tra:** Đăng nhập ứng dụng với tài khoản vừa tạo, kiểm tra giao diện hiển thị tên trường và quyền Quản trị hệ thống.

---

### Bước 7: Cấu hình ứng dụng dùng đúng database của trường
- **Thao tác:** Đảm bảo file `.env` hoặc biến môi trường trên hosting (Cloud Run, Vercel, v.v.) trỏ chính xác đến Supabase URL và Service Role Key của trường đó.
- **Cách kiểm tra:** Khởi động ứng dụng (`npm run build` & `npm start`), kiểm tra gọi API lấy cấu hình (`/api/system/settings`) trả về đúng mã trường và tên trường tương ứng.

---

### Bước 8: Chạy bộ kiểm thử C5-H nghiệm thu
- **Script thực hiện:** `scripts/acceptance-test-c5-h.ts`
- **Lệnh thực hiện:**
  ```bash
  export C5G_TRIAL_PASSED="true"
  npx tsx scripts/acceptance-test-c5-h.ts
  ```
- **Kết quả mong đợi:** Bộ kiểm thử chạy qua 7 nhóm kiểm tra và trả về kết quả tổng thể `PASSED` (5/5 bài kiểm thử đạt tuyệt đối).

---

### Bước 9: Thiết lập cơ cấu tổ chức và người dùng thật
- Sau khi nền tảng đã được nghiệm thu PASS:
  - Sử dụng giao diện Quản trị / Phân quyền để tạo các phòng ban / khoa trực thuộc dưới đơn vị ROOT.
  - Tạo tài khoản nhân sự / giảng viên thực tế và phân bổ vai trò, đơn vị công tác phù hợp.

---

### Bước 10: Xử lý sự cố và quy tắc chạy lại an toàn
- **Sự cố mất kết nối / lỗi giữa chừng:** Chạy lại script tương ứng (`apply-tenant-config.ts` hoặc `bootstrap-first-admin.ts`). Cả hai script đều hỗ trợ cơ chế an toàn idempotent / recovery, không tạo bản ghi trùng lặp.
- **Nguyên tắc vàng:** **Tuyệt đối không chuyển sang database đang vận hành thực tế để “thử lại”** khi gặp lỗi trên cơ sở dữ liệu cài mới.

---

## Phần 3: Checklist Bàn Giao Cài Đặt Mới

| Hạng mục bàn giao | Giá trị ghi nhận thực tế (Ví dụ mẫu VTC) |
| :--- | :--- |
| **Project ID (Đã che)** | `nfybhiwpxrrgqlnfxmyg***` |
| **Phiên bản mã nguồn / Migration** | v0.9 (Migration 00001 - 00009, Baseline Seed 00001) |
| **Cấu hình trường (Tenant Code)** | `VTC` |
| **Đơn vị ROOT** | `7afdccfd-4e25-434f-afba-e54b0652aa1f` (Trường Cao đẳng Công nghệ và Du lịch) |
| **Tài khoản Admin đầu tiên (Che mật khẩu)** | `admin@vtc.edu.vn` (Vai trò: `admin`, Đã gắn ROOT) |
| **Danh sách module bật** | `task`, `kpi`, `dashboard`, `system`, `access_control` |
| **Kết quả Acceptance (C5-H)** | **PASSED (5/5 bài kiểm thử đạt)** |
| **Các vấn đề còn mở** | Không có |

> **Cam kết bảo mật:** Checklist bàn giao **tuyệt đối không ghi** mật khẩu, API key hay service role key.

---

## Phần 4: Tách Biệt Rõ Ràng: Cài Đặt Mới vs. Nâng Cấp Hệ Thống

- **Cài đặt mới (New Installation):** Áp dụng theo đúng 10 bước trên một Supabase Project trắng chưa có dữ liệu (Đã được kiểm chứng thực tế qua C5-G & C5-H PASS).
- **Nâng cấp hệ thống đang vận hành (Upgrade Operating System):**
  - **Trạng thái hiện tại:** Quy trình nâng cấp tự động cho các trường đang vận hành **chưa được nghiệm thu**.
  - **Cảnh báo nghiêm ngặt:** **Không được** áp dụng hướng dẫn cài mới này để chạy đè lên database của một trường đang hoạt động (tránh làm mất dữ liệu hoặc xung đột schema). Mọi quy trình nâng cấp bắt buộc phải có script migration riêng và được backup trước khi thực hiện.
