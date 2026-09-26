# Báo Cáo Kiểm Kê Deployment Foundation (Work + KPI) – v0.9-C5-A

> **Trạng thái:** HOÀN THÀNH KIỂM KÊ (READ-ONLY AUDIT)  
> **Thời điểm thực hiện:** 25/09/2026  
> **Nguyên tắc tuân thủ:** Không chạy migration, không sửa schema, không xóa dữ liệu, không đổi cấu hình production, không in lộ bí mật/thông tin định danh cá nhân.

---

## 1. Tổng Quan & Quyết Định Đánh Giá C5-A

| Tiêu chí | Kết quả | Ghi chú bằng chứng |
| :--- | :---: | :--- |
| **Kiểm kê Schema, Bảng, Cột** | **ĐẠT** | 53 bảng hoạt động thực tế trên DB, 11 bảng thiếu trên DB so với source code/migration. |
| **Kiểm kê Functions & RPC** | **ĐẠT** | 15 hàm RPC xác minh tồn tại trên DB, 12 hàm trong migration chưa có trên DB (ứng dụng dùng fallback backend). |
| **Kiểm kê Storage Buckets** | **ĐẠT** | 4 bucket xác minh qua Supabase Storage API (`system-assets`, `task-evidence`, `task-attachments`, `ai-knowledge-docs`). |
| **Kiểm kê Auth & Admin Flow** | **ĐẠT** | Xác minh luồng tạo user qua Supabase Auth Admin API + bảng `profiles` + `access_user_roles`. |
| **Kiểm kê Triggers, RLS & Grant** | **ĐẠT** | Xác minh qua API; cung cấp script SQL read-only cho Admin chạy trên `pg_catalog`. |
| **Kiểm kê Dependencies & Env** | **ĐẠT** | Xác minh toàn bộ biến môi trường client/server; không có Edge Functions hay `pg_cron`. |
| **Kiểm kê Hardcode STHC & Seed** | **ĐẠT** | Phát hiện toàn bộ cấu hình STHC, Root code, seed 12 ngành, seed chỉ tiêu 2026. |
| **Quyết định chung C5-A** | **PASS** | Đủ điều kiện kết thúc Bước A; dừng lại tại đây và KHÔNG tự động chuyển sang Bước B. |

---

## 2. Bảng Kiểm Kê Thành Phần Triển Khai (Deployment Foundation Inventory)

### 2.1. Bảng Dữ Liệu (Tables & Schemas)
*Tổng cộng quét 64 bảng ứng cử viên từ source code & migrations: **53 bảng tồn tại trên DB**, **11 bảng chưa có trên DB**.*

| Tên Bảng (`public`) | Nguồn Bằng Chứng | Số Hàng Thực Tế | Phụ Thuộc (FK / References) | Phân Loại | Tình Trạng Xác Minh |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `profiles` | Live DB API / `database.ts` | 7 | `auth.users(id)` | Nền | Đã xác minh trên DB |
| `organization_units` | Live DB API / `database.ts` | 3 | `organization_units(parent_id)` | Nền + STHC | Đã xác minh trên DB |
| `organization_members` | Live DB API / `database.ts` | 7 | `profiles(id)`, `organization_units(id)` | Nền + STHC | Đã xác minh trên DB |
| `system_settings` | Live DB API / `v0.11-AI-Config` | 18 | `profiles(id)` | Nền + STHC | Đã xác minh trên DB |
| `access_modules` | Live DB API / `20260918_v0_9_a2` | 11 | Không | Nền | Đã xác minh trên DB |
| `access_roles` | Live DB API / `20260918_v0_9_a2` | 7 | Không | Nền | Đã xác minh trên DB |
| `access_permissions` | Live DB API / `20260918_v0_9_a2` | 67 | `access_modules(id)` | Nền | Đã xác minh trên DB |
| `access_role_permissions` | Live DB API / `20260918_v0_9_a2` | 177 | `access_roles(id)`, `access_permissions(id)` | Nền | Đã xác minh trên DB |
| `access_user_roles` | Live DB API / `20260918_v0_9_a2` | 10 | `profiles(id)`, `access_roles(id)` | Nền | Đã xác minh trên DB |
| `access_audit_logs` | Live DB API / `20260918_v0_9_a2` | 91 | `profiles(id)` | Nền | Đã xác minh trên DB |
| `tasks` | Live DB API / `task.ts` | 2 | `organization_units(id)`, `profiles(id)` | Nền | Đã xác minh trên DB |
| `task_assignees` | Live DB API / `task.ts` | 0 | `tasks(id)`, `profiles(id)` | Nền | Đã xác minh trên DB |
| `task_evidence` | Live DB API / `task.ts` | 0 | `tasks(id)`, `profiles(id)` | Nền | Đã xác minh trên DB |
| `task_comments` | Live DB API / `task.ts` | 0 | `tasks(id)`, `profiles(id)` | Nền | Đã xác minh trên DB |
| `task_updates` | Live DB API / `task.ts` | 0 | `tasks(id)`, `profiles(id)` | Nền | Đã xác minh trên DB |
| `task_announcement_audience_units` | Live DB API / `v0.2.2_announcement` | 0 | `tasks(id)`, `organization_units(id)` | Nền | Đã xác minh trên DB |
| `task_announcement_audience_users` | Live DB API / `v0.2.2_announcement` | 0 | `tasks(id)`, `profiles(id)` | Nền | Đã xác minh trên DB |
| `daily_reports` | Live DB API / `daily-report.ts` | 0 | `profiles(id)`, `organization_units(id)` | Nền | Đã xác minh trên DB |
| `daily_report_sources` | Live DB API / `daily-report.ts` | 0 | `daily_reports(id)` | Nền | Đã xác minh trên DB |
| `report_sources` | Live DB API / `metric.ts` | 0 | `organization_units(id)` | Nền | Đã xác minh trên DB |
| `report_source_metric_assignments` | Live DB API / `metric.ts` | 0 | `report_sources(id)`, `metric_definitions(id)` | Nền | Đã xác minh trên DB |
| `metric_definitions` | Live DB API / `metric.ts` | 0 | `organization_units(id)` | Nền | Đã xác minh trên DB |
| `metric_entries` | Live DB API / `metric.ts` | 0 | `metric_definitions(id)`, `profiles(id)` | Nền | Đã xác minh trên DB |
| `kpi_definitions` | Live DB API / `kpi.ts` | 0 | `organization_units(id)` | Nền | Đã xác minh trên DB |
| `kpi_objectives` | Live DB API / `kpi.ts` | 0 | `organization_units(id)` | Nền | Đã xác minh trên DB |
| `kpi_periods` | Live DB API / `kpi.ts` | 0 | Không | Nền | Đã xác minh trên DB |
| `kpi_templates` | Live DB API / `kpi.ts` | 0 | `organization_units(id)` | Nền | Đã xác minh trên DB |
| `kpi_template_versions` | Live DB API / `kpi.ts` | 0 | `kpi_templates(id)` | Nền | Đã xác minh trên DB |
| `kpi_template_items` | Live DB API / `kpi.ts` | 0 | `kpi_template_versions(id)`, `kpi_definitions(id)` | Nền | Đã xác minh trên DB |
| `kpi_template_item_bindings` | Live DB API / `kpi.ts` | 0 | `kpi_template_items(id)` | Nền | Đã xác minh trên DB |
| `kpi_assignments` | Live DB API / `kpi.ts` | 0 | `kpi_periods(id)`, `profiles(id)`, `org_units(id)` | Nền | Đã xác minh trên DB |
| `kpi_assignment_items` | Live DB API / `kpi.ts` | 0 | `kpi_assignments(id)`, `kpi_definitions(id)` | Nền | Đã xác minh trên DB |
| `kpi_manual_actual_entries` | Live DB API / `v0.4.3-D` | 0 | `kpi_assignment_items(id)`, `profiles(id)` | Nền | Đã xác minh trên DB |
| `notifications` | Live DB API / `notification.ts` | 0 | `profiles(id)` | Nền | Đã xác minh trên DB |
| `admission_groups` | Live DB API / `v0.8-A1` | 2 | `auth.users(id)` | Nền + STHC | Đã xác minh trên DB |
| `admission_programs` | Live DB API / `v0.8-A1` | 36 | `admission_groups(id)` | STHC | Đã xác minh trên DB |
| `admission_campaigns` | Live DB API / `v0.8-A1` | 53 | `admission_groups(id)`, `organization_units(id)` | STHC | Đã xác minh trên DB |
| `admission_plans` | Live DB API / `v0.8-A2` | 15 | `admission_campaigns(id)`, `admission_programs(id)` | STHC | Đã xác minh trên DB |
| `admission_results` | Live DB API / `v0.8-A2` | 13 | `admission_campaigns(id)` | STHC | Đã xác minh trên DB |
| `admission_result_items` | Live DB API / `v0.8-A2` | 134 | `admission_results(id)`, `admission_programs(id)` | STHC | Đã xác minh trên DB |
| `admission_change_history` | Live DB API / `v0.8-A3` | 587 | `auth.users(id)` | Nền | Đã xác minh trên DB |
| `ai_knowledge_documents` | Live DB API / `v0.9-AI-A3` | 1 | `auth.users(id)` | Nền + STHC | Đã xác minh trên DB |
| `ai_knowledge_chunks` | Live DB API / `v0.9-AI-A3` | 17 | `ai_knowledge_documents(id)` | Nền + STHC | Đã xác minh trên DB |
| `ai_conversations` | Live DB API / `v0.9-AI-A3` | 2 | `auth.users(id)` | Nền | Đã xác minh trên DB |
| `ai_messages` | Live DB API / `v0.9-AI-A3` | 20 | `ai_conversations(id)` | Nền | Đã xác minh trên DB |
| `ai_message_sources` | Live DB API / `v0.9-AI-A3` | 2 | `ai_messages(id)`, `ai_knowledge_docs(id)` | Nền | Đã xác minh trên DB |
| `ai_prompt_definitions` | Live DB API / `v0.5-A4` | 2 | `auth.users(id)` | Nền | Đã xác minh trên DB |
| `ai_prompt_versions` | Live DB API / `v0.5-A4` | 3 | `ai_prompt_definitions(id)` | Nền | Đã xác minh trên DB |
| `ai_usage_settings` | Live DB API / `v0.10-AI-D1` | 1 | Không | Nền | Đã xác minh trên DB |
| `ai_usage_reservations` | Live DB API / `v0.10-AI-D1` | 61 | `auth.users(id)` | Nền | Đã xác minh trên DB |
| `ai_usage_counters` | Live DB API / `v0.10-AI-D1` | 3 | Không | Nền | Đã xác minh trên DB |
| `ai_usage_logs` | Live DB API / `v0.10-AI-D1` | 82 | `auth.users(id)` | Nền | Đã xác minh trên DB |
| `ai_provider_configs` | Live DB API / `v0.10-AI-D3-B` | 2 | `auth.users(id)` | Nền | Đã xác minh trên DB |
| `task_attachments` | `v0.2.2.1_task_attachments.sql` | — | `tasks(id)` | Nền | **THIẾU TRÊN DB** |
| `announcements` | `v0.2.2_announcement.sql` | — | *(Đã gộp vào bảng `tasks`)* | Nền | Không dùng bảng riêng |
| `announcement_acknowledgements` | Source code check | — | *(Gộp vào trạng thái nhiệm vụ)* | Nền | Không dùng bảng riêng |
| `announcement_views` | Source code check | — | *(Gộp vào `tasks.progress`)* | Nền | Không dùng bảng riêng |
| `kpi_assignment_reviews` | `v0.4.5-A_kpi_review_lifecycle.sql` | — | `kpi_assignments(id)` | Nền | **THIẾU TRÊN DB** |
| `kpi_assignment_item_reviews` | `v0.4.5-A_kpi_review_lifecycle.sql` | — | `kpi_assignment_items(id)` | Nền | **THIẾU TRÊN DB** |
| `admission_google_sheets_config`| `v0.8-E1-google-sheets-config.sql` | — | `auth.users(id)` | Nền | **THIẾU TRÊN DB** |
| `admission_sheet_campaign_mappings`| `v0.8-E2-google-sheets-mappings.sql`| — | `admission_campaigns(id)` | Nền | **THIẾU TRÊN DB** |
| `admission_sheet_program_mappings` | `v0.8-E2-google-sheets-mappings.sql`| — | `admission_programs(id)` | Nền | **THIẾU TRÊN DB** |
| `admission_sync_batches` | `v0.8-E3-sync-history.sql` | — | `auth.users(id)` | Nền | **THIẾU TRÊN DB** |
| `admission_sync_batch_sheets` | `v0.8-E3-sync-history.sql` | — | `admission_sync_batches(id)` | Nền | **THIẾU TRÊN DB** |

---

### 2.2. Functions & RPC Stored Procedures

| Tên Function | Nguồn Bằng Chứng | Thứ Tự Tạo & Phụ Thuộc | Phân Loại | Tình Trạng Xác Minh DB |
| :--- | :--- | :--- | :--- | :--- |
| `kpi_create_assignment_from_template` | Live RPC / `database.ts` | Sau `kpi_assignments`, `kpi_template_versions` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `kpi_can_assign_to_user` | Live RPC / `database.ts` | Sau `profiles`, `organization_members` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `kpi_can_manage_assignment` | Live RPC / `database.ts` | Sau `kpi_assignments`, `access_user_roles` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `kpi_can_view_assignment` | Live RPC / `database.ts` | Sau `kpi_assignments`, `access_user_roles` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `kpi_resolve_assignment_item_actual` | Live RPC / `v0.4.3-C` | Sau `kpi_assignment_items` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `kpi_get_actual_trace` | Live RPC / `v0.4.3-D` | Sau `kpi_manual_actual_entries` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `kpi_resolve_assignment_item_score` | Live RPC / `v0.4.4-B` | Sau `kpi_assignment_items`, actual func | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `kpi_resolve_assignment_score` | Live RPC / `fix.sql` | Sau `kpi_resolve_assignment_item_score` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `kpi_get_org_descendants` | Live RPC / `v0.4.3-C` | Sau `organization_units` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `recalculate_admission_result` | Live RPC / `v0.8-A2` | Sau `admission_results`, `admission_result_items` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `admission_current_system_role` | Live RPC / `v0.8-A3` | Sau `profiles`, `auth.users` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `admission_is_admin` | Live RPC / `v0.8-A3` | Sau `admission_current_system_role` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `admission_is_executive` | Live RPC / `v0.8-A3` | Sau `admission_current_system_role` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `admission_user_unit_ids` | Live RPC / `v0.8-A3` | Sau `organization_members` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `fn_ai_activate_provider` | Live RPC / `v0.10-AI-D3-G` | Sau `ai_provider_configs` | Nền | **Đã xác minh (Tồn tại trên DB)** |
| `finalize_admission_result` | `v0.8-D2_admission_finalize` | Sau `admission_results` | Nền | **Chưa có trên DB** (Express Route fallback) |
| `reopen_admission_result` | `v0.8-D2_admission_finalize` | Sau `admission_results` | Nền | **Chưa có trên DB** (Express Route fallback) |
| `kpi_resolve_assignments_score_batch` | `v0.4.6-A` | Sau `kpi_resolve_assignment_score` | Nền | **Chưa có trên DB** (Client batching fallback) |
| `kpi_start_assignment_review` | `v0.4.5-B` | Sau `kpi_assignment_reviews` | Nền | **Chưa có trên DB** (Bảng review chưa tạo) |
| `kpi_approve_assignment_review` | `v0.4.5-B` | Sau `kpi_assignment_reviews` | Nền | **Chưa có trên DB** (Bảng review chưa tạo) |
| `fn_ai_search_knowledge_chunks` | `v0.9-AI-C3` | Cần extension `vector` | Nền | **Chưa có trên DB** (Vector similarity in-mem) |
| `fn_ai_finalize_usage` | `v0.10-AI-D1` | Sau `ai_usage_logs` | Nền | **Chưa có trên DB** (Express service fallback) |

---

### 2.3. Storage Buckets & Cấu hình Bucket

| Tên Bucket | Trạng thái Public | Kích thước tối đa | MIME Types cho phép | Mục Đích Sử Dụng |
| :--- | :---: | :---: | :--- | :--- |
| **`system-assets`** | `true` (Public) | 5 MB (5.242.880 bytes) | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`, `image/x-icon`, `image/vnd.microsoft.icon` | Lưu trữ logo trường, favicon, hình ảnh nhận diện hệ thống. |
| **`task-evidence`** | `false` (Private) | Mặc định Supabase | Tất cả các loại tệp (tài liệu, hình ảnh minh chứng công việc) | Tệp minh chứng hoàn thành công việc gửi người duyệt. |
| **`task-attachments`**| `false` (Private) | 20 MB (20.971.520 bytes) | Tất cả các loại tệp | Tệp tài liệu giao việc đính kèm theo nhiệm vụ / chỉ đạo. |
| **`ai-knowledge-docs`** | `false` (Private) | 20 MB (20.971.520 bytes) | `application/pdf`, `docx`, `doc`, `text/plain`, `text/markdown` | Tài liệu chính sách quy chế nạp vào Kho tri thức Trợ lý AI. |

---

### 2.4. Extensions, Auth Flow, Cron & Dịch vụ Ngoài

| Hạng mục | Tên / Đối tượng | Chi tiết cấu hình & Hành vi | Tình trạng |
| :--- | :--- | :--- | :--- |
| **Extensions** | `pgcrypto` | Tạo UUID v4, mã hóa cấu hình bảo mật API key. | Đã xác minh trên DB |
| **Extensions** | `vector` (pgvector) | Lưu trữ vector embedding 768 chiều trong `ai_knowledge_chunks`. | Đã xác minh trên DB |
| **Auth Trigger** | Profile Hook | Hiện tại **KHÔNG có trigger `on_auth_user_created` tự động tạo profile**. Luồng tạo người dùng được điều phối tập trung thông qua Express Backend API (`POST /api/admin/users`) với transaction rollback an toàn 4 bước (`auth.admin.createUser` ➔ `profiles` ➔ `organization_members` ➔ `access_user_roles`). | Đã xác minh từ mã nguồn |
| **Auth Bootstrap**| Admin/ROOT Flow | Dự án hiện dùng `access_roles` (admin level 40) và fallback token bí mật service role cho tài khoản quản trị hệ thống ban đầu; chưa có SQL migration tạo ROOT user tự động. | Cần chuẩn hóa ở C5-E |
| **Edge Functions** | None | Dự án hoàn toàn không sử dụng Supabase Edge Functions (`supabase/functions` không tồn tại). Mọi logic trung gian được xử lý bởi Node.js/Express server (`server.ts`). | Đã xác minh |
| **Cron / Jobs** | None (DB) | Không có `pg_cron` trong PostgreSQL. Client dùng interval polling trong `NotificationContext.tsx` và server in-memory queue. | Đã xác minh |
| **Dịch vụ ngoài** | Google Gemini / OpenAI | Kết nối qua `@google/genai` và REST API OpenAI từ server proxy, cấu hình quản trị trong `ai_provider_configs`. | Đã xác minh |

---

## 3. Danh Sách Chênh Lệch, Thiếu Sót & Lỗi Thứ Tự (Discrepancies)

### 3.1. Thiếu Migration Nền Cho Các Bảng Cốt Lõi (Critical Gap)
- **Hiện trạng:** Các bảng nền tảng ban đầu (`profiles`, `organization_units`, `organization_members`, `tasks`, `task_assignees`, `task_evidence`, `task_comments`, `daily_reports`, `metrics`, `kpi_*`) **hoàn toàn không có file migration SQL ban đầu trong thư mục `migrations/`**.
- **Nguyên nhân:** Các bảng này được tạo thủ công trên Supabase UI từ các phiên bản sơ khởi trước khi quy trình lưu trữ migration theo phiên bản (`migrations/v0.2.2+`) được áp dụng.
- **Tác động:** Nếu cài đặt trên một Supabase trắng hoàn toàn, chỉ chạy các file trong `migrations/` sẽ lập tức báo lỗi (ví dụ: `v0.2.2_announcement.sql` sẽ báo lỗi vì bảng `tasks` chưa tồn tại).

### 3.2. Bảng & Hàm Có File SQL Nhưng Chưa Chạy Trên Database
1. **Bảng đính kèm việc:** `task_attachments` (có file `migrations/v0.2.2.1_task_attachments.sql` nhưng chưa được tạo trên DB).
2. **Bảng vòng đời đánh giá KPI:** `kpi_assignment_reviews`, `kpi_assignment_item_reviews` (trong `migrations/v0.4.5-A_kpi_review_lifecycle.sql` chưa có trên DB; file `schema_check.sql` cũng từng ghi nhận điều này).
3. **Các bảng Google Sheets Tuyển sinh:** `admission_google_sheets_config`, `admission_sheet_campaign_mappings`, `admission_sheet_program_mappings`, `admission_sync_batches`, `admission_sync_batch_sheets` (trong các file gốc `v0.8-E1`, `v0.8-E2`, `v0.8-E3` chưa được áp dụng lên DB).
4. **Hàm Chốt / Mở lại Tuyển sinh:** `finalize_admission_result` và `reopen_admission_result` (trong `v0.8-D2_admission_finalize_reopen.sql` chưa được deploy lên DB; Express server đang thực hiện cập nhật trực tiếp).

### 3.3. Trùng Lặp & Phân Rã File Migration Giữa Thư Mục Gốc Và `migrations/`
- Thư mục gốc chứa các file: `v0.8-A1-admissions-foundation.sql`, `v0.8-A2-admission-plans-results.sql`, `v0.8-A3-admission-security-audit.sql` có nội dung khác biệt về độ dài so với các file tương ứng trong `migrations/` (`v0.8-A1_admission_foundation.sql`, v.v.).
- Hai migration RBAC cốt lõi: `20260918_v0_9_a2_access_control_foundation.sql` và `20260918_v0_9_a3_migrate_user_roles.sql` đang nằm ở thư mục gốc thay vì nằm trong thư mục chuẩn `migrations/`.

### 3.4. Dữ Liệu & Cấu Hình Đang Hardcode Cho STHC
1. **Bảng `system_settings`**:
   - `organization_short_name` = `'STHC'`
   - `organization_address` = `'23/8 Hoàng Việt, Phường Tân Sơn Nhất, TP. HCM'`
   - `organization_phone` = `'1800558827'`
   - `organization_email` = `'admin@saigontourist.edu.vn'`
   - `organization_website` = `'https://saigontourist.edu.vn'`
2. **Bảng `organization_units`**:
   - Đơn vị Root cao nhất: mã `'STHC'`, tên `'Trường Saigontourist'` (UUID: `7afdccfd-4e25-434f-afba-e54b0652aa1f`, `parent_id`: NULL).
   - Đơn vị con: `'HCNS'` (Phòng Hành chính nhân sự) và `'TT-HTQT'` (Phòng Truyền thông và HTQT).
3. **Mã Nguồn TypeScript**:
   - `src/services/ai/gateway/aiAssistantPromptBuilder.ts`: Fallback tên trường mặc định `'Trường Cao đẳng Du lịch Sài Gòn (STHC)'`.
   - `src/services/system-settings.service.ts`: Giá trị khởi tạo mặc định gán cứng STHC.
   - `src/components/admissions/programs/ProgramListView.tsx`: Nút giao diện `#seed-standard-sthc-btn` nạp 12 ngành chuẩn STHC.
   - `src/components/admissions/plans/AnnualPlanListView.tsx`: Nút giao diện `#btn-seed-2026-official-plans` nạp chỉ tiêu 2026 STHC.

---

## 4. Truy Vấn Chỉ Đọc (Read-Only Queries) Cho Admin Chạy Trên `pg_catalog`

Do giao thức REST API/PostgREST không cấp quyền đọc trực tiếp các view hệ thống `pg_catalog` và `information_schema` thông qua service key, bảng dưới đây cung cấp kịch bản SQL chỉ đọc an toàn 100% để Quản trị viên/DBA chạy trên Supabase SQL Editor nhằm kiểm tra độc lập:

```sql
-- ====================================================================
-- KỊCH BẢN CHỈ ĐỌC (READ-ONLY) KIỂM KÊ METADATA CHO ADMIN / DBA
-- Tuyệt đối không thay đổi hay xóa dữ liệu.
-- ====================================================================

-- 1. Liệt kê toàn bộ bảng, view trong schema public
SELECT table_schema, table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Liệt kê ràng buộc Khóa chính, Khóa ngoại
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- 3. Liệt kê toàn bộ Triggers đang kích hoạt trên public
SELECT 
    event_object_table AS table_name, 
    trigger_name, 
    event_manipulation, 
    action_timing, 
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 4. Liệt kê các chính sách bảo mật hàng (RLS Policies)
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 5. Kiểm tra các Storage Buckets và Storage Policies
SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets;
SELECT schemaname, tablename, policyname, permissive, cmd FROM pg_policies WHERE schemaname = 'storage';
```

---

## 5. Danh Sách Rủi Ro & Kế Hoạch Cho Các Giai Đoạn Tiếp Theo (C5-B đến C5-J)

| Giai Đoạn | Tên Nhiệm Vụ | Nội Dung & Rủi Ro Cần Xử Lý |
| :--- | :--- | :--- |
| **C5-B** | Hợp nhất Baseline Migration (Schema Unification) | **Rủi ro lớn nhất:** Thiếu file DDL ban đầu cho 25 bảng cốt lõi. Cần tổng hợp file `00_baseline_schema.sql` hoàn chỉnh để triển khai được trên dự án Supabase trắng từ số 0. |
| **C5-C** | Đồng bộ Hóa Stored Functions & Triggers | Khắc phục các hàm bị thiếu trên DB (`finalize_admission_result`, `kpi_start_assignment_review`) để đồng bộ với server proxy. |
| **C5-D** | Chuẩn Hóa Storage Buckets & Policies | Viết migration tự động khởi tạo 4 bucket và cấp quyền storage policy thống nhất thay vì tạo thủ công qua UI. |
| **C5-E** | Chuẩn Hóa Luồng Bootstrap Admin / ROOT | Xây dựng cơ chế khởi tạo tài khoản quản trị đầu tiên mà không phụ thuộc vào dữ liệu có sẵn. |
| **C5-F** | Tham Số Hóa Cấu Hình Đơn Vị (Tenant Parameterization) | Bóc tách nhận diện `STHC`, địa chỉ, email, logo thành bộ tham số cấu hình chung có thể áp dụng cho bất kỳ cơ sở đào tạo nào. |
| **C5-G** | Phân Tách Dữ Liệu Mẫu (Seeds Separation) | Tách biệt `01_core_system_seed.sql` (bắt buộc: roles, permissions, modules, settings mặc định) và `02_demo_sthc_seed.sql` (tùy chọn: ngành học, chỉ tiêu). |
| **C5-H** | Cô Lập Script Kiểm Thử & An Toàn Dữ Liệu | Di chuyển các script kiểm thử sang chế độ sandbox mock hoặc in-memory assertions, bảo đảm không tạo dữ liệu rác trên DB live. |
| **C5-I** | Diễn Tập Triển Khai Supabase Trắng (Dry-Run Rehearsal) | Chạy thử nghiệm toàn bộ chuỗi migration trên một schema/project cô lập để kiểm chứng tính tuần tự và độc lập. |
| **C5-J** | Bàn Giao & Nghiệm Thu Deployment Foundation | Hoàn tất bộ tài liệu hướng dẫn triển khai 1-click cho Quản trị viên hệ thống. |

---

## 6. Đề Xuất Thứ Tự Migration Sơ Bộ (Chưa Thực Thi ở Bước A)

Khi bước sang C5-B, thứ tự chạy các migration trên một Supabase Project trắng cần tuân thủ cấu trúc phân tầng phụ thuộc:

```
├── 00_extensions.sql              (pgcrypto, vector)
├── 01_baseline_core_schema.sql    (profiles, organization_units, members, tasks, daily_reports, metrics, kpi_base)
├── 02_task_attachments.sql        (task_attachments & constraints)
├── 03_kpi_resolvers_and_score.sql (kpi functions, scoring engine, review workflows)
├── 04_access_control_rbac.sql     (access_modules, access_roles, access_permissions, access_role_permissions, user_roles)
├── 05_admissions_foundation.sql   (groups, programs, campaigns, plans, results, result_items, change_history, functions)
├── 06_ai_foundation.sql           (prompts, versions, knowledge_documents, chunks, conversations, messages, usage_logs)
├── 07_system_settings.sql         (system_settings table, RLS, provider configs)
├── 08_storage_buckets_setup.sql   (buckets: system-assets, task-evidence, task-attachments, ai-knowledge-docs + policies)
└── 09_core_baseline_seed.sql      (RBAC standard matrix, default settings, default prompts)
```
*(Ghi chú: Đây là đề xuất phân bổ kiến trúc; chưa tạo hay chạy bất kỳ file nào trong giai đoạn C5-A).*
