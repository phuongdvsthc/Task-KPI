# TÀI LIỆU KỸ THUẬT: MODULE QUẢN LÝ HIỆU SUẤT (KPI)

---

## 1. Mục đích
Module **Quản lý Hiệu suất KPI** thiết lập bộ chỉ số đánh giá hiệu quả công việc, phân bổ chỉ tiêu và trọng số theo chu kỳ (tháng, quý, năm) cho các Khoa, Phòng ban và từng cán bộ giảng viên; thực hiện quy trình tự chấm điểm, quản lý duyệt và tổng hợp điểm số toàn diện.

---

## 2. Màn hình & Chức năng Thực tế

### 2.1. Cấu hình Nền tảng KPI (`KpiFoundationLayout.tsx`, `/kpis/foundation`)
- **Định nghĩa Chỉ số KPI (`KpiDefinitionView.tsx`, `KpiDefinitionForm.tsx`)**:
  - Mã chỉ số, tên chỉ số, nhóm chỉ số (*Chuyên môn, Quản lý, Giảng dạy, Nghiên cứu khoa học, Tuyển sinh*).
  - Đơn vị tính (*% hoàn thành, Số lượng, Điểm số, Doanh thu*), loại chỉ số (*Càng cao càng tốt, Càng thấp càng tốt*), công thức tính điểm chuẩn.
- **Chu kỳ Đánh giá (`KpiPeriodView.tsx`, `KpiPeriodForm.tsx`)**:
  - Thiết lập chu kỳ: Năm học, Học kỳ, Quý, Tháng.
  - Ngày bắt đầu, ngày kết thúc và thời hạn chốt tự đánh giá / duyệt điểm.
- **Mục tiêu Chiến lược (`KpiObjectiveView.tsx`)**: Liên kết các chỉ số KPI với mục tiêu phát triển 5 năm của nhà trường.
- **Bộ mẫu KPI chuẩn (`KpiTemplateView.tsx`, `KpiTemplateForm.tsx`)**: Thiết lập khung mẫu KPI theo vị trí việc làm (Mẫu Giảng viên, Mẫu Chuyên viên tuyển sinh, Mẫu Trưởng khoa...).

### 2.2. Giao Chỉ tiêu & Phân bổ Trọng số (`KpiAssignmentListView.tsx`, `KpiAssignmentWizardModal.tsx`)
- Phân bổ chỉ tiêu cho từng đơn vị hoặc nhân sự trong kỳ đánh giá.
- Thiết lập trọng số (%) cho từng mục tiêu, đảm bảo tổng trọng số trong kỳ đạt đúng 100%.
- Khóa / Mở khóa chỉ tiêu giao (`KpiLockModal.tsx`).

### 2.3. Quy trình Tự chấm & Duyệt Điểm KPI (`StaffMyKpiView.tsx`, `KpiAssignmentDetailView.tsx`)
- **Nhân viên tự đánh giá**: Nhập giá trị thực đạt, nộp tệp minh chứng hoặc liên kết với công việc/kết quả thực tế trong hệ thống, hệ thống tự động tính điểm theo công thức.
- **Quy trình Duyệt đa cấp (`KpiReviewApproveModal.tsx`, `KpiReviewReturnModal.tsx`)**:
  - Quản lý đơn vị thẩm định điểm, đưa ra nhận xét, có quyền điều chỉnh điểm kèm lý do hoặc yêu cầu nhân viên bổ sung minh chứng.
  - Ban Giám hiệu / Hội đồng thi đua phê duyệt kết quả cuối cùng.
- **Truy vết điểm số (`KpiScoreTraceDrawer.tsx`, `KpiActualTraceDrawer.tsx`)**: Xem lại toàn bộ lịch sử thay đổi và căn cứ tính điểm của từng chỉ số.

### 2.4. Dashboard Phân tích KPI (`KpiExecutiveDashboardView.tsx`, `KpiManagerDashboardView.tsx`)
- Biểu đồ phân bổ điểm KPI theo thang xếp loại (*Xuất sắc, Tốt, Hoàn thành, Không hoàn thành*).
- Bảng xếp hạng điểm trung bình giữa các Khoa, Phòng ban.

---

## 3. Luồng Dữ liệu (Data Flow)

```
[Admin / Manager]
       │
       ▼ (Thiết lập & Giao KPI: POST /api/kpis/assignments)
[Database: kpi_definitions, kpi_periods, kpi_assignments]
       │
       ▼ (Staff Tự chấm: POST /api/kpis/assessments/self)
[Staff UI]
       │
       ▼ (Manager Thẩm định: POST /api/kpis/assessments/review)
[Manager UI]
       │
       ▼ (Tính toán điểm tổng hợp: resolveOfficialScoresBatch)
[KPI Dashboard & Executive Charts]
```

---

## 4. Các Bảng Cơ sở Dữ liệu Liên quan

- `kpi_definitions`: Danh mục chỉ số hiệu suất (`id`, `code`, `name`, `category`, `unit_of_measure`, `target_type`, `calculation_formula`).
- `kpi_periods`: Chu kỳ đánh giá (`id`, `code`, `name`, `period_type`, `start_date`, `end_date`, `status`: `open`/`locked`/`finalized`).
- `kpi_templates` & `kpi_template_items`: Khung mẫu KPI theo vị trí chức danh.
- `kpi_assignments`: Bản ghi giao chỉ tiêu (`id`, `period_id`, `unit_id`, `user_id`, `kpi_definition_id`, `target_value`, `weight`, `status`).
- `kpi_assessments`: Kết quả đánh giá (`id`, `assignment_id`, `actual_value`, `self_score`, `manager_score`, `final_score`, `evidence_url`, `status`, `reviewed_by`, `reviewed_at`).

---

## 5. Quyền Xem / Ghi & Phạm vi Dữ liệu

| Thao tác | Executive | Admin | Manager | Staff |
| :--- | :---: | :---: | :---: | :---: |
| Xem danh mục định nghĩa & chu kỳ | Xem | Quản trị toàn bộ | Xem | Xem |
| Giao chỉ tiêu & Trọng số | Xem | Có quyền | Có quyền (Đơn vị) | - |
| Tự chấm điểm & Gửi minh chứng | - | Có quyền | Có quyền | Có quyền (Bản thân) |
| Thẩm định & Phê duyệt điểm | Phê duyệt cấp trường | Toàn quyền | Phê duyệt cấp đơn vị | - |
| Khóa chỉ tiêu kỳ đánh giá | Xem | Có quyền | Có quyền (Đơn vị) | - |

---

## 6. Tích hợp Ngoại vi & Tác vụ Nền
- **Engine tính điểm (`kpiDashboardResolver.ts`)**: Giải quyết điểm số thực tế (`resolveLiveScoresBatch`) và điểm số chính thức sau phê duyệt (`resolveOfficialScoresBatch`).
- **Gemini AI (`StaffKpiAiSummary.tsx`, `ManagerKpiAiSummary.tsx`)**: Đánh giá nhận xét tự động về điểm mạnh, điểm cần cải thiện của cán bộ dựa trên dữ liệu KPI.
