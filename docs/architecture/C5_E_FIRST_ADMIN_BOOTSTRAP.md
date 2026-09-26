# Báo Cáo Triển Khai v0.9-C5-E: Tạo Admin Đầu Tiên & Gắn Với Đơn Vị ROOT (First Admin Bootstrap)

> **Trạng thái:** HOÀN THÀNH (100% PASS SELF-TESTS: 44/44 BÀI KIỂM TRA)  
> **Thời điểm thực hiện:** 26/09/2026  
> **Nguyên tắc an toàn tuân thủ:**
> - Tuyệt đối không chạy bootstrap trên production STHC, không thay đổi người dùng đang vận hành.
> - Tạo tài khoản người dùng duy nhất thông qua **Supabase Auth Admin API**; tuyệt đối không chèn trực tiếp bằng SQL vào `auth.users`.
> - Không hardcode mật khẩu hay service role key vào file mã nguồn, log hoặc tài liệu.
> - Đảm bảo tính lũy kế (idempotency) và khả năng tự phục hồi nếu xảy ra lỗi mạng/database giữa chừng.
> - Chặn đứng nếu hệ thống đã có Admin khác đang hoạt động.
> - Dừng lại tại mốc C5-E; chưa triển khai C5-F và chưa tuyên bố cài đặt database trắng thành công trước C5-G.

---

## 1. Mục Đích & Vị Trí Của Bước C5-E Trong Chuỗi Triển Khai

Bước **v0.9-C5-E** là quy trình khởi tạo tài khoản quản trị đầu tiên (**One-Time First Admin Bootstrap**) cho mỗi dự án Supabase mới:

```
[Blank Supabase DB]
        ↓
1. Migrations DDL (00001 - 00009): Tạo 57 bảng, 2 views, RPCs, Storage (C5-B)
        ↓
2. Seed nền chuẩn (00001_core_baseline_seed.sql): Modules, Roles, Perms (C5-C)
        ↓
3. Cấu hình trường (scripts/apply-tenant-config.ts): Nạp tenant.config & ROOT unit (C5-D)
        ↓
4. BOOTSTRAP FIRST ADMIN (scripts/bootstrap-first-admin.ts): Tạo Admin & gắn ROOT (C5-E)  <-- [ĐANG Ở ĐÂY]
        ↓
5. [DỪNG TẠI C5-E] - Chuyển giao sang C5-F (Thiết lập phòng ban & cán bộ qua UI/API)
```

---

## 2. Thiết Kế Kỹ Thuật Của Script `scripts/bootstrap-first-admin.ts`

### 2.1. Kiểm Tra Tiền Điều Kiện (Prerequisite Verification)
Script kiểm tra tính toàn vẹn của database trước khi thực hiện bất kỳ thao tác tạo người dùng nào:
1. **Kiểm tra Cấu hình trường (`system_settings`):** Kiểm tra `setting_key = 'tenant_code'`. Nếu thiếu, script dừng với lỗi yêu cầu chạy bước C5-D trước.
2. **Kiểm tra Đơn vị ROOT (`organization_units`):** Tìm kiếm đơn vị gốc có `parent_id IS NULL`. Nếu thiếu, dừng với lỗi yêu cầu cấu hình ROOT trước.
3. **Kiểm tra Vai trò Admin (`access_roles`):** Tìm kiếm vai trò có mã `code = 'admin'`. Nếu thiếu, dừng với thông báo nạp seed nền C5-C trước.
4. **Khóa an toàn môi trường production STHC:** Nếu database mang mã `tenant_code === 'STHC'` và môi trường là `production`, script lập tức khóa chặn:  
   *“NGĂN CHẶN THAO TÁC TRÊN PRODUCTION STHC: Script bootstrap bị khóa trên môi trường production STHC nhằm bảo vệ dữ liệu người dùng đang vận hành.”*

### 2.2. Kiểm Tra Chặn Đa Admin (Pre-Run Existing Admin Check)
Script quét bảng `public.profiles` để phát hiện xem đã có quản trị viên hoạt động (`system_role = 'admin'` và `is_active = true`) chưa:
- **Nếu đã có Admin khác email:** Script hủy bỏ ngay lập tức và đưa ra hướng dẫn rõ ràng:  
  *“HỆ THỐNG ĐÃ CÓ TÀI KHOẢN ADMIN: Đã tồn tại quản trị viên hoạt động ([email]). Script bootstrap chỉ được phép chạy một lần duy nhất cho Admin đầu tiên. Để thêm quản trị viên mới, vui lòng đăng nhập tài khoản hiện có và sử dụng giao diện Quản lý người dùng.”*
- **Nếu trùng email với tài khoản đang yêu cầu:** Script kích hoạt **Chế độ Phục hồi / Hoàn tất liên kết (Recovery / Idempotent Mode)**.

### 2.3. Tạo Tài Khoản Qua Supabase Auth Admin API (Chuẩn Hóa An Toàn)
- **Quy tắc tuyệt đối:** Không bao giờ chạy câu lệnh SQL chèn vào `auth.users` vì có thể gây lỗi gãy trigger quản lý session, mật mã hóa mật khẩu và token của GoTrue/Supabase Auth.
- Sử dụng hàm chuẩn:
  ```ts
  const { data: authCreated, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: rawPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      system_role: 'admin'
    }
  });
  ```

### 2.4. Liên Kết Nguyên Tử (Atomic Linking)
Sau khi có `userId` từ Supabase Auth, script liên kết đồng thời 3 thực thể:
1. **`public.profiles`:**
   - Upsert theo `id = userId`.
   - Gán `system_role = 'admin'`, `full_name`, `email`, `job_title`, `employee_code`, `is_active = true`.
2. **`public.access_user_roles`:**
   - Upsert theo cặp `(user_id, role_id)`.
   - Gán `role_id` của vai trò `admin`, `is_primary = true`, `is_active = true`, `source_code = 'bootstrap'`.
3. **`public.organization_members`:**
   - Upsert theo cặp `(organization_unit_id, user_id)`.
   - Gán `organization_unit_id = rootUnit.id` (Đơn vị gốc của trường), `member_role = 'head'`, `is_primary = true`.
4. **`public.access_audit_logs`:**
   - Ghi lại vết kiểm toán hệ thống với mã `system.bootstrap.first_admin`.

---

## 3. Luồng Quản Lý Mật Khẩu An Toàn Cho Admin Đầu Tiên

1. **Nhận mật khẩu từ nguồn bảo mật:**
   - Cho phép truyền qua biến môi trường `BOOTSTRAP_ADMIN_PASSWORD` hoặc tham số dòng lệnh `--password=...`.
   - Kiểm tra độ dài tối thiểu từ 8 ký tự.
2. **Cơ chế sinh mật khẩu ngẫu nhiên an toàn:**
   - Nếu quản trị viên không truyền mật khẩu, hàm `generateSecurePassword()` sử dụng `crypto.randomInt` để sinh chuỗi ngẫu nhiên 16 ký tự có độ phức tạp cao (gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt).
   - Mật khẩu chỉ được in ra màn hình console interactive một lần duy nhất kèm cảnh báo bảo mật yêu cầu người vận hành lưu trữ an toàn.
3. **Che giấu thông tin nhạy cảm:**
   - Không ghi mật khẩu vào biến log hoặc file cấu hình.
   - Kết quả trả về của script và nhật ký audit log chỉ chứa thông tin định danh (`userId`, `email`, `role`, `rootUnit`), mật khẩu được che chắn hoàn toàn.

---

## 4. Cơ Chế Tự Phục Hồi Khi Gặp Sự Cố Giữa Chừng (Crash / Partial Failure Recovery)

Nếu script gặp sự cố gián đoạn mạng hoặc lỗi DB giữa chừng:
- **Kịch bản sự cố:** Tài khoản đã được tạo trong Supabase Auth nhưng kết nối DB bị đứt trước khi kịp tạo `profiles`, `access_user_roles` hoặc `organization_members`.
- **Cách xử lý khi chạy lại:**
  1. Khi gọi `supabase.auth.admin.createUser`, Supabase sẽ báo lỗi `"User already registered"`.
  2. Script nhận diện lỗi này, tự động chuyển sang chế độ **Recovery**.
  3. Script tra cứu `userId` của tài khoản đó từ Supabase Auth thông qua `auth.admin.listUsers()`.
  4. Nếu có mật khẩu mới được truyền vào, script cập nhật mật khẩu qua `auth.admin.updateUserById()`.
  5. Tiếp tục hoàn tất toàn bộ các bảng liên kết `profiles`, `access_user_roles` và `organization_members`.
  6. **Đảm bảo không tạo trùng lặp:** Không sinh thêm người dùng Auth rác, không tạo 2 hồ sơ hay trùng phân quyền.

---

## 5. Bổ Sung Bằng Chứng Đầy Đủ Của Bước C5-D

Báo cáo bổ sung bằng chứng thực nghiệm cho các mục kiểm tra đa cơ sở ở C5-D:

### 5.1. Thử Nghiệm Cấu Hình Hai Trường Khác Nhau
- Đã kiểm tra độc lập 2 cấu hình mẫu:
  - **Trường Alpha (`VTC`):** Trường Cao đẳng Công nghệ và Du lịch (ROOT: `VTC`, tắt module `admissions` và `ai`).
  - **Trường Beta (`CCT`):** Trường Cao đẳng Công Thương TP.HCM (ROOT: `CCT`, tắt module `kpi` và `team_report`).
- Cả hai cấu hình đều pass 100% qua bộ validator `validateTenantConfig`.
- Cơ chế Cross-Tenant Guard đã kích hoạt thành công: Ngăn chặn việc nạp cấu hình Beta vào database đã mang mã Alpha.

### 5.2. Chặn API Seed Dữ Liệu STHC Tại Các Trường Khác
- Hàm `seedStandardPrograms()` và `seedOfficial2026Plans` được kiểm tra với mã trường `VTC` và `CCT`.
- **Kết quả:** Cả hai trường đều bị chặn đứng với ngoại lệ:  
  *“Chức năng nạp danh mục ngành chuẩn / kế hoạch mẫu 2026 của STHC chỉ được phép sử dụng cho cơ sở STHC.”*
- Nút nạp dữ liệu STHC trên UI bị ẩn hoàn toàn khi `tenantCode !== 'STHC'`.

### 5.3. Kiểm Tra Module Bị Tắt Ở Menu, Route & API
- **Menu (`Sidebar.tsx`):** Module bị tắt tự động ẩn khỏi cây menu điều hướng.
- **Route (`RouteGuard.tsx` & `routeMetadata.ts`):** Truy cập URL trực tiếp trả về trạng thái `status: 'module_disabled'`, chặn không cho mount view hay gọi API.
- **Backend API (`server.ts`):** Middleware `requireTenantModule(moduleCode)` chặn các API của module bị tắt, trả về **HTTP 403 Forbidden** (`MODULE_DISABLED`).
- **Bảo toàn dữ liệu:** Việc tắt module chỉ cập nhật cờ `access_modules.is_active = false`, không xóa dữ liệu hay thay đổi quyền RBAC.

---

## 6. Kết Quả Kiểm Thử Tự Động v0.9-C5-E (44/44 PASS)

Script `scripts/test-c5-e-first-admin.ts` đã chạy kiểm thử toàn diện trên môi trường mock biệt lập:

```
================================================================
      v0.9-C5-E FIRST ADMIN BOOTSTRAP AUTOMATED SELF-TESTS      
================================================================

--- TEST GROUP 1: Prerequisites & Security Guard Checks ---
[PASS] Test 1: Rejects bootstrap when tenant configuration is missing
[PASS] Test 2: Rejects bootstrap when ROOT unit is missing
[PASS] Test 3: Rejects bootstrap when 'admin' role is missing from access_roles
[PASS] Test 4: Rejects bootstrap with invalid email syntax
[PASS] Test 5: Rejects bootstrap with password shorter than 8 characters
[PASS] Test 6: Strictly locks bootstrap execution on production STHC

--- TEST GROUP 2: Successful Bootstrap & Atomic Linking ---
[PASS] Test 7: Successfully bootstrapped First Admin
[PASS] Test 8: Marked as initial clean creation (not recovery)
[PASS] Test 9: Assigned role is 'admin'
[PASS] Test 10: Admin correctly linked to ROOT unit VTC
[PASS] Test 11: Exactly 1 user created in Supabase Auth Admin API
[PASS] Test 12: Auth user ID matches result
[PASS] Test 13: Profile record created in public.profiles
[PASS] Test 14: Profile system_role is admin
[PASS] Test 15: Profile is active
[PASS] Test 16: access_user_roles record created
[PASS] Test 17: User role references admin role ID
[PASS] Test 18: User role is primary
[PASS] Test 19: organization_members record created
[PASS] Test 20: Linked to ROOT unit ID
[PASS] Test 21: Member role in ROOT unit is head
[PASS] Test 22: Bootstrap audit log recorded
[PASS] Test 23: Audit action is system.bootstrap.first_admin

--- TEST GROUP 3: Effective Permissions Resolution ---
[PASS] Test 24: Bootstrapped Admin has system.settings.manage permission
[PASS] Test 25: Bootstrapped Admin has user_org.users.manage permission
[PASS] Test 26: Bootstrapped Admin has access_control.roles.manage permission

--- TEST GROUP 4: Pre-Run Existing Admin Guard ---
[PASS] Test 27: Pre-run check stops bootstrap when another Admin already exists

--- TEST GROUP 5: Safe Idempotent Re-Run ---
[PASS] Test 28: Re-run with same admin succeeded
[PASS] Test 29: Detected as idempotent recovery/completion run
[PASS] Test 30: Zero duplicate Auth users created on re-run
[PASS] Test 31: Zero duplicate profiles created on re-run
[PASS] Test 32: Zero duplicate access_user_roles created on re-run
[PASS] Test 33: Zero duplicate organization_members created on re-run

--- TEST GROUP 6: Mid-Way Crash Recovery Simulation ---
[PASS] Test 34: Crash recovery run completed successfully
[PASS] Test 35: Reused existing Auth user ID without failing
[PASS] Test 36: Recovered profile record
[PASS] Test 37: Recovered access_user_roles record
[PASS] Test 38: Recovered organization_members record

--- TEST GROUP 7: Password Security & Secret Masking ---
[PASS] Test 39: Generated random password is at least 16 characters
[PASS] Test 40: Generated password contains mixed case and digits
[PASS] Test 41: Result message does not leak password

--- TEST GROUP 8: C5-D Cross-School & STHC Blocker Evidence Verification ---
[PASS] Test 42: Two distinct schools validated independently without interference
[PASS] Test 43: STHC seed API is strictly blocked on school VTC
[PASS] Test 44: Disabled module route returns status module_disabled

================================================================
  ALL 44/44 C5-E SELF-TESTS PASSED SUCCESSFULLY! (100% PASS) 
================================================================
```

---

## 7. Hướng Dẫn Vận Hành & Hướng Dẫn Xử Lý Khi Gặp Sự Cố

### 7.1. Hướng Dẫn Khởi Tạo Khi Cài Đặt Trường Mới (Chạy ở C5-G)
Sau khi đã chạy 9 migration DDL, nạp seed nền và áp dụng cấu hình trường `apply-tenant-config.ts`:

```bash
# Cách 1: Tự động sinh mật khẩu ngẫu nhiên bảo mật
npx tsx scripts/bootstrap-first-admin.ts --email=admin@school.edu.vn --name="Quản trị viên Trường"

# Cách 2: Thiết lập thông qua biến môi trường
export BOOTSTRAP_ADMIN_EMAIL="admin@school.edu.vn"
export BOOTSTRAP_ADMIN_PASSWORD="StrongPassword123!#"
export BOOTSTRAP_ADMIN_FULL_NAME="Quản trị viên Trường"
npx tsx scripts/bootstrap-first-admin.ts
```

### 7.2. Hướng Dẫn Cứu Hộ / Xử Lý Sự Cố (Troubleshooting & Recovery Runbook)

| Tình huống sự cố | Nguyên nhân | Thao tác xử lý an toàn |
| :--- | :--- | :--- |
| **Báo lỗi `HỆ THỐNG ĐÃ CÓ TÀI KHOẢN ADMIN`** | Đã có một quản trị viên khác tồn tại trong bảng `profiles` | Không dùng script bootstrap nữa. Đăng nhập bằng tài khoản admin hiện có để tạo thêm tài khoản mới từ giao diện Quản lý người dùng. |
| **Quá trình chạy bị ngắt giữa chừng (Crash midway)** | Rớt mạng hoặc timeout khi đang gọi API database | Chạy lại nguyên văn lệnh bootstrap với cùng email đó. Script sẽ tự động nhận diện tài khoản Auth đã tạo và hoàn tất các bản ghi DB còn thiếu mà không tạo trùng lặp. |
| **Quản trị viên quên mật khẩu khởi tạo** | Chưa lưu mật khẩu được sinh ngẫu nhiên | Đăng nhập tài khoản Supabase Dashboard / CLI để reset mật khẩu người dùng, hoặc chạy lại lệnh bootstrap kèm `--password="NewPassword123!#"` (chế độ recovery hỗ trợ cập nhật lại mật khẩu Auth). |
| **Báo lỗi `Chưa tìm thấy đơn vị ROOT`** | Bước C5-D chưa được thực hiện hoặc chưa tạo ROOT unit | Chạy lệnh `npx tsx scripts/apply-tenant-config.ts tenant.config.json` trước khi chạy lại bootstrap. |

---

## 8. Các Điểm Chưa Xác Minh & Trạng Thái Bàn Giao

1. **Điểm chưa xác minh:**  
   - Kiểm tra **57 bảng và 2 views** hiện tại chỉ xác nhận **số lượng bảng và cấu trúc qua PostgREST/OpenAPI**, chưa có bằng chứng catalog DDL đầy đủ từ Supabase SQL Editor. Chi tiết này được giữ ở trạng thái chưa xác minh và sẽ kiểm chứng đối chiếu trên database trắng tại bước **C5-G**.
   - Chưa chạy script bootstrap trên bất kỳ Supabase Project thật nào ngoài môi trường mock tự kiểm (theo nguyên tắc an toàn).
2. **Quyết định dừng kỹ thuật:**  
   - **HOÀN THÀNH TOÀN DIỆN C5-E:** Script bootstrap, cơ chế khôi phục lỗi, bảo vệ production STHC, và 44 bài tự kiểm tra đều đạt 100%.
   - **TUYỆT ĐỐI CHƯA CHẠY TRÊN PRODUCTION STHC**.
   - **DỪNG LẠI TẠI MỐC C5-E**, chưa triển khai C5-F.
