# TÀI LIỆU KỸ THUẬT: MODULE BÁO CÁO HẰNG NGÀY (DAILY REPORTS)

---

## 1. Mục đích
Module **Báo cáo Hằng ngày** quản lý quy trình lập, nộp, tổng hợp và phê duyệt báo cáo công việc hằng ngày của cán bộ, giảng viên, nhân viên; là nguồn dữ liệu quan trọng để đo lường tính tuân thủ kỷ luật và đóng góp cho KPI chuyên cần.

---

## 2. Màn hình & Chức năng Thực tế

### 2.1. Lập Báo cáo Cá nhân (`DailyReportFormView.tsx`, `StaffMonthlyCalendar.tsx` - `/daily-reports`)
- **Lịch báo cáo tháng cá nhân**: Thể hiện trực quan từng ngày trong tháng bằng màu sắc trạng thái (*Xanh: Đã nộp đúng hạn, Vàng: Nộp trễ, Đỏ: Chưa nộp, Xám: Ngày nghỉ/cuối tuần*).
- **Tự động đồng bộ từ Công việc (Auto-fill from Tasks)**: Bấm nút để kéo toàn bộ các đầu việc trong bảng `tasks` mà nhân viên đã làm trong ngày vào nội dung báo cáo.
- **Nhập chi tiết các mục việc (`daily_report_items`)**:
  - Nội dung công việc thực hiện.
  - Số giờ tiêu tốn (`hours_spent`).
  - Kết quả đạt được và tỷ lệ hoàn thành.
  - Khó khăn, vướng mắc và đề xuất hỗ trợ.
- **Trạng thái nộp**: Lưu nháp (`draft`) hoặc Nộp chính thức (`submitted`).

### 2.2. Giám sát & Duyệt Báo cáo Đơn vị (`ManagerTeamDailyReportView.tsx`, `ManagerTeamCalendarMatrix.tsx`)
- **Ma trận báo cáo đội ngũ (Team Matrix)**: Bảng lưới thể hiện trạng thái nộp báo cáo của toàn bộ nhân viên trong đơn vị theo từng ngày trong tháng.
- **Xem chi tiết & Phê duyệt (`SubmittedReportDetailModal.tsx`)**: Quản lý đơn vị đọc chi tiết báo cáo, đưa ra nhận xét, đánh giá chất lượng (*Đạt / Cần bổ sung*) và duyệt báo cáo.
- **Gửi nhắc nhở tự động / thủ công (`MissingReportReminderModal.tsx`)**: Gửi thông báo nhắc nhở đến các nhân sự chưa nộp báo cáo trong ngày.

### 2.3. Tích hợp AI Phân tích Báo cáo (`StaffDailyReportIntelligence.tsx`, `ManagerDailyReportIntelligence.tsx`)
- **Đối với nhân viên**: AI đọc nội dung công việc và hỗ trợ viết lại bản tóm tắt báo cáo súc tích, chuyên nghiệp.
- **Đối với quản lý**: AI tổng hợp toàn bộ báo cáo ngày của cả phòng/khoa để xuất ra bản tổng hợp nhanh tình hình hoạt động của đơn vị.

---

## 3. Luồng Dữ liệu (Data Flow)

```
[Staff UI]
       │
       ▼ (POST /api/daily-reports - Lưu nháp hoặc nộp)
[Server: server.ts / dailyReportService.ts]
       │ (Kiểm tra ngày báo cáo, tính toán submission_status: 'on_time' hoặc 'late')
       ▼
[Database: Supabase PostgreSQL]
       ├──> [Bảng daily_reports & daily_report_items]
       │
       ▼ (Manager Review: POST /api/daily-reports/:id/review)
[Manager UI]
```

---

## 4. Các Bảng Cơ sở Dữ liệu Liên quan

- `daily_reports`: Bảng chính lưu báo cáo ngày (`id`, `user_id`, `unit_id`, `report_date`, `status`: `draft`/`submitted`/`approved`/`rejected`, `submission_status`: `on_time`/`late`/`missing`, `submitted_at`, `reviewer_id`, `review_comment`, `reviewed_at`).
- `daily_report_items`: Danh sách các đầu việc chi tiết trong ngày (`id`, `report_id`, `task_id`, `title`, `description`, `hours_spent`, `completion_percentage`, `challenges`).
- `reminder_logs`: Nhật ký các lượt gửi thông báo nhắc nhở nộp báo cáo.

---

## 5. Quyền Xem / Ghi & Phạm vi Dữ liệu

| Thao tác | Executive | Admin | Manager | Staff |
| :--- | :---: | :---: | :---: | :---: |
| Xem báo cáo ngày | Toàn trường | Toàn hệ thống | Nhân viên trong đơn vị | Bản thân |
| Tạo / Nộp báo cáo | - | Có quyền | Có quyền | Có quyền (Bản thân) |
| Duyệt / Nhận xét báo cáo | Có quyền | Có quyền | Có quyền (Đơn vị) | - |
| Gửi nhắc nhở thiếu báo cáo | - | Có quyền | Có quyền (Đơn vị) | - |

---

## 6. Tích hợp Ngoại vi & Tác vụ Nền
- **Gemini AI**: Tổng hợp tóm tắt báo cáo đội ngũ và hỗ trợ hoàn thiện văn phong báo cáo.
- **Tác vụ nền**: Logic kiểm tra hạn chót nộp báo cáo (quy định trước 17:30 hoặc 23:59 cùng ngày) được xử lý tự động khi gửi request nộp.
