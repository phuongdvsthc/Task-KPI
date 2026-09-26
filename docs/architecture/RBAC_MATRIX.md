# MA TRẬN PHÂN QUYỀN RBAC & PHẠM VI DỮ LIỆU (RBAC MATRIX)

Hệ thống áp dụng mô hình phân quyền dựa trên vai trò (Role-Based Access Control - RBAC) kết hợp với kiểm soát phạm vi dữ liệu (Data Scoping).

---

## 1. Các Vai trò Hệ thống (System Roles)

| Mã vai trò | Tên vai trò | Đối tượng áp dụng | Phạm vi dữ liệu mặc định (`DataScope`) |
| :--- | :--- | :--- | :--- |
| `executive` | Ban Giám hiệu | Hiệu trưởng, Phó Hiệu trưởng, Ban Lãnh đạo | **`ALL`** (Toàn trường, chế độ chỉ đọc / giám sát) |
| `admin` | Quản trị viên | Quản trị hệ thống, Trưởng phòng CNTT | **`ALL`** (Toàn quyền quản trị kỹ thuật & cấu hình) |
| `manager` | Quản lý Đơn vị | Trưởng/Phó Khoa, Trưởng/Phó Phòng ban | **`UNIT`** (Đơn vị phụ trách & các đơn vị trực thuộc) |
| `staff` | Giảng viên / Nhân viên | Cán bộ, Giảng viên, Chuyên viên | **`PERSONAL`** (Cá nhân hoặc công việc được giao) |

---

## 2. Ma trận Quyền hạn theo Module (Role-to-Module Capability Matrix)

*Ký hiệu: `C` (Create - Tạo), `R` (Read - Xem), `U` (Update - Cập nhật), `D` (Delete - Xóa), `A` (Approve - Duyệt), `-` (Không có quyền).*

| Module / Tính năng | Executive (BGH) | Admin (Quản trị) | Manager (Trưởng đơn vị) | Staff (Nhân viên) |
| :--- | :---: | :---: | :---: | :---: |
| **Dashboard Tổng quan** | `R (Toàn trường)` | `R (Hệ thống)` | `R (Đơn vị)` | `R (Cá nhân)` |
| **So sánh Chéo Đơn vị** | `R` | `R` | `-` | `-` |
| **Quản lý Đơn vị (`units`)** | `R` | `C, R, U, D` | `R (Đơn vị mình)` | `R (Đơn vị mình)` |
| **Quản lý Người dùng (`profiles`)** | `R` | `C, R, U, D` | `R (Nhân viên đơn vị)` | `R (Bản thân)` |
| **Quản lý Công việc (`tasks`)** | `R` | `C, R, U, D` | `C, R, U, D (Đơn vị)` | `C, R, U (Được giao/Tạo)` |
| **Duyệt Minh chứng Công việc** | `R` | `A` | `A (Đơn vị)` | `-` |
| **Báo cáo Hằng ngày (`daily_reports`)** | `R (Toàn trường)` | `R` | `R, A (Đơn vị)` | `C, R, U (Cá nhân)` |
| **Gửi Nhắc nhở Báo cáo** | `-` | `C` | `C (Nhân viên đơn vị)` | `-` |
| **Cấu hình Chỉ số KPI (`kpi_definitions`)** | `R` | `C, R, U, D` | `R` | `R` |
| **Chu kỳ Đánh giá KPI (`kpi_periods`)** | `R` | `C, R, U, D` | `R` | `R` |
| **Giao Chỉ tiêu KPI (`kpi_assignments`)** | `R` | `C, R, U, D` | `C, R, U (Đơn vị)` | `R (Cá nhân)` |
| **Chấm điểm & Duyệt KPI** | `R` | `A` | `A (Đơn vị)` | `U (Tự đánh giá)` |
| **Tổng quan Tuyển sinh (`/admissions/overview`)**| `R (Toàn trường)` | `R (Toàn trường)` | `R (Đơn vị phụ trách)` | `R (Đơn vị phụ trách)` |
| **Đợt tuyển sinh (`admission_campaigns`)** | `R` | `C, R, U, D` | `C, R, U (Đơn vị)` | `R` |
| **Kế hoạch Tuyển sinh (`admission_plans`)** | `R` | `C, R, U, D` | `C, R, U (Đơn vị)` | `R` |
| **Nhập Kết quả Tuyển sinh (`admission_results`)** | `R` | `C, R, U, D` | `C, R, U (Đơn vị)` | `C, R, U (Được phân công)`|
| **Lịch sử Kiểm toán Tuyển sinh** | `R` | `R` | `R (Đơn vị)` | `-` |
| **Trợ lý AI (Hỏi đáp & Tóm tắt)** | `R, C` | `R, C` | `R, C` | `R, C` |
| **Quản trị Tri thức AI (`knowledge`)** | `R` | `C, R, U, D` | `-` | `-` |
| **Cấu hình Hệ thống & Phân quyền** | `-` | `C, R, U, D` | `-` | `-` |

---

## 3. Cơ chế Thực thi Phân quyền (Enforcement Mechanism)

1. **Frontend Route Guard (`src/routes/RouteGuard.tsx`)**:
   - Kiểm tra `systemRole` và quyền `capabilities` trước khi cho phép người dùng nạp component trang.
   - Chuyển hướng người dùng về trang `/access-denied` nếu không đủ quyền.
2. **Backend API Authorization Middleware (`server/authorization/`)**:
   - `authenticateUser`: Giải mã JWT token và nạp `profiles` từ Supabase.
   - `requirePermission(...)` / `requireCapability(...)`: Kiểm tra mã quyền hạn trước khi chuyển tiếp vào controller.
   - `resolveDataScope(...)`: Gắn phạm vi `req.dataScope` (`ALL`, `UNIT`, `PERSONAL`, `NONE`) vào request.
   - `applyScopeToQuery(...)`: Áp dụng bộ lọc `unit_id = ...` hoặc `assignee_id = ...` trực tiếp vào câu lệnh SQL PostgreSQL.
3. **Database Row Level Security (RLS)**:
   - Các bảng trong cơ sở dữ liệu Supabase được bảo vệ bởi chính sách RLS dựa trên `auth.uid()`.
