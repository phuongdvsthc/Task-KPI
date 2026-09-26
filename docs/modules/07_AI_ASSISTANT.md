# TÀI LIỆU KỸ THUẬT: PHÂN HỆ TRỢ LÝ TRÍ TUỆ NHÂN TẠO (AI ASSISTANT)

---

## 1. Mục đích
Phân hệ **Trợ lý Trí tuệ Nhân tạo (AI Assistant)** tích hợp mô hình ngôn ngữ lớn Google Gemini AI nhằm hỗ trợ cán bộ, quản lý và lãnh đạo nhà trường tra cứu quy chế nội bộ (RAG), tự động hóa soạn thảo báo cáo, phân tích hiệu suất công việc và gợi ý giải pháp nâng cao hiệu quả tuyển sinh và KPI.

---

## 2. Màn hình & Chức năng Thực tế

### 2.1. Giao diện Chat Trợ lý AI (`AIAssistantView.tsx` - `/ai`)
- **Khung hội thoại đa lượt (`AIAssistantMessageList.tsx`, `AIAssistantComposer.tsx`)**:
  - Giao tiếp tự nhiên bằng tiếng Việt.
  - Hỗ trợ định dạng Markdown, danh sách, bảng biểu và khối trích dẫn nguồn tài liệu.
- **Trích dẫn nguồn tri thức (`AIAssistantSourcesList.tsx`)**: Hiển thị chính xác tên văn bản, điều khoản quy chế nội bộ mà AI đã căn cứ để đưa ra câu trả lời.
- **Quản lý phiên trò chuyện (`AIAssistantSidebar.tsx`)**: Lưu lịch sử các đoạn hội thoại theo người dùng, cho phép tạo phiên mới hoặc xóa phiên cũ.

### 2.2. Quản trị Kho Tri thức AI (`KnowledgeManagementView.tsx`, `KnowledgeUploadModal.tsx` - `/admin/settings/ai-knowledge`)
- Tải lên các tài liệu quy chế, quy định thi đua khen thưởng, tiêu chí chấm KPI, cẩm nang tuyển sinh (PDF, DOCX, TXT).
- Xem chi tiết phân đoạn tri thức (chunks) và tình trạng xử lý indexing.

### 2.3. Cấu hình Prompt & Giám sát Sử dụng (`AiSettingsView.tsx`, `AiUsageAuditView.tsx` - `/admin/settings/ai`)
- **Kho Prompt chuẩn (`AiPromptRegistryView.tsx`)**: Quản trị danh mục hệ thống System Prompt cho từng chức năng (Tóm tắt báo cáo, Phân rã công việc, Đánh giá KPI).
- **Thống kê sử dụng**: Đo lường tổng số token tiêu thụ, số lượng request và độ trễ phản hồi của API Gemini.

---

## 3. Luồng Dữ liệu (Data Flow)

```
[User Chat UI]
       │
       ▼ (POST /api/ai/chat { message, conversationId, context })
[Server: server.ts / aiService.ts]
       │
       │ (1. Xác thực quyền 'ai.assistant.use')
       │ (2. Tra cứu RAG từ bảng ai_knowledge_documents trong Supabase)
       │ (3. Gửi System Prompt + Context + Message đến Gemini API)
       ▼
[Google Gemini AI API (@google/genai)]
       │
       ▼ (Response text + citations)
[Server: Lưu hội thoại vào bảng ai_conversations, ai_messages]
       │
       ▼ (Trả JSON về Client)
[User Chat UI]
```

---

## 4. Các Bảng Cơ sở Dữ liệu Liên quan

- `ai_conversations`: Phiên hội thoại của người dùng (`id`, `user_id`, `title`, `created_at`, `updated_at`).
- `ai_messages`: Từng tin nhắn trong phiên (`id`, `conversation_id`, `sender`: `user`/`assistant`, `content`, `sources`, `created_at`).
- `ai_knowledge_documents`: Tài liệu tri thức nội bộ (`id`, `title`, `category`, `file_url`, `content_text`, `is_active`).
- `ai_prompt_registry`: Danh mục system prompts cho các tác vụ AI.
- `ai_usage_logs`: Nhật ký tiêu thụ token và chi phí API.

---

## 5. Quyền Xem / Ghi & Phạm vi Dữ liệu

| Thao tác | Executive | Admin | Manager | Staff |
| :--- | :---: | :---: | :---: | :---: |
| Trò chuyện với Trợ lý AI | Có quyền | Có quyền | Có quyền | Có quyền |
| Xem lịch sử hội thoại cá nhân | Bản thân | Bản thân | Bản thân | Bản thân |
| Quản trị kho tài liệu tri thức | Xem | Toàn quyền | - | - |
| Cấu hình Prompt & Xem thống kê Token | - | Toàn quyền | - | - |

---

## 6. Tích hợp Ngoại vi & Tác vụ Nền
- **Google Gemini AI SDK (`@google/genai`)**: Thực thi server-side proxy để bảo vệ khóa API.
- **Supabase Storage**: Lưu trữ file tài liệu PDF/Word tải lên phục vụ trích xuất tri thức.
- **Tác vụ nền**: Không có hàng đợi nền phức tạp; xử lý streaming/đồng bộ trực tiếp theo request.
