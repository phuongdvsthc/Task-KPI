INSERT INTO ai_prompt_definitions (id, prompt_key, name, description, feature_group, enabled)
VALUES (
    gen_random_uuid(),
    'kpi.staff_summary',
    'Staff KPI Summary',
    'Summarizes KPI for a staff member',
    'kpi',
    TRUE
) ON CONFLICT (prompt_key) DO NOTHING;

DO $$ 
DECLARE 
    v_def_id UUID;
BEGIN
    SELECT id INTO v_def_id FROM ai_prompt_definitions WHERE prompt_key = 'kpi.staff_summary';
    
    INSERT INTO ai_prompt_versions (
        id, 
        prompt_definition_id, 
        version_number, 
        status, 
        system_prompt, 
        user_prompt_template, 
        output_mode, 
        response_schema
    )
    VALUES (
        gen_random_uuid(),
        v_def_id,
        1,
        'active',
        'Bạn là trợ lý AI phân tích KPI cho nhân viên (Staff). 
Quy tắc phân tích:
1. LUÔN trả lời bằng tiếng Việt.
2. CHỈ sử dụng dữ liệu KPI được cung cấp trong biến {{kpi_context}}. Không bịa đặt hoặc suy đoán số liệu.
3. PHÂN BIỆT rõ "live" (kết quả hiện tại) và "official" (kết quả chính thức, đã khoá). Không trộn lẫn hoặc nhầm lẫn giữa chúng.
4. KHÔNG tự tính toán điểm số (không tự tính achievement %, raw score, weighted score). Nếu thiếu achievement %, giữ nguyên là không có, không tự tính từ target và actual.
5. Thiếu Actual không có nghĩa là 0 hay thất bại (Failed). Nó chỉ là "Chưa có dữ liệu Actual".
6. Chưa chấm điểm (not_scored) không có nghĩa là 0 điểm. Nó chỉ là "Chưa được chấm điểm".
7. Điểm bộ phận (partial) phải ghi rõ là partial, không coi là điểm cuối cùng hoàn chỉnh.
8. KHÔNG xếp hạng nhân viên, KHÔNG chấm điểm hiệu suất AI, KHÔNG nhận xét về năng lực, thái độ, nỗ lực hay tâm lý. Phân tích phải hoàn toàn khách quan dựa trên sự thật (factual).
9. Mọi đánh giá "vượt target", "chưa đạt", hoặc "khoảng cách tới target" phải dựa trên các con số có thực trong context. 
10. KHÔNG đề xuất thay đổi Target, thay đổi KPI, gửi Review, duyệt Review, hoặc tạo Task/Report. Action (hành động đề xuất) phải bảo thủ (ví dụ: "Tiếp tục theo dõi", "Kiểm tra dữ liệu Actual").
11. Trả về kết quả bằng JSON chuẩn theo response_schema (summary, highlights, issues, actions).
12. evidence ID (assignmentId, assignmentItemId) phải chính xác từ dữ liệu cung cấp, không bịa ID. scoreMode phải là "live" hoặc "official" tương ứng.

Cấu trúc đầu ra:
- summary: 2-5 câu tóm tắt nhanh tình trạng (ví dụ số KPI, số KPI live/official, cái nào đã hoàn thành, cái nào thiếu actual).
- highlights: Danh sách các KPI có điểm sáng (ví dụ: đạt target).
- issues: Danh sách các vấn đề cần lưu ý (thiếu actual, khoảng cách xa target).
- actions: Đề xuất hành động tiếp theo.',
        '{{kpi_context}}',
        'structured',
        '{
          "type": "object",
          "properties": {
            "summary": { "type": "string" },
            "highlights": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "text": { "type": "string" },
                  "evidence": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "type": { "type": "string", "enum": ["kpi_item", "kpi_assignment"] },
                        "assignmentId": { "type": "string" },
                        "assignmentItemId": { "type": "string" },
                        "kpiDefinitionId": { "type": "string" },
                        "kpiName": { "type": "string" },
                        "periodId": { "type": "string" },
                        "scoreMode": { "type": "string", "enum": ["live", "official"] }
                      }
                    }
                  }
                }
              }
            },
            "issues": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "text": { "type": "string" },
                  "evidence": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "type": { "type": "string", "enum": ["kpi_item", "kpi_assignment"] },
                        "assignmentId": { "type": "string" },
                        "assignmentItemId": { "type": "string" },
                        "kpiDefinitionId": { "type": "string" },
                        "kpiName": { "type": "string" },
                        "periodId": { "type": "string" },
                        "scoreMode": { "type": "string", "enum": ["live", "official"] }
                      }
                    }
                  }
                }
              }
            },
            "actions": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "text": { "type": "string" },
                  "actionType": { "type": "string", "enum": ["explicit", "suggested"] },
                  "evidence": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "type": { "type": "string", "enum": ["kpi_item", "kpi_assignment"] },
                        "assignmentId": { "type": "string" },
                        "assignmentItemId": { "type": "string" },
                        "kpiDefinitionId": { "type": "string" },
                        "kpiName": { "type": "string" },
                        "periodId": { "type": "string" },
                        "scoreMode": { "type": "string", "enum": ["live", "official"] }
                      }
                    }
                  }
                }
              }
            }
          },
          "required": ["summary", "highlights", "issues", "actions"]
        }'::jsonb
    ) ON CONFLICT (prompt_definition_id, version_number) DO NOTHING;
END $$;
