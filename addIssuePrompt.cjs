const fs = require('fs');
let code = fs.readFileSync('src/services/ai/aiPromptRegistry.ts', 'utf-8');

const newPrompt = `  'executive.cross_module_issues': {
    key: 'executive.cross_module_issues',
    version: '1.0',
    purpose: 'Executive Cross-Module Issue Association',
    systemInstruction: \`Bạn là trợ lý phân tích dữ liệu cho Ban Giám Hiệu.
Nhiệm vụ: Liên kết các vấn đề (issues) thực tế (đã được trích xuất sẵn từ Báo cáo, Công việc, KPI) nếu chúng thực sự có chung nội dung hoặc liên kết dữ liệu, nhằm gom nhóm các vấn đề bị trùng lặp hoặc có quan hệ rõ ràng.

CÁC QUY TẮC BẮT BUỘC (CRITICAL INVARIANTS):
1. KHÔNG tự tạo ra vấn đề mới. Chỉ dùng danh sách các issue được cung cấp.
2. KHÔNG tự tạo mã evidence mới.
3. KHÔNG tự suy diễn quan hệ nhân quả (causation) giữa các vấn đề (ví dụ: cấm nói "Vì Task A quá hạn nên KPI B giảm"). Chỉ được dùng các quan hệ: same_business_item, explicit_reference, related_context, co_occurrence.
4. KHÔNG chấm điểm rủi ro (risk/severity score), KHÔNG xếp hạng nhân viên/phòng ban.
5. KHÔNG đưa ra đánh giá năng lực nhân sự (HR judgment).
6. Gom nhóm các issues thực sự nói về cùng một sự việc (Deduplication). Nếu độc lập, giữ chúng là các nhóm riêng lẻ.
7. Giải thích (explanation) bằng tiếng Việt trung lập, khách quan (ví dụ: "có liên quan về nội dung", "được liên kết trong dữ liệu").\`,
    expectedSchema: {
      type: "object",
      properties: {
        issueGroups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              groupId: { type: "string" },
              title: { type: "string" },
              categories: { type: "array", "items": { type: "string" } },
              modules: { type: "array", "items": { type: "string" } },
              issueIds: { type: "array", "items": { type: "string" } },
              evidence: { type: "array", "items": { type: "string" } },
              relationshipType: { type: "string", enum: ["same_business_item", "explicit_reference", "related_context", "co_occurrence", "single_issue"] },
              explanation: { type: "string" }
            },
            required: ["groupId", "title", "categories", "modules", "issueIds", "evidence", "relationshipType", "explanation"]
          }
        }
      },
      required: ["issueGroups"]
    }
  },`;

code = code.replace(
  `'executive.unit_summary': {`,
  newPrompt + `\n  'executive.unit_summary': {`
);

fs.writeFileSync('src/services/ai/aiPromptRegistry.ts', code);
