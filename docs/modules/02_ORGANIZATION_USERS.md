# TÀI LIỆU KỸ THUẬT: MODULE CƠ CẤU TỔ CHỨC & NGƯỜI DÙNG

---

## 1. Mục đích
Module **Cơ cấu Tổ chức & Người dùng** chịu trách nhiệm thiết lập và quản lý toàn bộ cây phân cấp phòng ban, khoa đào tạo, trung tâm, chức danh chuyên môn và danh sách tài khoản nhân sự trong toàn trường.

---

## 2. Màn hình & Chức năng Thực tế

### 2.1. Quản lý Cơ cấu Tổ chức (`OrganizationListView.tsx`, `OrganizationFormView.tsx` - `/admin/organizations`)
- **Hiển thị cây đơn vị (Tree View & Grid View)**: Thể hiện quan hệ cấp bậc giữa Ban Giám hiệu, các Khoa chuyên môn (Khoa Khách sạn - Nhà hàng, Khoa Lữ hành...), các Phòng ban chức năng (Phòng Đào tạo, Phòng Tuyển sinh, Phòng Tổ chức...).
- **Tạo & Sửa đơn vị**: Thiết lập mã đơn vị (`code`), tên đơn vị (`name`), loại đơn vị (`type`: `academic`, `administrative`, `service`), đơn vị cấp trên (`parent_id`), và người đứng đầu đơn vị (`leader_id`).
- **Kiểm tra ràng buộc xóa đơn vị**: Không cho phép xóa đơn vị nếu đang có nhân sự trực thuộc hoặc đơn vị con.

### 2.2. Quản lý Người dùng & Nhân sự (`UserManagementView.tsx`, `UserForm.tsx` - `/admin/users`)
- **Danh sách nhân sự đa tiêu chí**: Tìm kiếm theo họ tên, email, lọc theo đơn vị công tác, vai trò hệ thống (`system_role`), và trạng thái hoạt động (`is_active`).
- **Thêm mới tài khoản**:
  - Tạo tài khoản đăng nhập Supabase Auth.
  - Điền thông tin hồ sơ `profiles`: Mã nhân viên, Họ tên, Email, Số điện thoại, Đơn vị chính (`primary_unit_id`), Chức danh (`job_title`), Vai trò hệ thống (`executive`, `admin`, `manager`, `staff`).
- **Chỉnh sửa & Phân quyền**: Cập nhật thông tin công tác, điều chuyển đơn vị hoặc nâng cấp vai trò quản lý.
- **Khóa & Mở khóa tài khoản**: Chuyển trạng thái `is_active: false` để vô hiệu hóa quyền truy cập ngay lập tức mà không làm mất dữ liệu lịch sử.
- **Đặt lại mật khẩu (`Reset Password`)**: Hỗ trợ quản trị viên cấp phát lại mật khẩu mới cho người dùng.

### 2.3. Hồ sơ Cá nhân & Bảo mật (`UserProfileModal.tsx`, `SecurityView.tsx` - `/account/security`)
- Người dùng tự cập nhật số điện thoại, ảnh đại diện và thực hiện đổi mật khẩu cá nhân.

---

## 3. Luồng Dữ liệu (Data Flow)

```
[Admin UI]
    │
    ▼ (POST / PUT / DELETE /api/admin/organization-units)
    ▼ (POST / PUT / DELETE /api/admin/users)
[Server: server.ts]
    │ (Xác thực capability 'user_org.units.manage' hoặc 'user_org.users.manage')
    │
    ├──> [Supabase Auth API: auth.admin.createUser / auth.admin.updateUserById]
    │
    └──> [PostgreSQL: bảng units, profiles, user_roles]
```

---

## 4. Các Bảng Cơ sở Dữ liệu Liên quan

- `units`: Danh sách đơn vị tổ chức (`id`, `code`, `name`, `type`, `parent_id`, `leader_id`, `sort_order`, `is_active`).
- `profiles`: Hồ sơ người dùng (`id` khớp với `auth.users.id`, `full_name`, `email`, `phone`, `primary_unit_id`, `job_title`, `system_role`, `is_active`, `avatar_url`).
- `user_roles`: Bảng gán vai trò mở rộng / thứ cấp cho tài khoản người dùng.
- `job_positions`: Danh mục chức danh và vị trí việc làm chuẩn.

---

## 5. Quyền Xem / Ghi & Phạm vi Dữ liệu

| Thao tác | Executive | Admin | Manager | Staff |
| :--- | :---: | :---: | :---: | :---: |
| Xem danh mục đơn vị | Xem toàn bộ | Xem toàn bộ | Xem đơn vị mình | Xem đơn vị mình |
| Tạo / Sửa / Xóa đơn vị | - | Có quyền | - | - |
| Xem danh sách người dùng | Xem toàn bộ | Xem toàn bộ | Xem nhân viên đơn vị | Xem thông tin đồng nghiệp |
| Tạo / Sửa / Khóa người dùng | - | Có quyền | - | - |
| Đặt lại mật khẩu người dùng | - | Có quyền | - | - |
| Đổi mật khẩu cá nhân | Bản thân | Bản thân | Bản thân | Bản thân |

---

## 6. Tích hợp Ngoại vi & Tác vụ Nền
- **Supabase Auth Admin API**: Đồng bộ tài khoản giữa bảng bảo mật người dùng `auth.users` và bảng thông tin hồ sơ `public.profiles`.
- **Tác vụ nền**: Không có.
