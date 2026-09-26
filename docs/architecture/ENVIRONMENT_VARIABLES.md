# DANH MỤC BIẾN MÔI TRƯỜNG (ENVIRONMENT VARIABLES)

Tài liệu này liệt kê danh sách toàn bộ các biến môi trường được ứng dụng sử dụng, mục đích và phạm vi sử dụng.  
*(Lưu ý: Tài liệu tuyệt đối không chứa khóa bảo mật hay giá trị nhạy cảm).*

---

## 1. Biến Môi trường Frontend (Client-side / Vite)

Các biến này bắt đầu bằng tiền tố `VITE_` và được nạp vào client bundle trong quá trình build Vite.

| Tên biến | Mục đích sử dụng | Bắt buộc |
| :--- | :--- | :---: |
| `VITE_SUPABASE_URL` | Địa chỉ URL endpoint của dự án Supabase Backend. | **Có** |
| `VITE_SUPABASE_ANON_KEY` | Khóa công khai (Public Anonymous Key) để xác thực các yêu cầu phía Client với Supabase. | **Có** |
| `VITE_API_URL` | Địa chỉ base URL của API server Express (mặc định để trống khi dùng proxy cục bộ). | Không |

---

## 2. Biến Môi trường Backend (Server-side)

Các biến này chỉ được đọc từ phía máy chủ Node.js (`process.env`) và **tuyệt đối không được gửi về trình duyệt**.

| Tên biến | Mục đích sử dụng | Bắt buộc |
| :--- | :--- | :---: |
| `PORT` | Cổng mạng máy chủ Express lắng nghe (mặc định `3000`). | Không |
| `SUPABASE_URL` | Địa chỉ URL endpoint Supabase dùng cho kết nối backend service. | **Có** |
| `SUPABASE_SERVICE_ROLE_KEY` | Khóa đặc quyền Service Role của Supabase để thực hiện các thao tác quản trị (bỏ qua RLS khi cần thiết). | **Có** |
| `GEMINI_API_KEY` | Khóa API của Google Gemini để cung cấp năng lực AI cho Trợ lý AI và phân tích dữ liệu. | **Có** |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | Email Service Account để kết nối Google Sheets API cho phân hệ Tuyển sinh. | Không |
| `GOOGLE_SHEETS_PRIVATE_KEY` | Khóa riêng Service Account để ký xác thực kết nối Google Sheets API. | Không |
| `NODE_ENV` | Môi trường thực thi của ứng dụng (`development` / `production`). | Không |

---

## 3. Tệp Cấu hình Mẫu (`.env.example`)

Ứng dụng cung cấp tệp `.env.example` làm khung mẫu chuẩn cho việc triển khai:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# AI & Gemini API
GEMINI_API_KEY=your-gemini-api-key-here

# Server Port
PORT=3000
```
