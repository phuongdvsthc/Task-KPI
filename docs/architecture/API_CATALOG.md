# DANH MỤC API HỆ THỐNG (API CATALOG)

Tài liệu này tổng hợp toàn bộ các API endpoint đang hoạt động trong hệ thống, kèm phương thức HTTP, yêu cầu xác thực, quyền hạn RBAC và chức năng.

---

## 1. Xác thực & Hồ sơ Cá nhân (Authentication & Profile)

| Phương thức | Endpoint | Middleware / Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Công khai | Đăng nhập hệ thống bằng email và mật khẩu. |
| `POST` | `/api/auth/update-password` | `authenticateUser` | Đổi mật khẩu tài khoản người dùng hiện tại. |
| `GET` | `/api/profile/me` | `authenticateUser` | Lấy thông tin chi tiết hồ sơ tài khoản đang đăng nhập. |
| `PUT` | `/api/profile/me` | `authenticateUser` | Cập nhật thông tin cá nhân (họ tên, số điện thoại, ảnh đại diện). |
| `GET` | `/api/auth/me` | `authenticateUser` | Trả về vai trò, đơn vị chính và danh mục quyền năng lực RBAC (`accessMeApi`). |

---

## 2. Dashboard & Tổng hợp Số liệu (Dashboard Analytics)

| Phương thức | Endpoint | Middleware / Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/reporting-options` | `authenticateUser` | Lấy danh sách chu kỳ báo cáo, đơn vị và nhân viên theo quyền. |
| `GET` | `/api/dashboard/reporting-scope` | `authenticateUser` | Trả về phạm vi dữ liệu báo cáo của tài khoản. |
| `GET` | `/api/dashboard/executive-trends` | `authenticateUser` | Dữ liệu xu hướng hiệu suất toàn trường theo thời gian (Executive). |
| `GET` | `/api/dashboard/unit-comparison` | `authenticateUser` | So sánh chéo tỷ lệ hoàn thành công việc và điểm KPI giữa các đơn vị. |
| `GET` | `/api/dashboard/team-monitoring` | `authenticateUser` | Giám sát tình trạng nộp báo cáo và tiến độ của nhân viên trong đơn vị (Manager). |
| `GET` | `/api/admin/dashboard-summary` | `dashboard.admin.view` | Tổng hợp số liệu vận hành hệ thống, người dùng, nhật ký (Admin). |

---

## 3. Cơ cấu Tổ chức & Quản trị Người dùng (Organizations & Users)

| Phương thức | Endpoint | Middleware / Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/organization-units` | `user_org.units.view` | Lấy danh sách cây phòng ban/đơn vị tổ chức. |
| `POST` | `/api/admin/organization-units` | `user_org.units.manage` | Tạo mới đơn vị phòng ban. |
| `PUT` | `/api/admin/organization-units/:id` | `user_org.units.manage` | Cập nhật thông tin đơn vị phòng ban. |
| `DELETE`| `/api/admin/organization-units/:id` | `user_org.units.manage` | Xóa đơn vị (kiểm tra ràng buộc nhân sự trước khi xóa). |
| `GET` | `/api/admin/users` | `user_org.users.view` | Danh sách tài khoản người dùng theo phân trang và bộ lọc đơn vị. |
| `POST` | `/api/admin/users` | `user_org.users.manage` | Tạo mới tài khoản người dùng. |
| `PUT` | `/api/admin/users/:id` | `user_org.users.manage` | Cập nhật thông tin tài khoản, đơn vị và vai trò. |
| `DELETE`| `/api/admin/users/:id` | `user_org.users.manage` | Vô hiệu hóa hoặc xóa tài khoản người dùng. |
| `POST` | `/api/admin/users/:id/reset-password`| `user_org.users.manage` | Đặt lại mật khẩu tài khoản người dùng. |

---

## 4. Quản lý Công việc & Thông báo (Tasks & Announcements)

| Phương thức | Endpoint | Middleware / Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tasks` | `task.view` | Lấy danh sách công việc theo bộ lọc (trạng thái, người nhận, hạn chót). |
| `POST` | `/api/tasks` | `task.create` | Tạo mới nhiệm vụ/công việc. |
| `PUT` | `/api/tasks/:id` | `task.update` | Cập nhật nội dung, hạn chót, trạng thái công việc. |
| `DELETE`| `/api/tasks/:id` | `task.delete` | Xóa nhiệm vụ/công việc. |
| `GET` | `/api/tasks/:taskId/attachments` | `task.view` | Lấy danh sách tệp đính kèm của công việc. |
| `POST` | `/api/tasks/:taskId/attachments` | `task.update` | Tải lên tệp đính kèm mới. |
| `DELETE`| `/api/tasks/:taskId/attachments/:id` | `task.update` | Xóa tệp đính kèm. |
| `POST` | `/api/announcements` | `task.create` | Đăng thông báo/chỉ đạo điều hành toàn đơn vị/trường. |
| `POST` | `/api/announcements/:id/acknowledge` | `task.view` | Xác nhận đã đọc/tiếp nhận thông báo. |
| `GET` | `/api/announcements/:id/delivery` | `task.view` | Thống kê tỷ lệ đã xem/xác nhận thông báo. |

---

## 5. Báo cáo Hằng ngày (Daily Reports)

| Phương thức | Endpoint | Middleware / Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/daily-reports` | `daily_report.view` | Lấy danh sách báo cáo ngày theo thời gian và người lập. |
| `POST` | `/api/daily-reports` | `daily_report.create` | Tạo mới hoặc cập nhật bản nháp báo cáo ngày. |
| `POST` | `/api/daily-reports/:id/submit` | `daily_report.create` | Nộp chính thức báo cáo ngày. |
| `POST` | `/api/daily-reports/:id/review` | `daily_report.review` | Quản lý đánh giá/duyệt báo cáo ngày của nhân viên. |
| `POST` | `/api/daily-reports/remind` | `daily_report.remind` | Gửi thông báo nhắc nhở nhân viên nộp báo cáo còn thiếu. |

---

## 6. Quản lý Hiệu suất KPI (KPI Management)

| Phương thức | Endpoint | Middleware / Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/kpis/definitions` | `kpi.definitions.view` | Danh mục các chỉ số KPI chuẩn trong hệ thống. |
| `POST` | `/api/kpis/definitions` | `kpi.definitions.manage` | Tạo mới định nghĩa chỉ số KPI. |
| `GET` | `/api/kpis/periods` | `kpi.periods.view` | Danh sách các chu kỳ đánh giá KPI (tháng, quý, năm). |
| `GET` | `/api/kpis/assignments` | `kpi.assignments.view` | Danh sách giao chỉ tiêu KPI cho đơn vị/cá nhân. |
| `POST` | `/api/kpis/assignments` | `kpi.assignments.manage` | Giao chỉ tiêu KPI mới hoặc phân bổ trọng số. |
| `POST` | `/api/kpis/assessments/self` | `kpi.assessments.self` | Nhân viên tự chấm điểm và gửi minh chứng KPI. |
| `POST` | `/api/kpis/assessments/review` | `kpi.assessments.review` | Quản lý/Hội đồng chấm điểm và phê duyệt kết quả KPI. |

---

## 7. Phân hệ Tuyển sinh (Admissions Module)

| Phương thức | Endpoint | Middleware / Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admissions/dashboard` | `admissions.dashboard.view` | Dữ liệu Tổng quan tuyển sinh (KPI, biểu đồ, `lastUpdatedAt`). |
| `GET` | `/api/admissions/groups` | `admissions.groups.view` | Danh sách nhóm tuyển sinh (Trung cấp, Ngắn hạn...). |
| `GET` | `/api/admissions/programs` | `admissions.programs.view` | Danh sách ngành nghề/chương trình đào tạo. |
| `POST` | `/api/admissions/programs` | `admissions.programs.manage` | Tạo mới ngành đào tạo tuyển sinh. |
| `GET` | `/api/admissions/campaigns` | `admissions.campaigns.view` | Danh sách đợt tuyển sinh theo năm và trạng thái. |
| `POST` | `/api/admissions/campaigns` | `admissions.campaigns.manage` | Tạo mới đợt tuyển sinh. |
| `PUT` | `/api/admissions/campaigns/:id` | `admissions.campaigns.manage` | Cập nhật đợt tuyển sinh. |
| `GET` | `/api/admissions/plans` | `admissions.plans.view` | Kế hoạch và chỉ tiêu tuyển sinh theo đợt/ngành. |
| `POST` | `/api/admissions/plans` | `admissions.plans.manage` | Tạo mới hoặc cập nhật chỉ tiêu tuyển sinh. |
| `GET` | `/api/admissions/results` | `admissions.results.view` | Kết quả tuyển sinh (hồ sơ, trúng tuyển, nhập học). |
| `POST` | `/api/admissions/results` | `admissions.results.manage` | Nhập hoặc chốt (`finalize`) kết quả tuyển sinh. |
| `GET` | `/api/admissions/change-history` | `admissions.audit.view` | Nhật ký kiểm toán các thay đổi trong phân hệ tuyển sinh. |
| `POST` | `/api/admissions/sync/google-sheets` | `admissions.sync.manage` | Đồng bộ dữ liệu tuyển sinh từ Google Sheets. |

---

## 8. Trợ lý AI & Tri thức (AI Assistant & Knowledge)

| Phương thức | Endpoint | Middleware / Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/chat` | `ai.assistant.use` | Gửi câu hỏi cho Trợ lý AI Gemini và nhận câu trả lời phân tích. |
| `POST` | `/api/ai/summarize-daily-reports`| `ai.assistant.use` | AI tóm tắt tổng hợp báo cáo ngày của đơn vị. |
| `POST` | `/api/ai/generate-kpi-suggestions`| `ai.assistant.use` | AI đề xuất chỉ tiêu và phân bổ KPI. |
| `GET` | `/api/ai/knowledge/documents` | `system.settings.view` | Danh sách tài liệu tri thức cơ sở trong hệ thống RAG. |
| `POST` | `/api/ai/knowledge/documents` | `system.settings.manage` | Tải lên tài liệu quy chế/hướng dẫn làm tri thức cho AI. |
| `DELETE`| `/api/ai/knowledge/documents/:id`| `system.settings.manage` | Xóa tài liệu tri thức. |
| `GET` | `/api/admin/ai/usage` | `system.settings.view` | Thống kê số lượng token và lượt gọi API Gemini AI. |

---

## 9. Quản trị Hệ thống & Phân quyền (System Admin & RBAC)

| Phương thức | Endpoint | Middleware / Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/rbac/matrix` | `system.rbac.view` | Ma trận quyền hạn chi tiết giữa các vai trò và năng lực. |
| `PUT` | `/api/rbac/matrix` | `system.rbac.manage` | Cập nhật cấu hình phân quyền năng lực cho từng vai trò. |
| `GET` | `/api/admin/settings` | `system.settings.view` | Xem danh mục cấu hình hệ thống (năm học, thông tin trường). |
| `PUT` | `/api/admin/settings` | `system.settings.manage` | Cập nhật cấu hình hệ thống. |
| `GET` | `/api/admin/audit-logs` | `system.audit.view` | Nhật ký kiểm toán toàn hệ thống. |
| `GET` | `/api/health` | Công khai | Kiểm tra tình trạng hoạt động của API Gateway (Liveness probe). |
