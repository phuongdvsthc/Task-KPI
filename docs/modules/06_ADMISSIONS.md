# TÀI LIỆU KỸ THUẬT: PHÂN HỆ QUẢN LÝ TUYỂN SINH (ADMISSIONS)

---

## 1. Mục đích
Phân hệ **Quản lý Tuyển sinh** hỗ trợ lập kế hoạch chỉ tiêu, theo dõi chu kỳ các đợt tuyển sinh, nhập liệu và kiểm soát tiến độ thu nhận hồ sơ, trúng tuyển và nhập học thực tế theo từng ngành nghề đào tạo, đồng bộ dữ liệu với Google Sheets và lưu trữ nhật ký kiểm toán toàn diện.

---

## 2. Màn hình & Chức năng Thực tế

### 2.1. Tổng quan Tuyển sinh (`AdmissionOverviewDashboard.tsx` - `/admissions/overview`)
- **Dòng thông tin cập nhật dữ liệu (`lastUpdatedAt`)**: Hiển thị chính xác ngày cập nhật mới nhất từ database (`"Dữ liệu cập nhật đến ngày: DD/MM/YYYY"`), tính toán dựa trên `updated_at`, `created_at`, `finalized_at` thực tế của kết quả tuyển sinh.
- **Hộp chọn năm tuyển sinh chuẩn hóa**: `2026`, `2027`, `2028`, `2029`, `2030` (mặc định: `2026`).
- **Thẻ chỉ số tổng quan (KPI Cards)**:
  - Tổng chỉ tiêu kế hoạch năm.
  - Tổng hồ sơ tiếp nhận thực tế & Tỷ lệ hoàn thành so với chỉ tiêu (%).
  - Tổng số trúng tuyển & Tỷ lệ trúng tuyển / hồ sơ (%).
  - Tổng số nhập học thực tế & Tỷ lệ nhập học / chỉ tiêu (%).
- **Biểu đồ trực quan**:
  - Biểu đồ tiến độ thực hiện chỉ tiêu theo từng đợt tuyển sinh (Trung cấp & Ngắn hạn).
  - Biểu đồ cơ cấu tuyển sinh theo nhóm ngành đào tạo.
- **Bộ lọc động**: Lọc theo Nhóm tuyển sinh, Đợt tuyển sinh, Trạng thái (Đang mở, Đã chốt, Bản nháp), Chế độ dữ liệu (Tất cả / Đã chốt) và Phân công đơn vị.

### 2.2. Danh mục Ngành & Nhóm Tuyển sinh (`ProgramListView.tsx` - `/admissions/programs`)
- Quản lý danh sách các ngành đào tạo Trung cấp (Kỹ thuật chế biến món ăn, Hướng dẫn du lịch, Quản trị khách sạn...) và các khóa đào tạo Ngắn hạn/nghề.
- Mã ngành, tên ngành, mã nhóm tuyển sinh, chỉ tiêu chuẩn và trạng thái hoạt động.

### 2.3. Quản lý Đợt Tuyển sinh (`CampaignListView.tsx` - `/admissions/campaigns`)
- **Mô tả chức năng chuẩn**: *"Tạo và quản lý các đợt tuyển sinh theo năm, nhóm tuyển sinh và đơn vị; theo dõi trạng thái và lịch sử thay đổi."*
- Danh sách chu kỳ các đợt tuyển sinh trong năm (VD: 5 đợt Trung cấp `TC01.2026` đến `TC05.2026`, 8 đợt Ngắn hạn `NH-05.03` đến `NH-03.12`).
- Tạo mới, chỉnh sửa thông tin đợt, ngày bắt đầu, ngày kết thúc, trạng thái (*Đang tuyển, Đã đóng, Lưu trữ*).
- Nhật ký kiểm toán đợt tuyển sinh (`CampaignAuditModal.tsx`).

### 2.4. Kế hoạch & Phân bổ Chỉ tiêu (`AnnualPlanListView.tsx`, `CampaignAllocationView.tsx` - `/admissions/plans`)
- Thiết lập chỉ tiêu kế hoạch tuyển sinh hằng năm cho từng ngành và phân bổ chỉ tiêu về từng đợt tuyển sinh cụ thể.
- Khóa / Duyệt kế hoạch chỉ tiêu tuyển sinh.

### 2.5. Nhập & Chốt Kết quả Tuyển sinh (`ResultEntryView.tsx` - `/admissions/results`)
- Nhập số lượng hồ sơ tiếp nhận, trúng tuyển và nhập học theo từng ngành trong từng đợt tuyển sinh.
- Chế độ lưu nháp (`draft`) và chốt số liệu chính thức (`finalized`).
- Phân quyền theo đơn vị phụ trách tuyển sinh.

### 2.6. Đồng bộ Google Sheets & Lịch sử Kiểm toán (`GoogleSheetsSyncView.tsx`)
- Tích hợp 2 chiều với bảng tính Google Sheets để nhập kết quả từ các điểm thu hồ sơ.
- Kiểm toán chi tiết mọi thao tác thêm, sửa, xóa, chốt kết quả tuyển sinh (`admission_change_history`).

---

## 3. Luồng Dữ liệu (Data Flow)

```
[Client: AdmissionOverviewDashboard / ResultEntryView]
       │
       ▼ (GET /api/admissions/dashboard?year=2026&...)
       ▼ (POST / PUT /api/admissions/results)
[Server: admissionsRouter / admissionDashboardBackendService.ts]
       │
       │ (1. Xác thực RBAC: admissions.dashboard.view, admissions.results.manage)
       │ (2. Áp dụng Data Scope: Manager xem Khoa phụ trách, Admin/Executive xem toàn trường)
       │ (3. Tính toán KPI, Tỷ lệ %, lastUpdatedAt từ max(updated_at))
       ▼
[Database: Supabase PostgreSQL]
       ├──> [admission_campaigns, admission_groups, admission_programs]
       ├──> [admission_plans, admission_results, admission_result_items]
       └──> [admission_change_history (Audit Log)]
```

---

## 4. Các Bảng Cơ sở Dữ liệu Liên quan

- `admission_groups`: Nhóm tuyển sinh (`id`, `code`: `TRUNG_CAP`/`NGAN_HAN`, `name`, `is_active`).
- `admission_programs`: Ngành nghề đào tạo (`id`, `code`, `name`, `group_id`, `is_active`).
- `admission_campaigns`: Đợt tuyển sinh (`id`, `group_id`, `unit_id`, `code`, `name`, `year`, `period_number`, `start_date`, `end_date`, `status`, `is_active`).
- `admission_plans`: Kế hoạch chỉ tiêu (`id`, `campaign_id`, `group_id`, `program_id`, `quota_target`, `status`).
- `admission_results`: Kết quả tổng quan đợt (`id`, `campaign_id`, `status`: `draft`/`finalized`, `total_applications`, `total_admitted`, `finalized_at`, `created_at`, `updated_at`).
- `admission_result_items`: Kết quả chi tiết theo ngành (`id`, `result_id`, `program_id`, `applications_count`, `admitted_count`, `created_at`, `updated_at`).
- `admission_change_history`: Nhật ký kiểm toán phân hệ tuyển sinh (`id`, `entity_type`, `entity_id`, `action`, `changed_by`, `changed_at`, `details`).

---

## 5. Quyền Xem / Ghi & Phạm vi Dữ liệu

| Thao tác | Executive | Admin | Manager | Staff (Tuyển sinh) |
| :--- | :---: | :---: | :---: | :---: |
| Xem Tổng quan Dashboard | Toàn trường | Toàn trường | Đơn vị phụ trách | Đơn vị phụ trách |
| Tạo / Sửa đợt tuyển sinh | Xem | Có quyền | Có quyền (Đơn vị) | Xem |
| Lập kế hoạch chỉ tiêu | Xem | Có quyền | Có quyền (Đơn vị) | Xem |
| Nhập kết quả tuyển sinh | Xem | Có quyền | Có quyền (Đơn vị) | Nhập liệu được giao |
| Chốt kết quả (`Finalize`) | Xem | Có quyền | Có quyền (Đơn vị) | - |
| Xem Lịch sử kiểm toán | Xem | Toàn quyền | Xem (Đơn vị) | - |

---

## 6. Tích hợp Ngoại vi & Tác vụ Nền
- **Google Sheets API**: Hỗ trợ đồng bộ hàng loạt chỉ tiêu và số liệu nhập học.
- **Tính toán Freshness (`lastUpdatedAt`)**: Backend quét động max timestamp của các bản ghi kết quả thỏa mãn bộ lọc hiện hành để hiển thị trên giao diện người dùng.
- **Tác vụ nền**: Không có cron daemon tự động ghi; mọi thao tác đọc/lọc/chuyển tab đều là **100% READ-ONLY (chỉ SELECT)**.
