# C5-A Data Foundation & Isolation Inventory
> **Phiên bản:** v0.9-C5-A Readiness | **Ngày kiểm kê:** 25/09/2026  
> **Mục đích:** Danh mục đầu vào chi tiết phục vụ rà soát, cô lập và chuẩn hóa dữ liệu nền (Data Foundation, STHC configuration, Root units, Seed logic, Test fixtures & Standalone scripts).  
> **Nguyên tắc:** Chỉ kiểm kê và đánh giá hiện trạng, **không thực hiện xóa/chạy lệnh ghi dữ liệu trên Supabase**.

---

## 1. Cấu hình gắn với Nhận diện STHC (`system_settings` & Defaults)

### 1.1. Dữ liệu thực tế trong bảng `system_settings` (Supabase DB)
| Khóa cấu hình (`setting_key`) | Giá trị thực tế (`setting_value`) | Phạm vi (`is_public`) | Nhóm |
| :--- | :--- | :---: | :--- |
| `app_name` | `Task & KPI Report` | Public | General |
| `organization_short_name` | `STHC` | Public | General |
| `organization_address` | `23/8 Hoàng Việt, Phường Tân Sơn Nhất, TP. HCM` | Public | General |
| `organization_phone` | `1800558827` | Public | General |
| `organization_email` | `admin@saigontourist.edu.vn` | Public | General |
| `organization_website` | `https://saigontourist.edu.vn` | Public | General |
| `locale` | `vi-VN` | Public | General |
| `timezone` | `Asia/Ho_Chi_Minh` | Public | General |
| `date_format` | `dd/MM/yyyy` | Public | General |
| `appearance_mode` | `dark` | Public | General |
| `appearance_accent` | `indigo` | Public | General |
| `logo_path` | `branding/logo/...` | Public | General |
| `logo_small_path` | `branding/logo-small/...` | Public | General |
| `favicon_path` | `branding/favicon/...` | Public | General |
| `ai_global_config` | `{"provider":"openai","enabled":true}` | Private | AI |

### 1.2. Fallback Code chứa nhận diện STHC
- `src/services/ai/gateway/aiAssistantPromptBuilder.ts`:
  - `const org = options?.organizationName || 'Trường Cao đẳng Du lịch Sài Gòn (STHC)';`
- `src/services/system-settings.service.ts`:
  - Default object: `organizationShortName: 'STHC'`, `appName: 'Task & KPI Report'`, `organizationEmail: 'admin@sthc.edu.vn'`.

---

## 2. Mã ROOT và Cây Đơn vị Cơ cấu Tổ chức (`organization_units`)

### 2.1. Đơn vị Root và các phòng ban trực thuộc hiện có
| ID Đơn vị (UUID) | Mã đơn vị (`code`) | Tên đơn vị (`name`) | Loại đơn vị (`unit_type`) | Đơn vị cha (`parent_id`) |
| :--- | :--- | :--- | :--- | :--- |
| `7afdccfd-4e25-434f-afba-e54b0652aa1f` | **`STHC`** | **Trường Saigontourist** | `school` | `NULL` (ROOT cao nhất) |
| *(Phòng ban con)* | **`HCNS`** | Phòng Hành chính nhân sự | `department` | `7afdccfd-4e25-434f-afba-e54b0652aa1f` |
| *(Phòng ban con)* | **`TT-HTQT`** | Phòng Truyền thông và HTQT | `department` | `7afdccfd-4e25-434f-afba-e54b0652aa1f` |

### 2.2. Nhận diện các liên kết với ROOT / STHC
- Đơn vị ROOT (`STHC`) đóng vai trò là đỉnh của cây phân cấp hành chính.
- Các người dùng thuộc quyền Ban Giám hiệu (`executive`) hoặc Ban Quản trị (`admin`) được gắn liên kết trực tiếp với đơn vị ROOT này hoặc sở hữu Data Scope `ALL`.

---

## 3. Danh mục Seed Nền (Baseline Seeds) trong Mã nguồn

| Tệp nguồn | Hàm / Biến seed | Mục đích | Nơi gọi trong UI |
| :--- | :--- | :--- | :--- |
| `src/services/admissionService.ts` | `SEEDED_ADMISSION_GROUPS` | Dữ liệu nhóm tuyển sinh fallback (TRUNG_CAP, NGAN_HAN) | Fallback khi DB mất kết nối |
| `src/services/admissionService.ts` | `SEEDED_ADMISSION_CAMPAIGNS_2026` | 13 đợt tuyển sinh benchmark 2026 | Fallback filter tính toán |
| `src/services/admissionService.ts` | `seedStandardPrograms()` | Seed 12 mã ngành chuẩn STHC (Kỹ thuật chế biến món ăn, Quản trị khách sạn,...) | `ProgramListView.tsx` (Nút `#seed-standard-sthc-btn` & `#seed-standard-sthc-empty-btn`) |
| `src/services/admissionPlanService.ts` | `seedOfficial2026Plans()` | Seed chỉ tiêu kế hoạch năm 2026 cho các ngành | `AnnualPlanListView.tsx` (Nút `#btn-seed-2026-official-plans`) |
| `src/services/ai/aiProviderConfig.service.ts` | `ensureDefaultProviderConfig()` | Khởi tạo cấu hình mặc định nhà cung cấp AI (Gemini / OpenAI) | Khi khởi tạo AI Gateway |

---

## 4. Test Fixtures và Standalone Scripts kết nối Supabase Live

### 4.1. Scripts trong thư mục `scripts/`
| Tên file script | Tính chất tác động | Trạng thái an toàn |
| :--- | :--- | :--- |
| `scripts/acceptance-test-no-spurious-test-data.ts` | **Read-Only (SELECT)**: Kiểm thử 15 chu kỳ xem dashboard / tuyển sinh, xác nhận 0 ghi dữ liệu. | An toàn tuyệt đối |
| `scripts/self-test-admission-last-updated.ts` | **Read-Only (SELECT & In-memory)**: Kiểm thử tính toán `lastUpdatedAt`. | An toàn tuyệt đối |
| `scripts/self-test-campaign-ui-clean.ts` | **Read-Only (SELECT & Source Audit)**: Kiểm thử xóa nút đồng bộ và kiểm tra API. | An toàn tuyệt đối |
| `scripts/self-test-ai-provider-audit-alignment.ts` | **Test**: Kiểm tra tính năng cấu hình AI. | Kiểm thử AI |
| `scripts/self-test-ai-usage-audit.ts` | **Test**: Kiểm tra ghi nhận log sử dụng AI. | Kiểm thử AI |
| `scripts/self-test-ai-chatbot-prompt-registry.ts`| **Test**: Kiểm tra Prompt Registry. | Kiểm thử AI |
| `scripts/self-test-root-code-update.ts` | **Test**: Kiểm tra logic đổi mã Root. | Kiểm thử Đơn vị |
| `scripts/verify_remote_supabase.cjs` | **Read-Only**: Kiểm tra kết nối Supabase remote. | An toàn |

### 4.2. Các file Migration SQL thủ công trong thư mục gốc và `migrations/`
- `migrations/cleanup_4_test_campaigns.sql`: Migration xóa 4 đợt tuyển sinh test theo transaction an toàn.
- `20260918_v0_9_a2_access_control_foundation.sql`: Migration nền móng RBAC v0.9.
- `20260918_v0_9_a3_migrate_user_roles.sql`: Migration chuyển đổi vai trò người dùng v0.9.
- `v0.8-A1-admissions-foundation.sql` đến `v0.8-A3-admission-security-audit.sql`: Các migration tạo bảng và RLS Tuyển sinh.

---

## 5. Danh mục Storage Buckets Thực tế trong Supabase

| Tên Bucket | Trạng thái Public | Mục đích lưu trữ | Bảng liên quan |
| :--- | :---: | :--- | :--- |
| **`task-evidence`** | `false` (Private) | Tệp minh chứng hoàn thành công việc (ảnh, pdf, tài liệu) | `task_evidence` |
| **`task-attachments`** | `false` (Private) | Tệp đính kèm khi giao việc / thông báo chỉ đạo | `task_attachments`, `announcements` |
| **`system-assets`** | `true` (Public) | Logo trường, logo thu nhỏ, favicon, ảnh giao diện | `system_settings` |
| **`ai-knowledge-docs`** | `false` (Private) | Tài liệu chính sách nạp vào Kho tri thức Trợ lý AI | `ai_knowledge_documents`, `ai_knowledge_chunks` |

---

## 6. Khuyến nghị cho giai đoạn C5-A

1. **Chuẩn hóa Seed Nền:** Xem xét chuyển đổi các nút Seed (`#seed-standard-sthc-btn`, `#btn-seed-2026-official-plans`) sang chế độ khởi tạo qua Migration SQL hoặc xác thực quyền nghiêm ngặt, tương tự như đã chuẩn hóa màn hình Tuyển sinh.
2. **Bảo vệ Dữ liệu Live:** Khi chạy bất kỳ script kiểm thử nào trong tương lai, duy trì nguyên tắc Mock/In-memory hoặc Read-only API assertions với Token xác thực, không chèn bản ghi rác với tiền tố `TEST_` vào Supabase live.
