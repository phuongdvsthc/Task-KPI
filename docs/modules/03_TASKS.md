# TÀI LIỆU KỸ THUẬT: MODULE QUẢN LÝ CÔNG VIỆC (TASKS)

---

## 1. Mục đích
Module **Quản lý Công việc** hỗ trợ giao việc, tiếp nhận, thực hiện, theo dõi tiến độ, nộp minh chứng và đánh giá hoàn thành công việc từ cấp trường xuống từng cán bộ giảng viên.

---

## 2. Màn hình & Chức năng Thực tế

### 2.1. Danh sách & Bảng Công việc (`TaskList.tsx`, `TaskDetail.tsx` - `/tasks`)
- **Đa chế độ xem (View Modes)**:
  - **Danh sách (List View)**: Hiển thị bảng chi tiết kèm bộ lọc đa năng.
  - **Kanban Board**: Phân nhóm công việc theo cột trạng thái (*Cần làm, Đang làm, Chờ duyệt, Hoàn thành, Đã hủy*), hỗ trợ kéo thả cập nhật trạng thái.
  - **Gantt / Timeline**: Trực quan hóa tiến độ theo thời gian bắt đầu và hạn chót.
- **Bộ lọc & Tìm kiếm**: Lọc theo Đơn vị, Trạng thái, Mức độ ưu tiên (*Thấp, Trung bình, Cao, Khẩn cấp*), Người giao, Người nhận và Khoảng thời gian.

### 2.2. Tạo & Giao việc (`TaskCreate.tsx`)
- Nhập tiêu đề, mô tả chi tiết, phân loại công việc, hạn chót (`due_date`), trọng số, đơn vị chủ trì và danh sách người thực hiện (`assignees`).
- Gán liên kết với chỉ tiêu KPI tương ứng nếu có.

### 2.3. Minh chứng & Hoàn thành (`TaskEvidenceModal.tsx`, `TaskAttachmentUploader.tsx`)
- Tải lên tệp đính kèm minh chứng kết quả công việc (PDF, Word, Excel, hình ảnh) lưu trữ tại Supabase Storage.
- Gửi yêu cầu nghiệm thu / duyệt hoàn thành đến người giao việc hoặc Quản lý đơn vị.
- Đánh giá chất lượng hoàn thành (Đúng hạn, Trễ hạn, Đạt/Không đạt).

### 2.4. Thông báo & Chỉ đạo Điều hành (`AnnouncementPublishModal.tsx`, `AnnouncementDeliveryDashboard.tsx`)
- Phát hành thông báo điều hành khẩn cấp tới toàn đơn vị hoặc toàn trường.
- Bảng giám sát tỷ lệ cán bộ đã mở xem và xác nhận tiếp nhận thông báo.

---

## 3. Luồng Dữ liệu (Data Flow)

```
[User Browser]
       │
       ▼ (GET / POST / PUT /api/tasks)
       ▼ (POST /api/tasks/:id/attachments)
[Server: server.ts / taskService.ts]
       │ (1. Kiểm tra quyền 'task.view', 'task.create', 'task.update')
       │ (2. Áp dụng Data Scope: Manager xem đơn vị, Staff xem công việc của mình)
       ├──> [Supabase Storage: Bucket 'task-attachments']
       └──> [PostgreSQL: bảng tasks, task_assignees, task_evidences, task_comments]
```

---

## 4. Các Bảng Cơ sở Dữ liệu Liên quan

- `tasks`: Thông tin cốt lõi của công việc (`id`, `title`, `description`, `status`, `priority`, `start_date`, `due_date`, `creator_id`, `unit_id`, `kpi_definition_id`, `completed_at`).
- `task_assignees`: Bảng liên kết nhiều-nhiều giữa công việc và danh sách nhân sự được giao việc.
- `task_evidences` & `task_attachments`: Danh sách tệp tin đính kèm và link minh chứng nghiệm thu.
- `task_comments`: Trao đổi, thảo luận nội bộ ngay trên từng đầu việc.
- `announcements` & `announcement_acknowledgments`: Dữ liệu thông báo chỉ đạo và nhật ký xác nhận đã đọc.

---

## 5. Quyền Xem / Ghi & Phạm vi Dữ liệu

| Thao tác | Executive | Admin | Manager | Staff |
| :--- | :---: | :---: | :---: | :---: |
| Xem danh sách công việc | Toàn trường | Toàn hệ thống | Đơn vị phụ trách | Công việc được giao / Tạo |
| Tạo mới công việc | Có quyền | Có quyền | Có quyền (Đơn vị) | Có quyền (Việc cá nhân) |
| Chỉnh sửa / Phân công lại | Có quyền | Có quyền | Có quyền (Đơn vị) | Chỉ sửa việc do mình tạo |
| Nộp minh chứng hoàn thành | - | Có quyền | Có quyền | Có quyền (Việc được giao) |
| Phê duyệt hoàn thành việc | Có quyền | Có quyền | Có quyền (Đơn vị) | - |
| Xóa công việc | Có quyền | Có quyền | Có quyền (Đơn vị) | Chỉ xóa việc cá nhân nháp |

---

## 6. Tích hợp Ngoại vi & Tác vụ Nền
- **Supabase Storage**: Quản lý upload/download file minh chứng và tài liệu hướng dẫn công việc.
- **ExcelJS**: Hỗ trợ xuất danh sách công việc theo bộ lọc ra định dạng file Excel.
- **Gemini AI (`TaskAIResultPanel.tsx`)**: Đề xuất phân rã nhiệm vụ lớn thành các đầu việc con (WBS).
