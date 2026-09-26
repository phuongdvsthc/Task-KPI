# Báo Cáo Kỹ Thuật v0.9-C5-C: Tách Seed Nền Khỏi Dữ Liệu STHC

> **Phiên bản:** v0.9-C5-C  
> **Thời điểm thực hiện:** 26/09/2026  
> **Nguyên tắc tuân thủ:** Không chạy seed hay migration trên production, không sửa/xóa/đổi mã dữ liệu STHC hiện có, không đưa thông tin riêng của trường vào seed nền, dừng tại C5-C và không tuyên bố cài đặt database trắng trước C5-G.

---

## 1. Mục Tiêu & Nguyên Tắc Tách Dữ Liệu

Mục tiêu cốt lõi của **v0.9-C5-C** là phân định ranh giới tuyệt đối giữa:
1. **Cấu trúc dữ liệu thuần túy (DDL):** Toàn bộ 9 file migration trong `supabase/migrations/` chỉ được chứa lệnh tạo bảng, chỉ mục, view, hàm, trigger và RLS policies. Tuyệt đối không chứa bất kỳ câu lệnh `INSERT` dữ liệu nghiệp vụ nào.
2. **Seed hạt nhân hệ thống (Core Baseline Seed):** Chứa các danh mục và quy tắc bắt buộc để phần mềm Work + KPI có thể vận hành ở bất kỳ trường học nào. Chạy lại nhiều lần mà không sinh bản ghi trùng lặp (Idempotent), không mang bất kỳ thông tin nào gắn với thương hiệu, mã hay địa chỉ của Trường Saigontourist (STHC).
3. **Cấu hình định danh trường (Tenant Configuration):** Bộ tham số cấu hình riêng theo từng trường (tên trường, mã viết tắt, ROOT unit, email, số điện thoại, địa chỉ). Các giá trị này được tách rời để chuẩn bị cho giai đoạn **C5-D (Tham số hóa cấu hình triển khai)**.
4. **Dữ liệu mẫu / Dữ liệu riêng STHC (Demo / STHC Fixtures):** Danh mục ngành học đặc thù, các đợt tuyển sinh năm 2026, kế hoạch chỉ tiêu cụ thể của STHC. Được đóng gói riêng và **chỉ được kích hoạt khi quản trị viên chọn rõ ràng (opt-in explicit demo flag)**; tuyệt đối không tự động chạy khi khởi tạo một trường mới.

---

## 2. Bảng Đối Chiếu 3 Nhóm Dữ Liệu

| Nhóm dữ liệu | Thành phần / Bảng | Khóa định danh (Business Key) | Nguồn tạo cũ | Nơi quản lý mới | Điều kiện & Phạm vi áp dụng |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Nhóm 1: Seed Nền (Core Baseline)** | `access_modules` (11 modules chuẩn) | `code` (`task`, `kpi`, `admissions`, v.v.) | `20260918_v0_9_a2`, `v0.9-AI-A4`, `v0.9-C4.5-B` | `supabase/seeds/00001_core_baseline_seed.sql` | **Bắt buộc cho mọi trường.** Chạy sau 9 file migration. |
| **Nhóm 1: Seed Nền (Core Baseline)** | `access_roles` (7 roles: 4 system + 3 domain) | `code` (`admin`, `executive`, `manager`, `staff`, `admissions_*`) | `supabase/migrations/00003_access_control_rbac.sql` | `supabase/seeds/00001_core_baseline_seed.sql` | **Bắt buộc cho mọi trường.** Đã tách khỏi migration DDL. |
| **Nhóm 1: Seed Nền (Core Baseline)** | `access_permissions` (67 quyền hạn chuẩn) | `code` (`task.view`, `kpi.score`, v.v.) | `20260918_v0_9_a2`, `v0.9-AI-A4`, `v0.9-C4.5-B` | `supabase/seeds/00001_core_baseline_seed.sql` | **Bắt buộc cho mọi trường.** Tự động gắn kết theo `module_id`. |
| **Nhóm 1: Seed Nền (Core Baseline)** | `access_role_permissions` (177 ma trận phân quyền) | `(role_id, permission_id)` | `20260918_v0_9_a2`, `v0.9-AI-A4`, `v0.9-C4.5-B` | `supabase/seeds/00001_core_baseline_seed.sql` | **Bắt buộc cho mọi trường.** Thiết lập ma trận quyền chuẩn. |
| **Nhóm 1: Seed Nền (Core Baseline)** | `system_settings` (Template cấu hình chung) | `setting_key` (`app_name`, `timezone`, `date_format`, `language`, `appearance_*`, `logo_url`, `favicon_url`, `ai_global_config`) | UI cập nhật thủ công trên live DB | `supabase/seeds/00001_core_baseline_seed.sql` | **Bắt buộc cho mọi trường.** Chỉ chứa template mặc định, không chứa tên/email STHC. |
| **Nhóm 1: Seed Nền (Core Baseline)** | `ai_usage_settings` (Hạn mức sử dụng AI) | Single record (`id`) | `migrations/v0.10-AI-D1` | `supabase/seeds/00001_core_baseline_seed.sql` | **Bắt buộc cho mọi trường.** `ai_service_enabled = true`, rate limits mặc định. |
| **Nhóm 1: Seed Nền (Core Baseline)** | `ai_prompt_definitions` & `ai_prompt_versions` | `prompt_key` (`staff_kpi_summary`) | `migrations/v0.5-A4`, `v0.5-E2` | `supabase/seeds/00001_core_baseline_seed.sql` | **Bắt buộc cho mọi trường.** Prompt hệ thống phân tích KPI. |
| **Nhóm 1: Seed Nền (Core Baseline)** | `admission_groups` (Khung trình độ đào tạo chung) | `code` (`TRUNG_CAP`, `NGAN_HAN`) | `migrations/v0.8-A1` | `supabase/seeds/00001_core_baseline_seed.sql` | **Bắt buộc cho các trường nghề.** Không chứa mã đợt hay UUID STHC. |
| **Nhóm 2: Cấu Hình Trường (Tenant Config)** | `system_settings` (Thông tin cơ quan đào tạo) | `setting_key` (`organization_name`, `organization_short_name`, `organization_address`, `organization_phone`, `organization_email`, `organization_website`) | Hardcoded trong DB live STHC | Chuẩn bị tham số hóa ở **C5-D** | Nạp động theo từng trường qua file cấu hình triển khai (`tenant.config.json`). |
| **Nhóm 2: Cấu Hình Trường (Tenant Config)** | `organization_units` (Đơn vị ROOT) | `code` (Ví dụ: `STHC`, `CDKT`, `TCDN`) | Tạo thủ công trên DB live | Chuẩn bị tham số hóa ở **C5-D** | Mỗi trường có mã và tên ROOT riêng biệt. |
| **Nhóm 3: Dữ Liệu Riêng STHC / Demo** | `system_settings` (Cấu hình STHC) | `setting_key` | Hardcoded trong DB live | `supabase/seeds/00002_sthc_sample_data.sql` | **Tùy chọn (Opt-in).** Chỉ chạy khi cần tái lập môi trường STHC. |
| **Nhóm 3: Dữ Liệu Riêng STHC / Demo** | `organization_units` (`STHC`, `HCNS`, `TT-HTQT`, `BPTS`) | `code` | Hardcoded trong DB live | `supabase/seeds/00002_sthc_sample_data.sql` | **Tùy chọn (Opt-in).** Cây đơn vị mẫu của Saigontourist. |
| **Nhóm 3: Dữ Liệu Riêng STHC / Demo** | `admission_programs` (12 ngành chuẩn STHC) | `code` (`QTKSDN`, `QTNHA`, `KTCBMA`, v.v.) | Hardcoded trong `admissionService.ts` | `supabase/seeds/00002_sthc_sample_data.sql` | **Tùy chọn (Opt-in).** Ngành học của STHC. |
| **Nhóm 3: Dữ Liệu Riêng STHC / Demo** | `admission_campaigns` (13 đợt 2026 STHC) | `code` (`TC-2026-D01`..`D05`, `NH-2026-D01`..`D08`) | Hardcoded trong `v0.8-A1` | `supabase/seeds/00002_sthc_sample_data.sql` | **Tùy chọn (Opt-in).** Đợt tuyển sinh năm 2026 của STHC. |
| **Nhóm 3: Dữ Liệu Riêng STHC / Demo** | `admission_plans` (Chỉ tiêu 2026: 570 TC, 750 NH) | `(admission_year, group_id)` | Hardcoded trong `admissionPlanService.ts` | `supabase/seeds/00002_sthc_sample_data.sql` | **Tùy chọn (Opt-in).** Chỉ tiêu giao của STHC. |

---

## 3. Đối Chiếu 7 Vai Trò Trong C5-B Với 4 Vai Trò Ghi Nhận Ở C5-A

### 3.1. Nguồn Gốc và Cơ Chế Kỹ Thuật
- **Trong C5-A:** Khi kiểm tra trường `profiles.system_role`, hệ thống ghi nhận 4 vai trò vận hành cốt lõi: `admin`, `executive`, `manager`, `staff`.
- **Trong C5-B:** Khi kiểm tra bảng `public.access_roles` trên live DB, có tổng cộng **7 vai trò**.

### 3.2. Bảng Phân Tích & Giải Thích Chi Tiết

| Mã vai trò (`code`) | Tên hiển thị | Cấp độ (`level`) | Cờ hệ thống (`is_system`) | Bản chất phân quyền | Lý do và cách sử dụng |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **`staff`** | Nhân viên | 10 | `TRUE` | **Hệ thống bắt buộc (System Role)** | Phân quyền dọc cơ sở: Dành cho giảng viên/chuyên viên thực hiện công việc, nộp báo cáo hằng ngày và theo dõi KPI cá nhân. Đồng bộ tự động từ `profiles.system_role = 'staff'`. |
| **`manager`** | Quản lý | 20 | `TRUE` | **Hệ thống bắt buộc (System Role)** | Phân quyền dọc cấp phòng/khoa: Trưởng đơn vị quản trị giao việc, duyệt báo cáo ngày của thành viên và chấm điểm sơ bộ KPI đơn vị. Đồng bộ tự động từ `profiles.system_role = 'manager'`. |
| **`executive`** | Ban Giám hiệu | 30 | `TRUE` | **Hệ thống bắt buộc (System Role)** | Phân quyền dọc cấp trường: Lãnh đạo trường xem báo cáo tổng hợp, so sánh chéo các đơn vị, xem dashboard toàn diện ở chế độ chỉ đọc. Đồng bộ tự động từ `profiles.system_role = 'executive'`. |
| **`admin`** | Quản trị hệ thống | 40 | `TRUE` | **Hệ thống bắt buộc (System Role)** | Phân quyền dọc tối cao: Quản trị cấu hình, phân quyền người dùng, quản trị kho tri thức AI và hệ thống. Đồng bộ tự động từ `profiles.system_role = 'admin'`. |
| **`admissions_staff`** | Nhân viên Tuyển sinh | 10 | `FALSE` | **Chức năng nghiệp vụ (Domain Role)** | Phân quyền ngang theo phân hệ Tuyển sinh (tạo từ `v0.9-C4.5-B`): Cho phép cán bộ tuyển sinh nhập kết quả hồ sơ, theo dõi chỉ tiêu đợt mà không cần trao quyền quản lý phòng ban. |
| **`admissions_manager`** | Quản lý Tuyển sinh | 20 | `FALSE` | **Chức năng nghiệp vụ (Domain Role)** | Phân quyền ngang theo phân hệ Tuyển sinh: Cho phép Trưởng bộ phận tuyển sinh thiết lập đợt tuyển sinh, phân bổ chỉ tiêu ngành và quản lý tiến độ chuyển đổi. |
| **`admissions_admin`** | Quản trị Tuyển sinh | 30 | `FALSE` | **Chức năng nghiệp vụ (Domain Role)** | Phân quyền ngang theo phân hệ Tuyển sinh: Quản trị toàn bộ phân hệ tuyển sinh, chốt kết quả đợt tuyển sinh, mở lại dữ liệu đã chốt mà không cần cấp quyền Admin tối cao của cả trường. |

### 3.3. Kết Luận Về Vai Trò
- Cả **7 vai trò** đều là dữ liệu phân quyền thực tế đang được sử dụng trong ma trận RBAC của ứng dụng Work + KPI.
- **4 vai trò hệ thống** phụ trách phân tầng quyền hạn chung theo cây đơn vị tổ chức.
- **3 vai trò nghiệp vụ** giải quyết bài toán phân quyền chuyên môn hóa cho ban tuyển sinh.
- **Tuyệt đối không thêm hoặc xóa bất kỳ vai trò nào trên cơ sở dữ liệu production hiện tại.** Cả 7 vai trò được đưa vào file seed nền `supabase/seeds/00001_core_baseline_seed.sql` với lệnh `ON CONFLICT (code) DO UPDATE` để bảo đảm tính thống nhất.

---

## 4. Bảo Vệ Dữ Liệu Trường Đang Vận Hành & Cô Lập Seed STHC

1. **Bảo vệ môi trường Production:**
   - Tuyệt đối **không chạy lệnh `db push`, `db reset` hay bất kỳ migration/seed nào lên cơ sở dữ liệu Supabase đang vận hành**.
   - Toàn bộ dữ liệu trường Saigontourist (STHC), lịch sử tuyển sinh, hồ sơ người dùng và cấu hình hiện tại được giữ nguyên vẹn 100%.
2. **Loại bỏ Seed Khỏi Migration Schema DDL:**
   - Đã biên tập và loại bỏ khối lệnh `INSERT INTO public.access_roles` ra khỏi `supabase/migrations/00003_access_control_rbac.sql`.
   - File `00003_access_control_rbac.sql` hiện tại là **100% pure DDL** (chỉ tạo bảng, quan hệ, indexes, trigger function và RLS policies).
3. **Cô Lập Các Nút Nạp Nhanh Trong Mã Nguồn:**
   - Nút `#seed-standard-sthc-btn` (`ProgramListView.tsx`) và `#btn-seed-2026-official-plans` (`AnnualPlanListView.tsx`) chỉ là các hành động thủ công khi người dùng click trên UI trong ngữ cảnh demo/quản trị STHC.
   - Không có bất kỳ dòng lệnh nào trong `server.ts` hay các service tự động kích hoạt nạp dữ liệu STHC khi khởi động máy chủ hoặc khi triển khai trường mới.

---

## 5. Bằng Chứng Tự Kiểm Tra & Đối Chiếu Số Lượng Đối Tượng

### 5.1. Kết Quả Chạy Script Kiểm Tra Tự Động (`scripts/verify-c5-c-seed-separation.ts`)
```bash
=== VERIFY C5-C SEED SEPARATION & INTEGRITY AUDIT ===
1. Checking Core Baseline Seed (supabase/seeds/00001_core_baseline_seed.sql)...
  PASS: Core baseline seed is 100% clean of STHC tenant data.
2. Checking Idempotency of Core Baseline Seed...
  Found 251 INSERT INTO public.* statements.
  PASS: Core baseline seed uses ON CONFLICT / WHERE NOT EXISTS for safe re-runs.
3. Checking 9 Schema Migrations in supabase/migrations...
  Found 9 migration files.
  PASS: 00003_access_control_rbac.sql is confirmed pure DDL.

--- TABLE & VIEW COUNT IN 9 MIGRATIONS ---
Total Tables defined: 57 (Verified on DB: 57)
Total Views defined: 2 (Expected: 2)
  PASS: Schema count matches exactly 57 tables and 2 views verified on live DB!

4. Checking STHC Sample Data Seed (supabase/seeds/00002_sthc_sample_data.sql)...
  PASS: STHC sample data is properly isolated with idempotency guards.

=== AUDIT RESULT: PASS (100% COMPLIANT WITH C5-C) ===
```

### 5.2. Giải Trình Chênh Lệch Số Bảng Giữa C5-A, C5-B và C5-C

| Giai đoạn | Số Bảng | Số Views | Giải trình nguyên nhân chênh lệch |
| :--- | :---: | :---: | :--- |
| **Báo cáo C5-A** | 53 | 2 | Được kiểm tra bằng danh sách thủ công 64 tên bảng ứng cử viên. Bỏ sót 4 bảng con nội bộ trong kịch bản quét ban đầu. |
| **Báo cáo C5-B** | 57 | 2 | Trích xuất toàn diện từ OpenAPI Specification trực tiếp từ PostgREST schema cache. Bổ sung chính xác 4 bảng thực tế: `report_source_unit_assignments`, `daily_report_task_links`, `daily_report_reminders`, `kpi_assignment_item_bindings`. (Tổng số định nghĩa public: 57 bảng + 2 views = 59). Trong file `00004` ban đầu có tạm đưa bảng `announcement_reminders` (từ file cũ `v0.2.2`). |
| **Chuẩn hóa C5-C** | **57** | **2** | Sau khi đối chiếu live DB, xác nhận bảng `announcement_reminders` chưa từng được tạo trên DB và không có trong mã nguồn; đã **loại bỏ** bảng này khỏi `00004_tasks_and_announcements.sql`. Kết quả: **9 file migration định nghĩa chính xác 57 bảng và 2 views, trùng khớp 1:1 với cơ sở dữ liệu thực tế.** |

---

## 6. Kết Luận & Điểm Dừng C5-C

- **Kết luận:** **v0.9-C5-C ĐÃ HOÀN THÀNH XUẤT SẮC (PASS 100%)**.
- **Điểm dừng:** Dừng lại tại đây theo đúng yêu cầu; **chưa triển khai C5-D** (chờ phiên làm việc kế tiếp để xây dựng cơ chế tham số hóa cấu hình trường) và **không tuyên bố cài đặt database trắng trước C5-G**.
