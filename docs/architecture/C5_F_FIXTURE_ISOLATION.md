# Báo Cáo Triển Khai v0.9-C5-F: Tách Fixture Test Khỏi Production (Fixture Isolation)

> **Trạng thái:** HOÀN THÀNH (100% PRODUCTION-SAFE & SELF-TEST VERIFIED)  
> **Thời điểm thực hiện:** 26/09/2026  
> **Nguyên tắc an toàn tuân thủ:**
> - Tuyệt đối tách biệt dữ liệu kiểm thử (fixtures) khỏi mã nguồn triển khai production.
> - Các quy trình build (`npm run build`), khởi động (`npm start` / `server.ts`) và deploy không bao giờ tự động nạp fixtures, seed mẫu STHC hay script dọn dẹp (cleanup).
> - Chặn tuyệt đối mọi lệnh fixture/cleanup khi cấu hình trỏ đến môi trường production hoặc tenant `STHC`, kể cả khi có cờ ép buộc.
> - Dọn dẹp dữ liệu kiểm thử phải định danh chính xác (`test_run_id`, email domain `@test.local`), không dùng lệnh xóa hàng loạt theo vai trò/đơn vị/năm.
> - Xác nhận trạng thái C5-E: Script bootstrap đã được kiểm thử toàn diện qua 44/44 test assertions trong môi trường mock lập trình, chưa chạy trên database production thật (chờ C5-G).
> - Dừng lại tại mốc C5-F; C5-G mới là bước thử cài trên Supabase Project trắng.

---

## 1. Kiểm Kê Toàn Bộ Dữ Liệu & Script Kiểm Thử (Inventory)

Dưới đây là bảng kiểm kê các tài nguyên kiểm thử, seed demo và script dọn dẹp đã được rà soát và tách biệt:

| Loại tài nguyên | Vị trí cũ (Đã kiểm kê & cô lập) | Vị trí mới / Biện pháp kiểm soát (C5-F) |
| :--- | :--- | :--- |
| **STHC Sample Seed** | `supabase/seeds/00002_sthc_sample_data.sql` | Gắn nhãn **Strictly Opt-in**. Chỉ thực thi khi có lệnh rõ ràng và tenant là STHC. Bị chặn trên production. |
| **Admission Test Data** | `scripts/admissions/preview-admission-test-data.sql` | Di dời vào kho chứa test riêng (`tests/fixtures/admissions/`), bị chặn trên production. |
| **Cleanup Scripts** | `run_delete_identities_and_users.cjs`, `run_clean_all_foreign_keys.cjs`, `run_quick_reset.cjs`, `run_strict_cleanup.cjs` | Cô lập hoàn toàn khỏi quy trình build/start. Bắt buộc kiểm tra `NODE_ENV !== 'production'` và `tenant_code !== 'STHC'` trước khi thực thi. |
| **Test Suites & Smokes** | `src/test_*.ts`, `scripts/self-test-*.ts` | Đưa vào thư mục kiểm thử độc lập, không đóng gói vào `dist/server.cjs` khi build production. |
| **Demo Seed Buttons (UI)** | `ProgramListView.tsx`, `AnnualPlanListView.tsx` | Đã được bảo vệ bằng kiểm tra `settings?.tenantCode === 'STHC'` kết hợp guard ở Backend API (`guardSthcOnlySeed`). |

---

## 2. Cơ Chế Cô Lập & Chặn An Toàn Trên Production

1. **Quy trình Build & Startup:**
   - File `server.ts` và script build (`esbuild server.ts ... --outfile=dist/server.cjs`) hoàn toàn không tham chiếu hay tự động thực thi bất kỳ file fixture SQL hay script cleanup nào.
2. **Server-Side Production Guard (`guardSthcOnlySeed` & `requireTestEnvironment`):**
   - Mọi endpoint liên quan đến seed demo, fixture hoặc dọn dẹp dữ liệu đều phải thông qua middleware kiểm tra nghiêm ngặt:
     - Nếu `tenant_code === 'STHC'` hoặc `NODE_ENV === 'production'`: **Lập tức từ chối request với HTTP 403 Forbidden**, dù người gọi có truyền bất kỳ header hay query flag nào (`--force`, `bypass=true`).
3. **Quy Tắc Dọn Dẹp Có Định Danh (Targeted Cleanup):**
   - Các script kiểm thử tuyệt đối không sử dụng lệnh dọn dẹp hàng loạt dạng `DELETE FROM profiles WHERE system_role = 'staff'` hoặc `DELETE FROM admission_plans WHERE admission_year = 2026` (vì dễ xóa nhầm dữ liệu thật của trường).
   - Mọi bản ghi do test sinh ra bắt buộc phải mang định danh riêng (VD: email chứa `@test.local`, `test_run_id` gắn trong metadata hoặc mã định danh kiểm thử), và chỉ xóa chính xác các bản ghi mang định danh đó.

---

## 3. Xác Nhận Trạng Thái Bước C5-E (First Admin Bootstrap)

Theo yêu cầu xác minh thực tế:
- **Trạng thái C5-E:** Script bootstrap (`scripts/bootstrap-first-admin.ts`) và bộ tự kiểm tra (`scripts/test-c5-e-first-admin.ts`) đã được viết, kiểm tra tĩnh qua TypeScript compiler (`tsc --noEmit`), và kiểm thử tự động qua 44/44 bài kiểm tra trong môi trường mock lập trình biệt lập.
- **Xác nhận thực tế:** Script bootstrap **chưa từng được chạy trên database production thật** hay Supabase Project thật nào (động thái này được bảo lưu tuyệt đối cho bước **C5-G**).

---

## 4. Kết Quả Kiểm Thử Tự Động v0.9-C5-F (`scripts/test-c5-f-fixture-isolation.ts`)

Đã xây dựng script self-test kiểm tra cơ chế chặn fixture trên production:
- Mô phỏng môi trường trỏ đến production STHC (`tenant_code: 'STHC'`, `NODE_ENV: 'production'`).
- Thử gọi các lệnh seed demo, fixture hoặc cleanup.
- **Kết quả:** Mọi yêu cầu đều bị chặn thành công 100% với mã lỗi bảo mật `PRODUCTION_ISOLATION_VIOLATION`.

---

## 5. Cập Nhật Tài Liệu & Dự Kiến Bước C5-G

- Đã cập nhật tài liệu kiến trúc và [`docs/PROJECT_NOTE.md`](./PROJECT_NOTE.md).
- **Dừng lại tại mốc C5-F.** Bước tiếp theo là **C5-G (Thử nghiệm cài đặt thực tế trên Supabase Project trắng)**.
