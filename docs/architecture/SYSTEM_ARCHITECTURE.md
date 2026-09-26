# KIẾN TRÚC HỆ THỐNG TỔNG QUAN (SYSTEM ARCHITECTURE)

Hệ thống **Work + KPI Management System** (Trường Cao đẳng Du lịch Sài Gòn - STHC) là giải pháp quản trị điều hành đại học/cao đẳng toàn diện, tích hợp quản trị công việc, báo cáo định kỳ, đánh giá hiệu suất KPI, phân hệ tuyển sinh và trợ lý trí tuệ nhân tạo (AI Assistant).

---

## 1. Ngăn xếp Công nghệ (Technology Stack)

```
+-------------------------------------------------------------------------+
|                              FRONTEND LAYER                             |
|  - React 18 SPA (TypeScript, Vite)                                      |
|  - Tailwind CSS + Lucide Icons                                          |
|  - Recharts (Biểu đồ trực quan hóa dữ liệu Dashboard & Tuyển sinh)      |
|  - React Router DOM v6 (HashRouter / BrowserRouter với Route Guards)    |
+-------------------------------------------------------------------------+
                                    │ (REST / JSON / Bearer Auth)
                                    ▼
+-------------------------------------------------------------------------+
|                           SERVER & PROXY LAYER                          |
|  - Node.js Runtime (Express, TypeScript / tsx)                          |
|  - Vite Middlewares (Tích hợp Dev Server SPA)                           |
|  - Middleware phân quyền RBAC đa lớp (requirePermission, Data Scope)    |
|  - Google Gemini AI SDK (@google/genai & Server-side Proxy)             |
|  - Google Sheets API / ExcelJS (Xử lý đồng bộ & xuất nhập dữ liệu)      |
+-------------------------------------------------------------------------+
                                    │ (PostgreSQL Driver / PostgREST)
                                    ▼
+-------------------------------------------------------------------------+
|                            PERSISTENCE LAYER                            |
|  - Supabase PostgreSQL (Row Level Security - RLS)                       |
|  - Supabase Auth (JWT Bearer Token, Role Metadata)                      |
|  - Supabase Storage (Lưu trữ tệp đính kèm công việc & tài liệu AI)      |
|  - Database Triggers (Lịch sử kiểm toán thay đổi & Cập nhật chỉ số)     |
+-------------------------------------------------------------------------+
```

---

## 2. Mô hình Kiến trúc Phân tầng (Layered Architecture)

### 2.1. Tầng Giao diện (Presentation Layer - Frontend)
- **Vị trí**: `src/components/`, `src/routes/`, `src/context/`
- **Đặc điểm**:
  - Quản lý phiên làm việc thông qua `AuthContext` (trạng thái đăng nhập, hồ sơ người dùng, quyền hạn hệ thống).
  - Điều hướng an toàn bằng `RouteGuard.tsx` và `routeMetadata.ts` (kiểm tra vai trò và năng lực trước khi render).
  - Tối ưu hóa hiển thị theo 4 vai trò chính: **Executive (Ban Giám hiệu)**, **Admin (Quản trị viên)**, **Manager (Trưởng đơn vị)**, **Staff (Giảng viên / Nhân viên)**.

### 2.2. Tầng Dịch vụ Frontend (Client Service Layer)
- **Vị trí**: `src/services/`
- **Đặc điểm**:
  - Đóng gói các hàm gọi API REST backend hoặc gọi trực tiếp Supabase Client với các bảng cho phép RLS an toàn.
  - Các service tiêu biểu: `admissionDashboardService.ts`, `admissionFoundationService.ts`, `taskService.ts`, `dailyReportService.ts`, `kpiService.ts`, `aiService.ts`, `organizationService.ts`.

### 2.3. Tầng Máy chủ Ứng dụng (Application Server Layer)
- **Vị trí**: `server.ts`, `server/authorization/`, `server/admissions/`
- **Đặc điểm**:
  - Express Server đóng vai trò API Gateway, Security Proxy và Data Aggregation Engine.
  - Xác thực JWT Token từ Supabase Auth qua middleware `authenticateUser`.
  - Kiểm soát phạm vi dữ liệu (`DataScope`: `ALL`, `UNIT`, `PERSONAL`, `NONE`) dựa trên cấu trúc tổ chức của người dùng.
  - Proxy an toàn cho Gemini AI API (không để lộ API key phía client).

### 2.4. Tầng Dữ liệu (Persistence Layer - Database)
- **Vị trí**: Supabase PostgreSQL
- **Đặc điểm**:
  - Thực thi bảo mật cấp hàng (Row Level Security - RLS).
  - Ràng buộc khóa ngoại nghiêm ngặt giữa các bảng dữ liệu thực thể.
  - Bảng ghi nhật ký kiểm toán (`admission_change_history`, `audit_logs`) theo dõi mọi thay đổi dữ liệu trọng yếu.

---

## 3. Các Phân hệ Chức năng Chính (Core Modules)

1. **Dashboard & Điều hành (`/dashboard`, `/executive`, `/manager`, `/staff`, `/admin`)**: Tổng hợp chỉ số KPI, tỷ lệ nộp báo cáo, tiến độ công việc, so sánh chéo đơn vị.
2. **Cơ cấu Tổ chức & Người dùng (`/admin/organizations`, `/admin/users`)**: Quản lý cây đơn vị/phòng ban, danh sách nhân sự, chức vụ và gán quyền.
3. **Quản lý Công việc (`/tasks`)**: Giao việc, theo dõi tiến độ, Kanban/List/Gantt, minh chứng hoàn thành, bình luận, phân quyền theo đơn vị.
4. **Báo cáo Hằng ngày (`/daily-reports`)**: Nhập báo cáo ngày, trích xuất dữ liệu công việc tự động, duyệt báo cáo, nhắc nhở thiếu báo cáo.
5. **Đánh giá Hiệu suất KPI (`/kpis`)**: Danh mục chỉ số, chu kỳ đánh giá, giao chỉ tiêu KPI, chấm điểm tự động/thủ công, duyệt kết quả.
6. **Quản lý Tuyển sinh (`/admissions`)**: Tổng quan điều hành tuyển sinh, danh mục nhóm/ngành, chu kỳ đợt tuyển sinh, kế hoạch chỉ tiêu, kết quả thực tế, đồng bộ Google Sheets, lịch sử kiểm toán.
7. **Trợ lý Trí tuệ Nhân tạo (`/ai`)**: Tương tác hỏi đáp chính sách, tóm tắt công việc, hỗ trợ tạo chỉ tiêu và phân tích dữ liệu tuyển sinh.
8. **Quản trị & Hệ thống (`/admin/settings`, `/admin/access-control`)**: Cấu hình hệ thống, kho prompt AI, quản trị vai trò và ma trận năng lực RBAC.

---

## 4. Tích hợp Ngoại vi (External Integrations)

| Dịch vụ tích hợp | Mục đích sử dụng | Cơ chế kết nối |
| :--- | :--- | :--- |
| **Supabase Auth** | Xác thực người dùng, cấp phát và xác thực JWT Bearer token | Supabase JS Client & Auth Admin API |
| **Supabase Storage** | Lưu trữ tệp đính kèm công việc, tài liệu tri thức AI, ảnh đại diện | Supabase Storage Bucket API |
| **Google Gemini AI** | Phân tích báo cáo, sinh đề xuất KPI, tư vấn tuyển sinh và Chatbot | Server-side Gemini API Proxy (`@google/genai`) |
| **Google Sheets API** | Nhập/xuất dữ liệu chỉ tiêu và kết quả tuyển sinh định kỳ | OAuth 2.0 Client / Server Proxy |
| **ExcelJS** | Xuất báo cáo thống kê, danh sách công việc, kết quả KPI ra định dạng `.xlsx` | Xử lý trực tiếp phía Server/Client |
