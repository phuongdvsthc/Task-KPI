# TÀI LIỆU KỸ THUẬT: MODULE TỔNG QUAN / DASHBOARD

---

## 1. Mục đích
Phân hệ **Tổng quan / Dashboard** là trung tâm chỉ huy số của hệ thống Work + KPI, cung cấp cái nhìn trực quan, đa chiều và theo thời gian thực về tình hình vận hành toàn trường, hiệu suất công việc, tỷ lệ nộp báo cáo và kết quả thực hiện chỉ tiêu KPI.

---

## 2. Màn hình & Chức năng Thực tế theo Vai trò

Màn hình được điều phối tự động dựa trên vai trò hệ thống (`system_role`):

### 2.1. Ban Giám hiệu (`ExecutiveDashboardView.tsx` - `/executive` hoặc `/dashboard`)
- **Bộ lọc chu kỳ & phạm vi**: Lọc theo chu kỳ báo cáo (tuần, tháng, quý, năm) và chế độ xem toàn trường hoặc lọc theo từng khối đơn vị.
- **Thẻ tóm tắt tổng quan (Summary Cards)**:
  - Tỷ lệ hoàn thành công việc toàn trường (%).
  - Tỷ lệ nộp báo cáo hằng ngày đúng hạn toàn trường (%).
  - Điểm KPI trung bình toàn trường.
  - Tiến độ tuyển sinh so với chỉ tiêu năm.
- **Biểu đồ xu hướng vận hành (`TrendCharts.tsx`)**: Biểu đồ đường/cột thể hiện biến động tỷ lệ hoàn thành công việc và tỷ lệ nộp báo cáo qua các tuần/tháng.
- **Bảng so sánh chéo đơn vị (`UnitComparisonCharts.tsx`)**: Ma trận xếp hạng và so sánh hiệu suất giữa các Khoa và Phòng ban.
- **Tích hợp Trợ lý AI Điều hành (`ExecutiveAIResultPanel.tsx`)**: Tóm tắt đánh giá tự động các điểm nghẽn và đưa ra khuyến nghị chỉ đạo điều hành.

### 2.2. Quản lý Đơn vị (`ManagerDashboardView.tsx` - `/manager` hoặc `/dashboard`)
- **Phạm vi đơn vị**: Cố định theo đơn vị quản lý (`primary_unit_id`) hoặc cho phép chuyển đổi giữa các đơn vị trực thuộc.
- **Giám sát đội ngũ (`teamMonitoringService`)**: Danh sách nhân viên trực thuộc, trạng thái nộp báo cáo hôm nay (Đã nộp, Chưa nộp, Nộp trễ).
- **Nhắc nhở nộp báo cáo (`MissingReportReminderModal.tsx`)**: Cho phép gửi thông báo nhắc nhở tức thì đến những nhân viên chưa nộp báo cáo ngày.
- **Biểu đồ phân bổ công việc**: Tỷ lệ công việc Đúng hạn, Quá hạn, Đang thực hiện trong đơn vị.

### 2.3. Giảng viên / Nhân viên (`StaffDashboardView.tsx` - `/staff` hoặc `/dashboard`)
- **Trọng tâm cá nhân**:
  - Danh sách công việc cần xử lý hôm nay và công việc sắp đến hạn.
  - Lịch theo dõi báo cáo ngày trong tháng (ngày đã nộp, ngày thiếu).
  - Điểm tự đánh giá và điểm duyệt KPI chu kỳ hiện tại.
- **Hành động nhanh**: Bấm vào ngày trên lịch để chuyển thẳng đến màn hình nhập báo cáo ngày.

### 2.4. Quản trị viên (`AdminDashboardView.tsx` - `/admin/dashboard`)
- Giám sát tình trạng tài khoản người dùng, hoạt động đăng nhập gần nhất, tình trạng lưu trữ tệp, dung lượng và nhật ký kiểm toán hệ thống.

---

## 3. Luồng Dữ liệu (Data Flow)

```
[User Browser]
       │
       ▼ (GET /api/dashboard/reporting-options)
       ▼ (GET /api/dashboard/executive-trends?period=...)
       ▼ (GET /api/dashboard/unit-comparison?period=...)
[Server: server.ts / dashboardTrendService / dashboardComparisonService]
       │
       │ (1. Xác thực JWT & Kiểm tra Data Scope)
       │ (2. Tổng hợp SQL từ tasks, daily_reports, kpi_assessments, units)
       ▼
[Database: Supabase PostgreSQL]
```

---

## 4. Các Bảng Cơ sở Dữ liệu Liên quan

- `units`: Danh mục đơn vị/phòng ban để nhóm và so sánh dữ liệu.
- `profiles`: Thông tin nhân sự và đơn vị trực thuộc.
- `tasks`: Dữ liệu công việc để tính tỷ lệ hoàn thành đúng hạn (`status = 'completed'` so với `due_date`).
- `daily_reports`: Dữ liệu báo cáo ngày để tính tỷ lệ tuân thủ báo cáo (`submission_status`).
- `kpi_assessments` & `kpi_assignments`: Dữ liệu điểm số KPI thực tế và trọng số.

---

## 5. Quyền Xem / Ghi & Phạm vi Dữ liệu

| Vai trò | Quyền xem | Phạm vi dữ liệu | Thao tác ghi được phép |
| :--- | :---: | :---: | :--- |
| **Executive** | Xem tất cả | `ALL` (Toàn trường) | Không (Chỉ đọc) |
| **Admin** | Xem tất cả | `ALL` (Hệ thống) | Cấu hình tham số dashboard |
| **Manager** | Xem đơn vị | `UNIT` (Đơn vị phụ trách) | Gửi nhắc nhở báo cáo (`MissingReportReminder`) |
| **Staff** | Xem cá nhân | `PERSONAL` (Bản thân) | Không (Chỉ đọc trên Dashboard) |

---

## 6. Tích hợp Ngoại vi & Tác vụ Nền

- **Recharts**: Thư viện dựng biểu đồ trực quan hóa dữ liệu phía Client.
- **Gemini AI**: Tóm tắt xu hướng và gợi ý điểm nghẽn điều hành.
- **Tác vụ nền**: Không có cron daemon độc lập; số liệu được tổng hợp động (on-the-fly) theo tham số request với cơ chế cache ngắn hạn.

---

## 7. Giới hạn & Điểm Lưu ý
- Khi chuyển đổi chu kỳ lọc (tuần sang tháng), thời gian phản hồi phụ thuộc vào số lượng bản ghi `tasks` và `daily_reports` trong kỳ; các chỉ mục (indexes) trên `unit_id`, `created_at`, `status` đã được thiết lập để tối ưu tốc độ truy vấn.
