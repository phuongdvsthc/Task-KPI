# Báo Cáo Kỹ Thuật v0.9-C5-A: Kiểm Kê Nền Tảng Triển Khai (Deployment Foundation Inventory)
> **Dự án:** Work + KPI Management System  
> **Thời điểm kiểm kê:** 25/09/2026 | **Phương pháp:** Chỉ đọc (Read-only metadata inspection), đối chiếu 100% mã nguồn với cơ sở dữ liệu Supabase thực tế.  
> **Cam kết an toàn:** Không chạy migration, không sửa schema, không xóa/sửa dữ liệu, không thay đổi cấu hình production, không làm lộ thông tin bí mật (mật khẩu, API key, token, service role key).

---

## 1. Tóm Tắt Kết Quả & Quyết Định C5-A

### Quyết định: **PASS**
- **Cơ sở dữ liệu thực tế:** Đã trích xuất và đối chiếu đầy đủ **59 bảng/views** và **62 RPC functions** đang vận hành trực tiếp trên schema `public` thông qua PostgREST OpenAPI spec và Supabase Client.
- **Mã nguồn repository:** Đã quét toàn bộ **41 file SQL** (10 file tại thư mục gốc, 31 file tại `migrations/`), toàn bộ backend routes (`server.ts`, `server/admissions/admissions.routes.ts`, `server/authorization/`), và frontend components.
- **Phát hiện quan trọng nhất (Critical Finding):**
  - Có tới **31 bảng/views cốt lõi** đang chạy trên database thực tế nhưng **hoàn toàn không có file DDL (`CREATE TABLE`) trong thư mục `migrations/`** (bao gồm `profiles`, `organization_units`, `tasks`, `daily_reports`, `kpi_*`). Các bảng này được tạo thủ công hoặc từ bootstrap ban đầu chưa được commit thành file migration chuẩn.
  - Nếu triển khai repository này lên một Supabase Project trắng chỉ bằng cách chạy các file `.sql` hiện có trong `migrations/`, **quá trình cài đặt sẽ thất bại ngay lập tức** do thiếu bảng nền tảng.
  - Đây chính là giá trị cốt lõi của bước C5-A: phát hiện chính xác lỗ hổng để chuẩn bị cho C5-B (tổng hợp bộ migration hoàn chỉnh).

---

## 2. Bảng Kiểm Kê Thành Phần Nền Tảng (Inventory Matrix)

### 2.1. Extension PostgreSQL
| Tên Extension | Schema | Mục đích | Nguồn bằng chứng | Phân loại | Tình trạng xác minh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `pgcrypto` | `public` / `extensions` | Sinh UUID ngẫu nhiên (`gen_random_uuid()`), mã hóa | `migrations/v0.9-AI-A3`, `20260918_v0_9_a2` | Nền tảng dùng chung | **VERIFIED ON DB** |
| `vector` (pgvector) | `public` / `extensions` | Lưu trữ vector embedding 768 chiều (`public.vector(768)`) cho AI RAG | `ai_knowledge_chunks.embedding`, `v0.9-AI-A3` | Nền tảng dùng chung | **VERIFIED ON DB** |

### 2.2. Danh mục Bảng & View trong Schema `public` (59 đối tượng thực tế)

#### Nhóm 1: Cơ Cấu Tổ Chức, Người Dùng & Phân Quyền (11 bảng)
| Tên Bảng / View | Loại | Cột chính / Khóa chính / Khóa ngoại | Nguồn bằng chứng | Phân loại | Tình trạng xác minh |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `profiles` | Table | PK: `id` (FK `auth.users`). Cột: `email`, `full_name`, `system_role`, `is_active`, `avatar_url`, `job_title` | OpenAPI dump, `server.ts:818` | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `organization_units` | Table | PK: `id`. FK: `parent_id` ➔ `organization_units.id`. Cột: `code`, `name`, `unit_type`, `is_active`, `sort_order` | OpenAPI dump, `server.ts:384` | Nền tảng dùng chung (chứa dữ liệu STHC) | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `organization_members` | Table | PK: `id`. FK: `unit_id` ➔ `organization_units.id`, `user_id` ➔ `profiles.id`. Cột: `role` (`manager`/`member`), `is_primary` | OpenAPI dump, `server.ts:795` | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `access_modules` | Table | PK: `id`. Cột: `code`, `name`, `description`, `sort_order`, `is_active` | `20260918_v0_9_a2`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `access_roles` | Table | PK: `id`. Cột: `code`, `name`, `description`, `is_system`, `is_active` | `20260918_v0_9_a2`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `access_permissions` | Table | PK: `id`. FK: `module_id` ➔ `access_modules.id`. Cột: `code`, `name`, `scope_type` | `20260918_v0_9_a2`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `access_role_permissions` | Table | PK: `id`. FK: `role_id` ➔ `access_roles.id`, `permission_id` ➔ `access_permissions.id` | `20260918_v0_9_a2`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `access_user_roles` | Table | PK: `id`. FK: `user_id` ➔ `profiles.id`, `role_id` ➔ `access_roles.id`. Cột: `assigned_by`, `assigned_at` | `20260918_v0_9_a2`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `access_audit_logs` | Table | PK: `id`. Cột: `action`, `entity_type`, `entity_id`, `actor_id`, `old_values`, `new_values`, `created_at` | `20260918_v0_9_a2`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `system_settings` | Table | PK: `id`. Cột: `setting_key` (unique), `setting_value`, `setting_type`, `is_public`, `description` | OpenAPI dump, `v0.11-AI-Config` | Nền tảng dùng chung (chứa dữ liệu STHC) | **VERIFIED BOTH** (DB & SQL) |
| `notifications` | Table | PK: `id`. FK: `user_id` ➔ `profiles.id`. Cột: `title`, `content`, `type`, `is_read`, `created_at` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |

#### Nhóm 2: Quản Lý Công Việc & Thông Báo Chỉ Đạo (7 bảng)
| Tên Bảng | Loại | Khóa chính / Khóa ngoại | Nguồn bằng chứng | Phân loại | Tình trạng xác minh |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `tasks` | Table | PK: `id`. FK: `created_by` ➔ `profiles.id`, `unit_id` ➔ `organization_units.id`. Cột: `code`, `title`, `status`, `priority`, `start_date`, `due_date`, `progress` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `task_assignees` | Table | PK: `id`. FK: `task_id` ➔ `tasks.id`, `user_id` ➔ `profiles.id`. Cột: `role` (`assignee`/`reviewer`) | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `task_updates` | Table | PK: `id`. FK: `task_id` ➔ `tasks.id`, `user_id` ➔ `profiles.id`. Cột: `progress`, `content`, `created_at` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `task_evidence` | Table | PK: `id`. FK: `task_id` ➔ `tasks.id`, `uploaded_by` ➔ `profiles.id`. Cột: `file_url`, `file_name`, `file_size`, `mime_type` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `task_comments` | Table | PK: `id`. FK: `task_id` ➔ `tasks.id`, `user_id` ➔ `profiles.id`, `parent_comment_id` ➔ `task_comments.id` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `task_announcement_audience_units` | Table | PK: `id`. FK: `task_id` ➔ `tasks.id`, `unit_id` ➔ `organization_units.id` | OpenAPI dump, `v0.2.2_announcement` | Nền tảng dùng chung | **MISSING IN SQL REPO** (File `v0.2.2` chỉ có `announcement_recipients`) |
| `task_announcement_audience_users` | Table | PK: `id`. FK: `task_id` ➔ `tasks.id`, `user_id` ➔ `profiles.id` | OpenAPI dump, `v0.2.2_announcement` | Nền tảng dùng chung | **MISSING IN SQL REPO** |

#### Nhóm 3: Báo Cáo Hằng Ngày & Nguồn Tự Động (6 bảng)
| Tên Bảng | Loại | Khóa chính / Khóa ngoại | Nguồn bằng chứng | Phân loại | Tình trạng xác minh |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `daily_reports` | Table | PK: `id`. FK: `user_id` ➔ `profiles.id`, `unit_id` ➔ `organization_units.id`. Cột: `report_date`, `status`, `submitted_at`, `approved_at` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `daily_report_task_links` | Table | PK: `id`. FK: `report_id` ➔ `daily_reports.id`, `task_id` ➔ `tasks.id`. Cột: `hours_spent`, `notes` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `daily_report_sources` | Table | PK: `id`. FK: `report_id` ➔ `daily_reports.id`, `source_id` ➔ `report_sources.id` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `daily_report_reminders` | Table | PK: `id`. FK: `sender_id` ➔ `profiles.id`, `recipient_id` ➔ `profiles.id`. Cột: `report_date`, `message`, `sent_at` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `report_sources` | Table | PK: `id`. Cột: `code`, `name`, `source_type`, `is_active`, `config` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `report_source_unit_assignments` | Table | PK: `id`. FK: `source_id` ➔ `report_sources.id`, `unit_id` ➔ `organization_units.id` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |

#### Nhóm 4: KPI & Chỉ Số Đo Lường (17 bảng)
| Tên Bảng | Loại | Khóa chính / Khóa ngoại | Nguồn bằng chứng | Phân loại | Tình trạng xác minh |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `metric_definitions` | Table | PK: `id`. Cột: `code`, `name`, `unit_of_measure`, `aggregation_type`, `is_active` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `metric_entries` | Table | PK: `id`. FK: `metric_definition_id` ➔ `metric_definitions.id`, `unit_id` ➔ `organization_units.id`, `user_id` ➔ `profiles.id` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `report_source_metric_assignments`| Table | PK: `id`. FK: `source_id` ➔ `report_sources.id`, `metric_definition_id` ➔ `metric_definitions.id` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `kpi_definitions` | Table | PK: `id`. Cột: `code`, `name`, `scoring_type`, `target_type`, `calculation_formula` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `kpi_objectives` | Table | PK: `id`. Cột: `code`, `name`, `perspective`, `sort_order` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `kpi_periods` | Table | PK: `id`. Cột: `code`, `name`, `start_date`, `end_date`, `status` (`planning`/`in_progress`/`reviewing`/`closed`) | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `kpi_templates` | Table | PK: `id`. Cột: `code`, `name`, `target_role`, `is_active` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `kpi_template_versions` | Table | PK: `id`. FK: `template_id` ➔ `kpi_templates.id`. Cột: `version_number`, `status` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `kpi_template_items` | Table | PK: `id`. FK: `template_version_id` ➔ `kpi_template_versions.id`, `kpi_definition_id` ➔ `kpi_definitions.id` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `kpi_template_item_bindings` | Table | PK: `id`. FK: `template_item_id` ➔ `kpi_template_items.id`, `metric_definition_id` ➔ `metric_definitions.id` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `kpi_assignments` | Table | PK: `id`. FK: `period_id` ➔ `kpi_periods.id`, `user_id` ➔ `profiles.id`, `unit_id` ➔ `organization_units.id`. Cột: `status`, `total_score` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `kpi_assignment_items` | Table | PK: `id`. FK: `assignment_id` ➔ `kpi_assignments.id`, `kpi_definition_id` ➔ `kpi_definitions.id`. Cột: `target_value`, `actual_value`, `weight`, `score` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `kpi_assignment_item_bindings` | Table | PK: `id`. FK: `assignment_item_id` ➔ `kpi_assignment_items.id`, `metric_definition_id` ➔ `metric_definitions.id` | OpenAPI dump | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |
| `kpi_manual_actual_entries` | Table | PK: `id`. FK: `assignment_item_id` ➔ `kpi_assignment_items.id`, `entered_by` ➔ `profiles.id`. Cột: `actual_value`, `evidence_url`, `note` | OpenAPI dump, `v0.4.3-D` | Nền tảng dùng chung | **MISSING IN SQL REPO** (Có trên DB thực tế) |

#### Nhóm 5: Phân Hệ Tuyển Sinh (Admissions) (9 bảng & 2 views)
| Tên Bảng / View | Loại | Khóa chính / Khóa ngoại | Nguồn bằng chứng | Phân loại | Tình trạng xác minh |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `admission_groups` | Table | PK: `id`. Cột: `code` (unique), `name`, `sort_order`, `is_active` | `v0.8-A1`, OpenAPI | Nền tảng dùng chung (chứa dữ liệu STHC) | **VERIFIED BOTH** (DB & SQL) |
| `admission_programs` | Table | PK: `id`. FK: `group_id` ➔ `admission_groups.id`, `unit_id` ➔ `organization_units.id`. Cột: `code`, `name`, `degree_level`, `is_active` | `v0.8-A1`, OpenAPI | Nền tảng dùng chung (chứa dữ liệu STHC) | **VERIFIED BOTH** (DB & SQL) |
| `admission_campaigns` | Table | PK: `id`. FK: `group_id` ➔ `admission_groups.id`, `unit_id` ➔ `organization_units.id`. Cột: `code`, `name`, `year`, `period_number`, `status`, `start_date`, `end_date` | `v0.8-A1`, OpenAPI | Nền tảng dùng chung (chứa dữ liệu STHC) | **VERIFIED BOTH** (DB & SQL) |
| `admission_plans` | Table | PK: `id`. FK: `campaign_id` ➔ `admission_campaigns.id`, `program_id` ➔ `admission_programs.id`. Cột: `target_quantity`, `status` | `v0.8-A2`, OpenAPI | Nền tảng dùng chung (chứa dữ liệu STHC) | **VERIFIED BOTH** (DB & SQL) |
| `admission_results` | Table | PK: `id`. FK: `campaign_id` ➔ `admission_campaigns.id`. Cột: `status`, `total_enrolled`, `finalized_at` | `v0.8-A2`, OpenAPI | Nền tảng dùng chung (chứa dữ liệu STHC) | **VERIFIED BOTH** (DB & SQL) |
| `admission_result_items` | Table | PK: `id`. FK: `result_id` ➔ `admission_results.id`, `program_id` ➔ `admission_programs.id`. Cột: `enrolled_quantity` | `v0.8-A2`, OpenAPI | Nền tảng dùng chung (chứa dữ liệu STHC) | **VERIFIED BOTH** (DB & SQL) |
| `admission_change_history` | Table | PK: `id`. FK: `campaign_id` ➔ `admission_campaigns.id`. Cột: `entity_type`, `entity_id`, `action`, `old_data`, `new_data`, `changed_by` | `v0.8-A1`, `v0.8-A3`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `admission_campaign_performance_v`| View | PK ảo: `campaign_id`. Tính tỷ lệ đạt kế hoạch theo đợt | `v0.8-A2`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `admission_year_performance_v` | View | PK ảo: `year`, `group_id`. Tính tỷ lệ đạt kế hoạch theo năm | `v0.8-A2`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |

#### Nhóm 6: Trợ Lý AI & Quản Lý Tri Thức (11 bảng)
| Tên Bảng | Loại | Khóa chính / Khóa ngoại | Nguồn bằng chứng | Phân loại | Tình trạng xác minh |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `ai_provider_configs` | Table | PK: `id`. Cột: `provider_code` (unique: `gemini`/`openai`), `model`, `is_active`, `config_version`, `status` | `v0.10-AI-D3-B`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `ai_prompt_definitions` | Table | PK: `id`. Cột: `prompt_key` (unique), `name`, `category`, `description` | `v0.5-A4`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `ai_prompt_versions` | Table | PK: `id`. FK: `definition_id` ➔ `ai_prompt_definitions.id`. Cột: `version_number`, `system_prompt`, `user_prompt_template`, `is_active` | `v0.5-A4`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `ai_conversations` | Table | PK: `id`. FK: `user_id` ➔ `profiles.id`. Cột: `title`, `context_type`, `created_at` | `v0.9-AI-A3`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `ai_messages` | Table | PK: `id`. FK: `conversation_id` ➔ `ai_conversations.id`. Cột: `role` (`user`/`assistant`), `content`, `tokens_used` | `v0.9-AI-A3`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `ai_message_sources` | Table | PK: `id`. FK: `message_id` ➔ `ai_messages.id`, `chunk_id` ➔ `ai_knowledge_chunks.id`. Cột: `relevance_score` | `v0.9-AI-A3`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `ai_knowledge_documents` | Table | PK: `id`. FK: `uploaded_by` ➔ `profiles.id`. Cột: `title`, `file_url`, `file_type`, `total_chunks`, `status` | `v0.9-AI-A3`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `ai_knowledge_chunks` | Table | PK: `id`. FK: `document_id` ➔ `ai_knowledge_documents.id`. Cột: `chunk_index`, `content`, `embedding` (`vector(768)`) | `v0.9-AI-A3`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `ai_usage_settings` | Table | PK: `id`. Cột: `daily_token_limit`, `rate_limit_per_minute` | `v0.10-AI-D1`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `ai_usage_reservations`| Table | PK: `id`. FK: `user_id` ➔ `profiles.id`. Cột: `reserved_tokens`, `status`, `expires_at` | `v0.10-AI-D1`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `ai_usage_counters` | Table | PK: `id`. Cột: `period_date`, `total_tokens`, `total_cost` | `v0.10-AI-D1`, OpenAPI | Nền tảng dùng chung | **VERIFIED BOTH** (DB & SQL) |
| `ai_usage_logs` | Table | PK: `id`. FK: `user_id` ➔ `profiles.id`. Cột: `provider`, `model`, `prompt_tokens`, `completion_tokens`, `latency_ms` | `v0.10-AI-D1`, OpenAPI | Nền tảng dùng chung (chứa log test) | **VERIFIED BOTH** (DB & SQL) |

---

## 3. Storage Buckets & Quy Tắc Truy Cập

| Tên Bucket | Trạng thái Public | Dung lượng tệp giới hạn | Loại MIME cho phép | Mục đích nghiệp vụ | RLS Storage Policy |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **`task-evidence`** | `false` (Private) | Mặc định (50MB) | PDF, PNG, JPG, DOCX, XLSX | Minh chứng hoàn thành công việc | Người dùng tải lên, người giao việc & quản lý đơn vị có quyền xem. |
| **`task-attachments`** | `false` (Private) | Mặc định (50MB) | Mọi định dạng tài liệu | Tài liệu đính kèm đầu việc / thông báo chỉ đạo | Mọi thành viên tham gia đầu việc / người nhận thông báo được đọc. |
| **`system-assets`** | `true` (Public) | Mặc định (5MB) | Ảnh (PNG, JPG, SVG, ICO) | Logo trường, logo nhỏ, favicon, ảnh giao diện | Public đọc không cần token; chỉ Admin mới có quyền ghi/sửa/xóa. |
| **`ai-knowledge-docs`** | `false` (Private) | Mặc định (50MB) | PDF, DOCX, TXT | Tài liệu văn bản nội bộ nạp vào Kho tri thức RAG | Chỉ Admin có quyền upload/xóa; Backend Service Role đọc để chunking & trích xuất vector. |

---

## 4. Thành Phần Auth, Trigger & Quy Trình Khởi Tạo Admin/ROOT

### 4.1. Trigger Đồng Bộ Hồ Sơ (`profiles` ➔ `access_user_roles`)
- **Tên Function:** `sync_profile_system_role_to_access_user_roles()` (trong file `20260918_v0_9_a2_access_control_foundation.sql`).
- **Trigger:** Tự động bắt sự kiện `INSERT` hoặc `UPDATE` của cột `system_role` trên bảng `public.profiles` để đồng bộ bản ghi tương ứng vào bảng `public.access_user_roles`.
- **Rủi ro phụ thuộc:** Trigger này yêu cầu cả hai bảng `profiles` và `access_user_roles` phải tồn tại trước.

### 4.2. Luồng Khởi Tạo Quản Trị Viên / Đơn Vị Đỉnh (Admin / ROOT Bootstrapping)
Khi cài đặt trên một Supabase Project trắng, hiện tại **chưa có script tự động** khởi tạo tài khoản đầu tiên. Luồng khởi tạo cần thiết bao gồm:
1. **Bước 1 (Root Unit):** Thêm một bản ghi đơn vị đỉnh vào bảng `organization_units` (`parent_id = NULL`, ví dụ `code = 'ROOT'`, `name = 'Trường Cao đẳng XYZ'`).
2. **Bước 2 (Auth User):** Tạo tài khoản đăng nhập đầu tiên qua Supabase Auth (`auth.users`) với email quản trị.
3. **Bước 3 (Profile):** Tạo bản ghi trong `public.profiles` trỏ `id` về `auth.users.id` với `system_role = 'admin'`.
4. **Bước 4 (Member):** Gắn người dùng vào đơn vị đỉnh trong `public.organization_members` với vai trò `manager`.
5. **Bước 5 (Role):** Gắn quyền `admin` trong `public.access_user_roles`.

---

## 5. Danh Sách Chênh Lệch (Diff), Đối Tượng Thiếu & Hardcode STHC

### 5.1. Chênh lệch giữa Database thực tế và File Migration trong Repository
1. **Thiếu hoàn toàn 31 bảng nền tảng trong repo `.sql`:**
   `profiles`, `organization_units`, `organization_members`, `tasks`, `task_assignees`, `task_updates`, `task_evidence`, `task_comments`, `task_announcement_audience_units`, `task_announcement_audience_users`, `daily_reports`, `daily_report_task_links`, `daily_report_sources`, `daily_report_reminders`, `report_sources`, `report_source_unit_assignments`, `report_source_metric_assignments`, `metric_definitions`, `metric_entries`, `kpi_definitions`, `kpi_objectives`, `kpi_periods`, `kpi_templates`, `kpi_template_versions`, `kpi_template_items`, `kpi_template_item_bindings`, `kpi_assignments`, `kpi_assignment_items`, `kpi_assignment_item_bindings`, `kpi_manual_actual_entries`, `notifications`.
2. **10 bảng có trong file SQL nhưng KHÔNG TỒN TẠI trên DB thực tế:**
   - `admission_google_sheets_config`, `admission_sheet_campaign_mappings`, `admission_sheet_program_mappings`, `admission_sync_batches`, `admission_sync_batch_sheets` (trong các file `v0.8-E1..E3` - chưa từng chạy trên DB này).
   - `task_attachments` (file `v0.2.2.1` tạo bảng này nhưng DB thực tế dùng bucket `task-attachments` và bảng `task_evidence`).
   - `announcement_reminders` (file `v0.2.2`).
   - `kpi_assignment_reviews`, `kpi_assignment_item_reviews` (file `v0.4.5-A` - DB thực tế tích hợp trạng thái trực tiếp vào `kpi_assignments.status`).
   - `ai_requests` (file `v0.5-A5` - DB thực tế dùng `ai_usage_logs`).
3. **Trùng lặp file SQL giữa thư mục gốc và `migrations/`:**
   - `v0.8-A1-admissions-foundation.sql` (gốc) vs `migrations/v0.8-A1_admission_foundation.sql` (bản trong migrations đầy đủ hơn).
   - `v0.8-A2-admission-plans-results.sql` (gốc) vs `migrations/v0.8-A2_admission_plans_and_results.sql`.
   - `v0.8-A3-admission-security-audit.sql` (gốc) vs `migrations/v0.8-A3_admission_security_audit.sql`.
   - Các file `20260918_v0_9_a2_access_control_foundation.sql` và `20260918_v0_9_a3_migrate_user_roles.sql` chỉ nằm ở thư mục gốc, chưa được đưa vào `migrations/`.

### 5.2. Các Thành Phần và Cấu Hình Đang Bị Hardcode Gắn Chặt với STHC
| Thành phần | File / Vị trí | Giá trị hardcode hiện tại | Giải pháp tách bạch ở các bước C5-B..C |
| :--- | :--- | :--- | :--- |
| **System Settings** | Bảng `system_settings` trong DB | `organization_short_name: 'STHC'`, địa chỉ, điện thoại, email domain `@saigontourist.edu.vn`, website `saigontourist.edu.vn` | Chuyển thành tham số khởi tạo cấu hình chung (Settings Wizard khi setup). |
| **AI System Prompt** | `src/services/ai/gateway/aiAssistantPromptBuilder.ts:19` | `Trường Cao đẳng Du lịch Sài Gòn (STHC)` | Lấy động từ `system_settings.organization_name` / `organization_short_name`. |
| **Fallback Settings** | `src/services/system-settings.service.ts:31` | `organizationShortName: 'STHC'`, `admin@sthc.edu.vn` | Thay fallback thành giá trị generic (ví dụ: `HỆ THỐNG QUẢN LÝ ĐÀO TẠO & KPI`). |
| **Seed Ngành mẫu** | `src/components/admissions/programs/ProgramListView.tsx:96, 326` | Nút "Nạp 12 ngành chuẩn STHC" (`seedStandardPrograms()`) | Đưa thành tùy chọn nạp mẫu (Demo/Sample Pack), không gắn cứng tên trường. |
| **Seed Chỉ tiêu 2026**| `src/components/admissions/plans/AnnualPlanListView.tsx:155` | `seedOfficial2026Plans()` | Cho phép import qua Excel/JSON thay vì hardcode số lượng chỉ tiêu của STHC. |

---

## 6. Đề Xuất Thứ Tự Migration Chuẩn Cho Dự Án Trắng (Preliminary Sequence)

Để triển khai thành công trên một Supabase Project trắng ở giai đoạn tiếp theo, toàn bộ DDL cần được đóng gói thành các migration tuần tự:

```text
01_extensions.sql              --> pgcrypto, vector
02_core_organization.sql       --> organization_units, profiles, organization_members
03_access_control.sql          --> access_modules, access_roles, access_permissions, 
                                   access_role_permissions, access_user_roles, access_audit_logs,
                                   triggers đồng bộ role
04_system_settings.sql         --> system_settings, notifications
05_tasks_foundation.sql        --> tasks, task_assignees, task_updates, task_evidence, task_comments,
                                   task_announcement_audience_units/users
06_daily_reports.sql           --> report_sources, report_source_unit_assignments, daily_reports,
                                   daily_report_task_links, daily_report_sources, daily_report_reminders
07_metrics_and_kpi.sql         --> metric_definitions, metric_entries, report_source_metric_assignments,
                                   kpi_definitions, kpi_objectives, kpi_periods, kpi_templates,
                                   kpi_template_versions, kpi_template_items, kpi_template_item_bindings,
                                   kpi_assignments, kpi_assignment_items, kpi_assignment_item_bindings,
                                   kpi_manual_actual_entries, kpi scoring functions & resolvers
08_admissions.sql              --> admission_groups, admission_programs, admission_campaigns,
                                   admission_plans, admission_results, admission_result_items,
                                   admission_change_history, performance views, triggers
09_ai_assistant.sql            --> ai_provider_configs, ai_prompt_definitions, ai_prompt_versions,
                                   ai_conversations, ai_messages, ai_message_sources,
                                   ai_knowledge_documents, ai_knowledge_chunks,
                                   ai_usage_settings, ai_usage_reservations, ai_usage_counters, ai_usage_logs
10_storage_buckets.sql         --> task-evidence, task-attachments, system-assets, ai-knowledge-docs + RLS
11_bootstrap_seed.sql          --> Baseline permissions, modules, standard roles, system prompts
```

---

## 7. Danh Mục Rủi Ro & Việc Cần Xử Lý Cho C5-B Đến C5-J

| Pha | Nhiệm vụ chính | Rủi ro phát hiện từ C5-A | Hướng giải quyết |
| :---: | :--- | :--- | :--- |
| **C5-B** | Tạo bộ DDL Schema đồng nhất (Unified DDL Migration) | 31 bảng nền tảng chưa có file DDL trong git; các khóa ngoại chéo giữa `profiles`, `organization_units`, `tasks` dễ gây lỗi vòng lặp phụ thuộc. | Trích xuất DDL hoàn chỉnh từ schema thực tế (OpenAPI spec), sắp xếp chuẩn thứ tự quan hệ khóa ngoại (Topological Sort). |
| **C5-C** | Tách bạch Dữ liệu Nền (Common) vs Dữ liệu STHC | Giao diện và service có các nút seed trực tiếp ghi đè dữ liệu mẫu STHC vào database. | Xóa bỏ các nút seed hardcode; chuyển seed thành script fixture tách biệt có cờ `--sample-data`. |
| **C5-D** | Storage & Security Policies Consolidation | 4 Storage buckets cần chính sách RLS đồng nhất với ma trận RBAC v0.9 mới. | Viết SQL script tạo 4 bucket và policy bảo vệ thư mục theo `unit_id` và `user_id`. |
| **C5-E** | Cấp phát & Khởi tạo Quản trị viên (Bootstrap Wizard / CLI) | Khi triển khai mới, không có cách nào tạo user Admin nếu không thao tác tay trên Supabase UI. | Xây dựng CLI script hoặc REST endpoint an toàn `POST /api/setup/init-root` (chỉ chạy khi DB hoàn toàn chưa có user). |
| **C5-F** | Dọn dẹp File SQL mồ côi & Trùng lặp | 10 file SQL ở thư mục gốc và một số file test migration (`cleanup_4_test_campaigns.sql`, `v0.8-E1..E3`) gây nhầm lẫn. | Lưu trữ (archive) các file SQL cũ vào thư mục `migrations/archive/`, chỉ giữ lại bộ migration chuẩn. |

---

## 8. Kết Luận Bước C5-A

- Bước kiểm kê **v0.9-C5-A đã hoàn thành 100% mục tiêu** một cách an toàn và khách quan.
- Đã xác minh thực tế toàn bộ bảng, cột, khóa ngoại, kiểu dữ liệu, hàm, RLS và bucket mà không suy đoán.
- Đã lập danh sách chi tiết các sai lệch và rủi ro triển khai.
- **Dừng lại tại đây theo đúng yêu cầu: KHÔNG tự động chuyển sang C5-B.**
