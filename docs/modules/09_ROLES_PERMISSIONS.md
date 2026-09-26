# TÀI LIỆU KỸ THUẬT: PHÂN HỆ VAI TRÒ & PHÂN QUYỀN (RBAC & ACCESS CONTROL)

---

## 1. Mục đích
Phân hệ **Vai trò & Phân quyền (RBAC)** quản trị ma trận phân quyền chi tiết, xác thực định danh và kiểm soát quyền truy cập tài nguyên dữ liệu đa lớp từ Giao diện (Client Route Guard), Tầng Dịch vụ (Express Middleware) đến Cấp Dữ liệu (PostgreSQL Row Level Security).

---

## 2. Màn hình & Chức năng Thực tế

### 2.1. Quản lý Vai trò & Ma trận Quyền (`RoleManagementView.tsx`, `RolePermissionMatrix.tsx` - `/admin/access-control`)
- **Quản lý danh sách vai trò (`system_roles`)**:
  - `executive`: Ban Giám hiệu (Toàn quyền giám sát toàn trường).
  - `admin`: Quản trị viên (Toàn quyền cấu hình kỹ thuật và quản trị tài nguyên).
  - `manager`: Quản lý Đơn vị (Toàn quyền điều hành trong phạm vi đơn vị).
  - `staff`: Giảng viên / Nhân viên (Quyền thao tác với dữ liệu cá nhân).
- **Ma trận Năng lực (Capability Matrix)**:
  - Bảng trực quan hóa danh sách các năng lực hệ thống (*VD: `task.create`, `task.view`, `daily_report.review`, `kpi.assignments.manage`, `admissions.results.manage`...*).
  - Cho phép bật/tắt (toggle) các năng lực cụ thể cho từng vai trò theo chính sách bảo mật nội bộ.
  - Khôi phục ma trận về thiết lập mặc định chuẩn hệ thống (*Reset to Defaults*).

### 2.2. Kiểm soát Phạm vi Dữ liệu (Data Scoping Engine)
Hệ thống tự động phân giải phạm vi dữ liệu (`DataScope`) cho mỗi phiên người dùng:
1. **`ALL`**: Áp dụng cho `executive` và `admin` - được truy cập bản ghi của toàn trường mà không bị lọc `unit_id`.
2. **`UNIT`**: Áp dụng cho `manager` - tự động gắn bộ lọc `WHERE unit_id = user.primary_unit_id` hoặc các đơn vị trực thuộc.
3. **`PERSONAL`**: Áp dụng cho `staff` - tự động gắn bộ lọc `WHERE user_id = user.id` hoặc `assignee_id = user.id`.
4. **`NONE`**: Áp dụng khi người dùng bị khóa tài khoản hoặc không được cấp quyền.

---

## 3. Luồng Dữ liệu (Data Flow)

```
[Request from Client with Bearer Token]
       │
       ▼
[Middleware: authenticateUser (server.ts)]
       │ ➔ Giải mã JWT, nạp profile và system_role
       ▼
[Middleware: requirePermission('kpi.assignments.manage')]
       │ ➔ Kiểm tra quyền qua authorization.service.ts / rbacApi.ts
       ▼
[Service: applyScopeToQuery(query, req.dataScope, { unitColumn, userColumn })]
       │ ➔ Thêm điều kiện lọc bảo mật vào câu lệnh PostgreSQL
       ▼
[Database: Supabase PostgreSQL Execution]
```

---

## 4. Các Bảng Cơ sở Dữ liệu Liên quan

- `roles` & `system_roles`: Danh mục các vai trò trong hệ thống.
- `permissions` & `capabilities`: Danh mục các quyền năng lực chuẩn.
- `role_permissions`: Bảng liên kết ánh xạ giữa vai trò và danh sách quyền được cấp phép.
- `user_roles`: Bảng gán vai trò mở rộng cho từng tài khoản người dùng.
- `profiles`: Bảng lưu vai trò chính `system_role` và `primary_unit_id`.

---

## 5. Danh mục Năng lực Chuẩn (Canonical Capabilities)

| Nhóm chức năng | Mã năng lực (Capability) | Mô tả ngắn |
| :--- | :--- | :--- |
| **Dashboard** | `dashboard.executive.view`<br>`dashboard.manager.view`<br>`dashboard.staff.view`<br>`dashboard.admin.view` | Xem dashboard tương ứng với từng cấp độ vai trò |
| **Cơ cấu Tổ chức** | `user_org.units.view`<br>`user_org.units.manage`<br>`user_org.users.view`<br>`user_org.users.manage` | Xem và quản trị cây phòng ban, danh sách nhân sự |
| **Công việc** | `task.view`<br>`task.create`<br>`task.update`<br>`task.delete`<br>`task.assign` | Quản lý quy trình giao việc, nhận việc và duyệt hoàn thành |
| **Báo cáo Ngày** | `daily_report.view`<br>`daily_report.create`<br>`daily_report.review`<br>`daily_report.remind` | Lập, nộp, duyệt và nhắc nhở báo cáo ngày |
| **KPI** | `kpi.definitions.view`<br>`kpi.definitions.manage`<br>`kpi.periods.manage`<br>`kpi.assignments.manage`<br>`kpi.assessments.self`<br>`kpi.assessments.review` | Cấu hình, giao chỉ tiêu, tự chấm và thẩm định điểm KPI |
| **Tuyển sinh** | `admissions.dashboard.view`<br>`admissions.campaigns.manage`<br>`admissions.plans.manage`<br>`admissions.results.manage`<br>`admissions.audit.view` | Lập kế hoạch, theo dõi đợt và chốt kết quả tuyển sinh |
| **Hệ thống & AI**| `ai.assistant.use`<br>`system.settings.view`<br>`system.settings.manage`<br>`system.rbac.manage`<br>`system.audit.view` | Sử dụng Trợ lý AI và quản trị thông số, phân quyền hệ thống |

---

## 6. Tích hợp Ngoại vi & Tác vụ Nền
- **Test Guard (`testGuardApi.ts`)**: Bộ kiểm thử bảo mật tự động kiểm tra tính toàn vẹn của ma trận phân quyền và ngăn chặn rò rỉ dữ liệu giữa các đơn vị.
- **Tác vụ nền**: Không có.
