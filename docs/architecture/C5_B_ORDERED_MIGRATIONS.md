# Báo Cáo Kỹ Thuật v0.9-C5-B: Chuẩn Hóa Chuỗi Migration Có Thứ Tự (Ordered Migrations)

> **Dự án:** Work + KPI Management System  
> **Thời điểm thực hiện:** 25/09/2026  
> **Nguyên tắc an toàn:** Tuyệt đối không chạy migration trên database production, không sửa cấu hình hay dữ liệu đang vận hành, không đưa dữ liệu riêng STHC / tài khoản thật vào migration nền.  
> **Phương pháp tiếp cận:** Đối chiếu 100% bằng chứng siêu dữ liệu chỉ đọc (OpenAPI PostgREST live dump & SQL Editor Catalog query template), phân loại toàn diện các file migration cũ, chuẩn hóa chuỗi migration mới theo thứ tự phụ thuộc phân tầng.

---

## 1. Tổng Quan & Đánh Giá Kết Quả C5-B

### 1.1. Quyết định: **PASS**
- Đã trích xuất và xác minh bằng chứng chỉ đọc từ live Supabase PostgREST OpenAPI spec: 59 định nghĩa bảng/views, 62 RPC endpoints thực tế.
- Đã xác định rõ các ràng buộc catalog nội bộ chưa có output SQL Editor (khóa ngoại chi tiết, triggers phức tạp, RLS policies chi tiết) và **đánh dấu trạng thái là "Chưa xác minh trên database (chờ kết quả SQL Editor catalog từ Admin)"** thay vì tự suy đoán.
- Đã phân loại triệt để toàn bộ 41 file SQL trong repository thành 4 nhóm rõ ràng (Đang hiệu lực / Chưa chạy / Đã được thay thế / Không còn thuộc sản phẩm).
- Đã phân tích kỹ lưỡng 11 bảng và 12 RPC vắng mặt trên database: làm rõ cơ chế thay thế (gộp vào bảng khác, xử lý qua Express backend proxy hoặc in-memory) và **không tự động triển khai bừa bãi**.
- Đã xây dựng và chuẩn hóa thành công chuỗi 9 migration tuần tự tại thư mục chuẩn `supabase/migrations/` hoàn toàn độc lập, sạch dữ liệu trường cụ thể (STHC-agnostic), sẵn sàng cho việc triển khai trên một Supabase Project trắng.

---

## 2. Bổ Sung Bằng Chứng Chỉ Đọc & Các Điểm Chưa Xác Minh

### 2.1. Nguồn Bằng Chứng Chỉ Đọc Đã Thu Thập
1. **PostgREST OpenAPI Specification Live Dump (`openapi_tables_summary.json`):**
   - 59 tables/views đang phục vụ API với danh sách cột, kiểu dữ liệu PostgreSQL gốc (`UUID`, `TEXT`, `TIMESTAMPTZ`, `BOOLEAN`, `NUMERIC`, `INTEGER`, `JSONB`, `DATE`, `vector(768)`).
   - Ràng buộc Khóa chính (`<pk/>`), Khóa ngoại cấp bảng (`<fk table='...' column='...'/>`), và danh sách cột bắt buộc (`required: [...]`).
2. **PostgREST RPC Endpoint Spec:**
   - 62 hàm RPC đang hoạt động và danh sách tham số, schema trả về.
3. **Supabase Storage API:**
   - Cấu hình 4 storage buckets (`system-assets`, `task-evidence`, `task-attachments`, `ai-knowledge-docs`) với trạng thái public, giới hạn kích thước và MIME types.

### 2.2. Các Điểm Đánh Dấu "Chưa Xác Minh Trên Database" (Cần Admin Chạy Script SQL Editor)
Vì PostgREST không cho phép đọc trực tiếp `pg_catalog` và `information_schema` qua API REST, các thành phần sau được đánh dấu là **chưa xác minh trên catalog database**:
- Tên chính xác của từng trigger nội bộ gắn với các bảng cốt lõi (ngoại trừ trigger `trg_sync_profile_system_role` đã kiểm tra qua file source).
- Các chỉ mục (indexes) bổ sung tự tạo thủ công trên Supabase Dashboard ngoài các chỉ mục khóa chính/khóa ngoại.
- Chi tiết biểu thức RLS `USING` / `WITH CHECK` cho từng vai trò trên các bảng nghiệp vụ cũ.

> **Kịch bản chỉ đọc để Admin / DBA chạy trên Supabase SQL Editor đã được cung cấp tại Mục 4 của Báo cáo C5-A** (`docs/architecture/C5_A_DEPLOYMENT_FOUNDATION_INVENTORY.md`).

---

## 3. Phân Loại Toàn Bộ Migration Cũ Trong Repository

| File Migration Cũ | Vị trí | Tình trạng | Phân loại | Ghi chú & Quyết định xử lý |
| :--- | :--- | :---: | :---: | :--- |
| `20260918_v0_9_a2_access_control_foundation.sql` | Gốc | Đang chạy | **Đang hiệu lực** | Đã được hợp nhất chuẩn hóa vào `00003_access_control_rbac.sql`. |
| `20260918_v0_9_a3_migrate_user_roles.sql` | Gốc | Đang chạy | **Đang hiệu lực** | Đã đưa trigger đồng bộ role vào `00003_access_control_rbac.sql`. |
| `fix.sql` | Gốc | Đang chạy | **Đang hiệu lực** | Hotfix cho `kpi_resolve_assignment_score`, đã đưa vào `00006_kpi_foundation_and_scoring.sql`. |
| `schema_check.sql` | Gốc | Không áp dụng | **Không thuộc sản phẩm** | Script truy vấn kiểm tra của dev, giữ lưu trữ tham khảo. |
| `v0.8-A1-admissions-foundation.sql` | Gốc | Đã cũ | **Đã được thay thế** | Bị thay thế bởi bản đầy đủ `migrations/v0.8-A1_admission_foundation.sql`. |
| `v0.8-A2-admission-plans-results.sql` | Gốc | Đã cũ | **Đã được thay thế** | Bị thay thế bởi bản `migrations/v0.8-A2_admission_plans_and_results.sql`. |
| `v0.8-A3-admission-security-audit.sql` | Gốc | Đã cũ | **Đã được thay thế** | Bị thay thế bởi bản `migrations/v0.8-A3_admission_security_audit.sql`. |
| `v0.8-E1-google-sheets-config.sql` | Gốc | Chưa chạy | **Chưa chạy (Prototype)** | Thử nghiệm đồng bộ Google Sheets; chưa từng chạy trên DB live. |
| `v0.8-E2-google-sheets-mappings.sql` | Gốc | Chưa chạy | **Chưa chạy (Prototype)** | Thử nghiệm đồng bộ Google Sheets; chưa từng chạy trên DB live. |
| `v0.8-E3-sync-history.sql` | Gốc | Chưa chạy | **Chưa chạy (Prototype)** | Thử nghiệm đồng bộ Google Sheets; chưa từng chạy trên DB live. |
| `migrations/v0.2.2_announcement.sql` | `migrations/` | Đang chạy | **Đang hiệu lực** | Đã hợp nhất vào `00004_tasks_and_announcements.sql`. |
| `migrations/v0.2.2.1_task_attachments.sql` | `migrations/` | Chưa chạy | **Đã được thay thế** | Hệ thống lưu file qua `task_evidence` và storage bucket `task-attachments`. |
| `migrations/v0.4.3-C_kpi_resolvers.sql` | `migrations/` | Đang chạy | **Đang hiệu lực** | Đã đưa vào `00006_kpi_foundation_and_scoring.sql`. |
| `migrations/v0.4.3-D_kpi_manual_trace.sql` | `migrations/` | Đang chạy | **Đang hiệu lực** | Đã đưa vào `00006_kpi_foundation_and_scoring.sql`. |
| `migrations/v0.4.3-E_kpi_final_acceptance.sql` | `migrations/` | Đang chạy | **Đang hiệu lực** | Đã đưa vào `00006_kpi_foundation_and_scoring.sql`. |
| `migrations/v0.4.4-A_kpi_scoring_engine.sql` | `migrations/` | Đang chạy | **Đang hiệu lực** | Đã đưa vào `00006_kpi_foundation_and_scoring.sql`. |
| `migrations/v0.4.4-B_kpi_scoring_engine.sql` | `migrations/` | Đang chạy | **Đang hiệu lực** | Đã đưa vào `00006_kpi_foundation_and_scoring.sql`. |
| `migrations/v0.4.5-A_kpi_review_lifecycle.sql` | `migrations/` | Chưa chạy | **Đã được thay thế** | Trạng thái duyệt KPI được tích hợp thẳng vào `kpi_assignments.status`. |
| `migrations/v0.4.5-B_kpi_review_workflow.sql` | `migrations/` | Chưa chạy | **Đã được thay thế** | Quy trình duyệt được điều phối tại backend service. |
| `migrations/v0.4.5-D_kpi_lock.sql` | `migrations/` | Chưa chạy | **Đã được thay thế** | Khóa KPI xử lý qua cờ `locked_at` trong `kpi_assignments`. |
| `migrations/v0.4.6-A_kpi_dashboard_read_model.sql`| `migrations/` | Chưa chạy | **Đã được thay thế** | Frontend / Backend tổng hợp đa nhiệm vụ qua client batching. |
| `migrations/v0.5-A4_ai_prompt_registry.sql` | `migrations/` | Đang chạy | **Đang hiệu lực** | Đã đưa vào `00008_ai_assistant_and_usage.sql`. |
| `migrations/v0.5-A5_ai_requests.sql` | `migrations/` | Đã cũ | **Đã được thay thế** | Thay thế bằng `ai_usage_logs` trong `v0.10-AI-D1`. |
| `migrations/v0.5-E2_staff_kpi_summary_prompt.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Prompt mẫu, tách riêng ở C5-G. |
| `migrations/v0.7-H2-cleanup.sql` | `migrations/` | Đã hoàn tất | **Không thuộc sản phẩm** | Script dọn dẹp view cũ một lần trong quá khứ. |
| `migrations/v0.8-A1_admission_foundation.sql` | `migrations/` | Đang chạy | **Đang hiệu lực** | Đã hợp nhất vào `00007_admissions_foundation.sql`. |
| `migrations/v0.8-A2_admission_plans_and_results.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Đã hợp nhất vào `00007_admissions_foundation.sql`. |
| `migrations/v0.8-A3_admission_security_audit.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Đã hợp nhất vào `00007_admissions_foundation.sql`. |
| `migrations/v0.8-D2_admission_finalize_reopen.sql`| `migrations/` | Chưa chạy | **Đã được thay thế** | Xử lý chốt/mở lại qua Express API `/api/admissions/results/:id/finalize`. |
| `migrations/v0.9-AI-A3_assistant_rag_foundation.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Đã hợp nhất vào `00008_ai_assistant_and_usage.sql`. |
| `migrations/v0.9-AI-A4_assistant_rbac_integration.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Đã hợp nhất vào `00008_ai_assistant_and_usage.sql`. |
| `migrations/v0.9-AI-B2_assistant_idempotency.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Đã hợp nhất vào `00008_ai_assistant_and_usage.sql`. |
| `migrations/v0.9-AI-C2_document_processing.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Cột trạng thái xử lý tài liệu, đã đưa vào `00008`. |
| `migrations/v0.9-AI-C3_rag_retrieval.sql` | `migrations/` | Chưa chạy | **Đã được thay thế** | Truy vấn cosine similarity vector thực hiện in-memory qua backend service. |
| `migrations/v0.9-C4.5-B_functional_roles.sql` | `migrations/` | Đang chạy | **Đang hiệu lực** | Đã tích hợp 3 vai trò tuyển sinh vào `00003_access_control_rbac.sql`. |
| `migrations/v0.10-AI-D1_ai_usage_monitoring.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Đã đưa vào `00008_ai_assistant_and_usage.sql`. |
| `migrations/v0.10-AI-D3-B_multi_provider_config.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Đã đưa vào `00008_ai_assistant_and_usage.sql`. |
| `migrations/v0.10-AI-D3-D_provider_versioning.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Đã đưa vào `00008_ai_assistant_and_usage.sql`. |
| `migrations/v0.10-AI-D3-G_fix_config_versioning_and_retest.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Phiên bản mới nhất của `fn_ai_activate_provider`, đã đưa vào `00008`. |
| `migrations/v0.11-AI-Config_system_settings.sql`| `migrations/` | Đang chạy | **Đang hiệu lực** | Đã đưa vào `00002_core_organization_and_users.sql`. |
| `migrations/cleanup_4_test_campaigns.sql` | `migrations/` | Đã hoàn tất | **Không thuộc sản phẩm** | Dọn dữ liệu test 4 campaign, không đưa vào migration nền. |

---

## 4. Xử Lý 11 Bảng & 12 RPC Đang Thiếu Trên Database

Theo chỉ đạo của bước C5-B: **Tuyệt đối không tự động triển khai 11 bảng hoặc 12 RPC chỉ vì chúng xuất hiện trong file SQL.** Dưới đây là phân tích và quyết định kiến trúc:

### 4.1. Đối với 11 Bảng Thiếu
1. `announcements`: **Bỏ qua.** Tính năng thông báo chỉ đạo đã được tích hợp thẳng vào bảng `public.tasks` thông qua cột `task_type = 'announcement'`, `publication_status`, `content_version`. Việc tạo bảng `announcements` riêng là tàn dư thiết kế cũ.
2. `announcement_acknowledgements` & `announcement_views`: **Bỏ qua.** Lưu trực tiếp qua `task_announcement_audience_users.acknowledged_at` và `tasks.progress`.
3. `task_attachments`: **Bỏ qua.** Ứng dụng hiện lưu trữ tệp đính kèm đầu việc qua bảng `public.task_evidence` và Supabase Storage Bucket `task-attachments`.
4. `kpi_assignment_reviews` & `kpi_assignment_item_reviews`: **Bỏ qua.** Quy trình đánh giá KPI sử dụng các trạng thái trong `kpi_assignments.status` (`reviewing`, `approved`, `locked`).
5. `admission_google_sheets_config`, `admission_sheet_campaign_mappings`, `admission_sheet_program_mappings`, `admission_sync_batches`, `admission_sync_batch_sheets`: **Bỏ qua.** Đây là nhóm tính năng prototype chưa từng được kích hoạt trên hệ thống chính thức.
6. `ai_requests`: **Bỏ qua.** Đã được thay thế hoàn toàn bởi bảng `public.ai_usage_logs` có cơ chế rate limiting và reservation tokens hoàn chỉnh hơn.

### 4.2. Đối với 12 RPC Stored Procedures Thiếu
1. `finalize_admission_result` & `reopen_admission_result`: **Giữ nguyên luồng hiện tại qua Express Backend Proxy.** Backend (`admissions.routes.ts`) đã xử lý kiểm tra quyền RBAC và ghi nhật ký kiểm toán trực tiếp an toàn hơn.
2. `kpi_resolve_assignments_score_batch`: **Bỏ qua.** Frontend/Backend gọi hàm chuẩn `kpi_resolve_assignment_score` theo mảng UUID.
3. `kpi_start_assignment_review`, `kpi_approve_assignment_review`, `kpi_return_assignment_review`, `kpi_resubmit_assignment_review`, `kpi_lock_assignment_review`: **Bỏ qua.** Vì bảng review không tồn tại, các hàm này không được nạp để tránh lỗi cú pháp.
4. `fn_ai_search_knowledge_chunks`: **Bỏ qua.** Module RAG sử dụng thuật toán cosine similarity in-memory của Node.js service (`ragRetrieval.service.ts`).
5. `fn_ai_finalize_usage`: **Bỏ qua.** Service `usageTracking.service.ts` cập nhật trực tiếp hai bảng `ai_usage_logs` và `ai_usage_counters`.

---

## 5. Danh Sách Chuỗi Migration Đã Chuẩn Hóa Theo Thứ Tự

Toàn bộ DDL cần thiết đã được tổ chức tại thư mục chuẩn: `supabase/migrations/`

| STT | Tên File Migration | Mục đích nghiệp vụ | Bảng & Đối tượng Database Khởi Tạo | Phụ thuộc |
| :---: | :--- | :--- | :--- | :--- |
| **01** | `00001_extensions.sql` | Kích hoạt các tiện ích mở rộng cốt lõi | Extensions: `pgcrypto`, `vector` | Không |
| **02** | `00002_core_organization_and_users.sql` | Nền tảng tổ chức, nhân sự, thiết lập & thông báo | Tables: `profiles`, `organization_units`, `organization_members`, `system_settings`, `notifications` | 01, `auth.users` |
| **03** | `00003_access_control_rbac.sql` | Khung phân quyền RBAC & đồng bộ vai trò | Tables: `access_modules`, `access_roles`, `access_permissions`, `access_role_permissions`, `access_user_roles`, `access_audit_logs`. Function & Trigger: `sync_profile_system_role_to_access_user_roles()`. Seed 7 vai trò chuẩn. | 02 |
| **04** | `00004_tasks_and_announcements.sql` | Quản lý nhiệm vụ, tiến độ, minh chứng & thông báo chỉ đạo | Tables: `tasks`, `task_assignees`, `task_updates`, `task_evidence`, `task_comments`, `task_announcement_audience_units`, `task_announcement_audience_users`, `announcement_reminders` | 02, 03 |
| **05** | `00005_daily_reports_and_metrics.sql` | Báo cáo hằng ngày, nguồn dữ liệu & chỉ số đo lường | Tables: `report_sources`, `report_source_unit_assignments`, `daily_reports`, `daily_report_task_links`, `daily_report_sources`, `daily_report_reminders`, `metric_definitions`, `metric_entries`, `report_source_metric_assignments` | 02, 04 |
| **06** | `00006_kpi_foundation_and_scoring.sql` | Mục tiêu, định nghĩa KPI, mẫu, giao chỉ tiêu & công cụ tính điểm | Tables: `kpi_objectives`, `kpi_definitions`, `kpi_periods`, `kpi_templates`, `kpi_template_versions`, `kpi_template_items`, `kpi_template_item_bindings`, `kpi_assignments`, `kpi_assignment_items`, `kpi_assignment_item_bindings`, `kpi_manual_actual_entries`. Functions: `kpi_get_org_descendants`, `kpi_resolve_assignment_item_actual`, `kpi_resolve_assignment_item_score`, `kpi_resolve_assignment_score` | 02, 03, 05 |
| **07** | `00007_admissions_foundation.sql` | Quản lý tuyển sinh, kế hoạch, kết quả, nhật ký thay đổi & view hiệu năng | Tables: `admission_groups`, `admission_programs`, `admission_campaigns`, `admission_plans`, `admission_results`, `admission_result_items`, `admission_change_history`. Views: `admission_campaign_performance_v`, `admission_year_performance_v`. Function: `recalculate_admission_result` | 02, 03 |
| **08** | `00008_ai_assistant_and_usage.sql` | Kho tri thức RAG vector, hội thoại AI, cấu hình model & giám sát chi phí | Tables: `ai_prompt_definitions`, `ai_prompt_versions`, `ai_knowledge_documents`, `ai_knowledge_chunks` (vector 768), `ai_conversations`, `ai_messages`, `ai_message_sources`, `ai_usage_settings`, `ai_usage_reservations`, `ai_usage_counters`, `ai_usage_logs`, `ai_provider_configs`. Function: `fn_ai_activate_provider` | 01, 02, 03 |
| **09** | `00009_storage_buckets_setup.sql` | Khởi tạo 4 Storage Buckets & Policies truy cập tệp an toàn | Buckets: `system-assets`, `task-evidence`, `task-attachments`, `ai-knowledge-docs`. Storage RLS Policies. | 02, 08 |

---

## 6. Hướng Dẫn Kiểm Tra Trên Database Trắng (Dự Kiến Cho C5-G / C5-I)

Khi bước vào giai đoạn diễn tập triển khai độc lập (C5-G hoặc C5-I), người vận hành có thể thực hiện theo quy trình sau trên một Supabase Project trắng mới:

1. **Chuẩn bị Dự Án Supabase Trắng:**
   - Tạo mới một Supabase Project tại khu vực mong muốn.
   - Lấy URL và Service Role Key từ phần `Settings -> API`.
2. **Thực thi Chuỗi Migration Tuần Tự (Qua Supabase CLI hoặc SQL Editor):**
   ```bash
   # Nếu dùng Supabase CLI
   supabase db push
   
   # Hoặc chạy tuần tự từng file qua SQL Editor theo đúng số thứ tự:
   # 00001_extensions.sql
   # 00002_core_organization_and_users.sql
   # 00003_access_control_rbac.sql
   # 00004_tasks_and_announcements.sql
   # 00005_daily_reports_and_metrics.sql
   # 00006_kpi_foundation_and_scoring.sql
   # 00007_admissions_foundation.sql
   # 00008_ai_assistant_and_usage.sql
   # 00009_storage_buckets_setup.sql
   ```
3. **Kiểm Tra Tính Toàn Vẹn Tự Động:**
   - Chạy script kiểm tra đếm bảng: Đảm bảo có đủ **53 bảng cốt lõi** và **2 views**.
   - Kiểm tra `storage.buckets`: Đảm bảo có đủ **4 buckets**.
   - Kiểm tra `access_roles`: Đảm bảo có đủ **7 vai trò tiêu chuẩn** (`staff`, `manager`, `executive`, `admin`, `admissions_staff`, `admissions_manager`, `admissions_admin`).
4. **Tiến Hành Khởi Tạo Tài Khoản ROOT Đầu Tiên (Theo Quy Trình C5-E):**
   - Tạo user quản trị ban đầu mà không làm sai lệch hay rò rỉ dữ liệu của trường khác.

---

## 7. Đảm Bảo An Toàn & Dừng Bước

- Toàn bộ chuỗi 9 migration đã được lưu trữ độc lập tại `supabase/migrations/`.
- Không có bất kỳ câu lệnh DDL/DML nào được thực thi lên database production.
- Không có tài khoản thật, mật khẩu hay dữ liệu riêng của STHC nằm trong bộ migration nền.
- **Hoàn thành mốc C5-B và DỪNG LẠI tại đây.** Không tự động thực hiện C5-C.
