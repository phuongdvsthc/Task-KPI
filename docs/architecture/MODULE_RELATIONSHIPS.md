# SƠ ĐỒ MỐI QUAN HỆ CÁC MODULE (MODULE RELATIONSHIPS)

Tài liệu này mô tả mối quan hệ phụ thuộc dữ liệu và luồng tương tác giữa các module trong hệ thống Work + KPI.

---

## 1. Sơ đồ Quan hệ Tổng thể

```
                 ┌─────────────────────────────────────────┐
                 │     CƠ CẤU TỔ CHỨC & NGƯỜI DÙNG         │
                 │     - units, profiles, user_roles       │
                 └────────────────────┬────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │ (Gán nhân sự / đơn vị)  │ (Phân quyền dữ liệu)    │ (Thuộc khoa/ban)
            ▼                         ▼                         ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│       CÔNG VIỆC       │ │   BÁO CÁO HẰNG NGÀY   │ │       TUYỂN SINH      │
│  - tasks              │ │  - daily_reports      │ │  - admission_campaigns│
│  - task_assignees     │ │  - daily_report_items │ │  - admission_plans    │
│  - task_evidences     │ │  - reminder_logs      │ │  - admission_results  │
└───────────┬───────────┘ └───────────┬───────────┘ └───────────┬───────────┘
            │                         │                         │
            │ (Tự động trích xuất)    │ (Đóng góp tiến độ)      │ (Chỉ tiêu tuyển sinh)
            └────────────┬────────────┘                         │
                         ▼                                      │
            ┌─────────────────────────────────────────┐         │
            │          QUẢN LÝ HIỆU SUẤT KPI          │◄────────┘
            │  - kpi_definitions, kpi_periods         │
            │  - kpi_assignments, kpi_assessments     │
            └────────────────────┬────────────────────┘
                                 │
                                 ▼
            ┌─────────────────────────────────────────┐
            │          TỔNG QUAN / DASHBOARD          │
            │  - Executive, Manager, Staff, Admin     │
            │  - Tổng hợp chỉ số đa chiều             │
            └────────────────────▲────────────────────┘
                                 │
            ┌────────────────────┴────────────────────┐
            │              TRỢ LÝ AI                  │
            │  - Phân tích hiệu suất, đề xuất công việc│
            │  - Tra cứu tri thức & tóm tắt báo cáo   │
            └─────────────────────────────────────────┘
```

---

## 2. Chi tiết Tương tác Giữa các Phân hệ

### 2.1. Tổ chức & Người dùng ➔ Các module khác
- **Cung cấp thực thể cơ sở**: Cây đơn vị (`units`) và hồ sơ người dùng (`profiles`) là điểm neo tham chiếu cho mọi giao dịch trong hệ thống.
- **Phạm vi dữ liệu (Data Scope)**: 
  - Đơn vị chính (`primary_unit_id`) xác định phạm vi mà một `Manager` được xem và thao tác.
  - Phân cấp đơn vị cha/con định hình việc cuộn dữ liệu (roll-up) lên cấp `Executive`.

### 2.2. Công việc ➔ Báo cáo hằng ngày
- Nhân viên khi lập **Báo cáo hằng ngày** có thể bấm chọn tự động đồng bộ từ danh sách các công việc (`tasks`) đang thực hiện trong ngày.
- Báo cáo ngày liên kết ngược lại `task_id` để chứng minh thời lượng và khối lượng công việc đã hoàn thành.

### 2.3. Công việc & Báo cáo & Tuyển sinh ➔ Đánh giá KPI
- **KPI công việc**: Chỉ tiêu hoàn thành đúng hạn các nhiệm vụ trọng tâm được tính dựa trên trạng thái `tasks.status = 'completed'` và `due_date`.
- **KPI chuyên cần**: Tỷ lệ nộp báo cáo đúng hạn lấy dữ liệu từ `daily_reports.submission_status`.
- **KPI tuyển sinh**: Kết quả tuyển sinh từ `admission_results` tự động đóng góp vào các chỉ số KPI doanh thu/chỉ tiêu tuyển sinh của từng phòng/khoa.

### 2.4. Tất cả các Module ➔ Tổng quan / Dashboard
- **Executive Dashboard**: Tổng hợp dữ liệu cấp toàn trường (tiến độ công việc toàn trường, tỷ lệ nộp báo cáo các đơn vị, điểm KPI trung bình theo phòng ban, tiến độ tuyển sinh các đợt).
- **Manager Dashboard**: Tổng hợp chi tiết theo từng đơn vị được phân công, giám sát nhân viên dưới quyền, danh sách trễ hạn hoặc thiếu báo cáo.
- **Staff Dashboard**: Tập trung hóa thông tin cá nhân của nhân viên (công việc cần làm hôm nay, trạng thái báo cáo ngày, điểm KPI chu kỳ hiện tại).

### 2.5. Trợ lý AI ➔ Tương tác liên module
- **Tóm tắt báo cáo**: AI đọc dữ liệu từ `daily_reports` để tổng hợp báo cáo tuần/tháng cho cấp quản lý.
- **Gợi ý phân bổ công việc**: AI phân tích mô tả công việc để đề xuất người nhận phù hợp dựa trên phòng ban và chuyên môn.
- **Phân tích tuyển sinh**: AI hỗ trợ phát hiện các ngành đang đạt tỷ lệ thấp so với chỉ tiêu kế hoạch đề ra.
