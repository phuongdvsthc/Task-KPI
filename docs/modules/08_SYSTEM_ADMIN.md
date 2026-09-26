# TÀI LIỆU KỸ THUẬT: PHÂN HỆ QUẢN TRỊ HỆ THỐNG (SYSTEM ADMIN)

---

## 1. Mục đích
Phân hệ **Quản trị Hệ thống** cung cấp các công cụ kiểm soát cấu hình chung, quản lý tham số hoạt động của nhà trường, giám sát nhật ký kiểm toán toàn diện và theo dõi tình trạng kỹ thuật của ứng dụng.

---

## 2. Màn hình & Chức năng Thực tế

### 2.1. Cấu hình Hệ thống Chung (`SystemSettingsView.tsx` - `/admin/settings`)
- **Thông tin đơn vị chủ quản**: Tên trường (*Trường Cao đẳng Du lịch Sài Gòn*), địa chỉ, số điện thoại liên hệ, logo, biểu ngữ.
- **Năm học & Chu kỳ mặc định**: Thiết lập năm học hiện hành, ngày bắt đầu và kết thúc năm tài chính/đào tạo.
- **Cấu hình Báo cáo ngày**: Quy định khung giờ chốt nộp báo cáo đúng hạn (VD: 17:30 hằng ngày).

### 2.2. Nhật ký Kiểm toán Toàn hệ thống (`system.audit.view` - `/admin/audit-logs`)
- Tra cứu và phân tích mọi hành vi tác động đến dữ liệu trọng yếu trong hệ thống (Tạo tài khoản, phân bổ chỉ tiêu KPI, chốt kết quả tuyển sinh, xóa công việc...).
- Thông tin ghi nhận: Thời điểm (`timestamp`), Người thực hiện (`user_id`, `full_name`, `email`), Hành động (`action`: `CREATE`, `UPDATE`, `DELETE`, `FINALIZE`), Thực thể bị tác động (`entity_type`, `entity_id`) và Chi tiết thay đổi (`details` JSON diff).

### 2.3. Quản lý Tệp tin & Lưu trữ (`Supabase Storage`)
- Giám sát dung lượng sử dụng và danh sách các tệp đính kèm trong các bucket lưu trữ.

---

## 3. Luồng Dữ liệu (Data Flow)

```
[Admin UI]
    │
    ▼ (GET / PUT /api/admin/settings)
    ▼ (GET /api/admin/audit-logs)
[Server: server.ts]
    │ (Kiểm tra capability 'system.settings.manage' hoặc 'system.audit.view')
    ▼
[Database: Supabase PostgreSQL - bảng system_settings, audit_logs]
```

---

## 4. Các Bảng Cơ sở Dữ liệu Liên quan

- `system_settings`: Bảng lưu trữ cấu hình dưới dạng key-value (`id`, `key`, `value`, `description`, `updated_at`).
- `audit_logs`: Bảng nhật ký kiểm toán hệ thống (`id`, `user_id`, `action`, `entity_type`, `entity_id`, `details`, `ip_address`, `created_at`).
- `admission_change_history`: Bảng kiểm toán chuyên biệt cho phân hệ Tuyển sinh.

---

## 5. Quyền Xem / Ghi & Phạm vi Dữ liệu

| Thao tác | Executive | Admin | Manager | Staff |
| :--- | :---: | :---: | :---: | :---: |
| Xem cấu hình hệ thống | Xem | Toàn quyền | - | - |
| Cập nhật cấu hình hệ thống | - | Toàn quyền | - | - |
| Xem nhật ký kiểm toán toàn hệ thống | Xem | Toàn quyền | - | - |
| Xem nhật ký kiểm toán phân hệ tuyển sinh | Xem | Toàn quyền | Đơn vị phụ trách | - |

---

## 6. Tích hợp Ngoại vi & Tác vụ Nền
- **Health Check Endpoint (`GET /api/health`)**: Phục vụ liveness và readiness probes cho hạ tầng triển khai Cloud Run/Kubernetes.
