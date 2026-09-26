const fs = require('fs');
let code = fs.readFileSync('src/services/ai/aiPromptRegistry.ts', 'utf-8');

const overviewStart = code.indexOf("'executive.overview': {");
if (overviewStart !== -1) {
    let cleanCode = code.substring(0, overviewStart);
    // Remove the rogue `, 'executive.overview': {` from the end if it exists
    const beforeCommaIndex = cleanCode.lastIndexOf(',');
    if (cleanCode.substring(beforeCommaIndex).includes("'executive.overview'")) {
         cleanCode = cleanCode.substring(0, beforeCommaIndex);
    }
    
    // Check if expectedSchema of manager.unit_task_summary is closed.
    // It should end with `required: ["summary", "highlights", "issues", "actions"]`
    
    const requiredAction = 'required: ["summary", "highlights", "issues", "actions"]';
    const indexReqAction = cleanCode.lastIndexOf(requiredAction);
    if (indexReqAction !== -1) {
        cleanCode = cleanCode.substring(0, indexReqAction + requiredAction.length);
        cleanCode += `
    }
  },
  'executive.overview': {
    key: 'executive.overview',
    version: '1.0',
    purpose: 'Executive Overview',
    systemInstruction: \`Bạn là trợ lý AI cung cấp báo cáo tổng quan cho Ban Giám Hiệu (Executive/BGH).
Nhiệm vụ: Tóm tắt bức tranh toàn cảnh dựa trên dữ liệu báo cáo hằng ngày, công việc và KPI.

CÁC QUY TẮC BẮT BUỘC (CRITICAL INVARIANTS):
- Chỉ sử dụng dữ liệu được cung cấp trong Context.
- Tôn trọng ranh giới các module (Daily Report, Task, KPI).
- KHÔNG TỰ TÍNH TOÁN (no invented arithmetic).
- Thiếu Actual không có nghĩa là bằng 0 (Missing != Zero).
- Đồng thời ghi nhận không có nghĩa là nguyên nhân (Correlation != Causation).
- KPI chưa chốt (live) phản ánh hiện tại, KPI đã chốt (locked/official) là dữ liệu lịch sử không thay đổi.
- KHÔNG xếp hạng nhân viên (No employee ranking).
- KHÔNG đánh giá năng lực, thái độ hay đưa ra quyết định nhân sự (No HR decisions).
- Mọi Issue và Highlight phải có Evidence ID hợp lệ.

--- DỮ LIỆU ĐƯỢC CẤP QUYỀN:
{{context}}\`,
    expectedSchema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        highlights: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, evidence: { type: "array", items: { type: "string" } }, moduleTags: { type: "array", items: { type: "string" } } } } },
        issues: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, evidence: { type: "array", items: { type: "string" } }, moduleTags: { type: "array", items: { type: "string" } } } } },
        followUps: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, type: { type: "string", enum: ["explicit", "suggested"] }, evidence: { type: "array", items: { type: "string" } } } } }
      },
      required: ["summary", "highlights", "issues", "followUps"]
    }
  },
  'executive.unit_summary': {
    key: 'executive.unit_summary',
    version: '1.0',
    purpose: 'Executive Unit Summary',
    systemInstruction: \`Bạn là trợ lý AI cung cấp báo cáo tổng quan cấp Đơn vị (Unit) cho Ban Giám Hiệu (Executive/BGH).
Nhiệm vụ: Tóm tắt bức tranh toàn cảnh của Đơn vị được chọn dựa trên dữ liệu báo cáo hằng ngày, công việc và KPI.

CÁC QUY TẮC BẮT BUỘC (CRITICAL INVARIANTS):
- Chỉ sử dụng dữ liệu được cung cấp trong Context, thuộc phạm vi Đơn vị đang xét.
- Tôn trọng các ngữ nghĩa về cây phòng ban (descendant semantics).
- Tôn trọng ranh giới các module (Daily Report, Task, KPI).
- Tôn trọng các chu kỳ báo cáo khác nhau (different period semantics).
- KHÔNG TỰ TÍNH TOÁN (no invented arithmetic/counts).
- KPI chưa chốt (live) phản ánh hiện tại, KPI đã chốt (locked/official) là dữ liệu lịch sử.
- KHÔNG xếp hạng đơn vị (no unit ranking).
- KHÔNG xếp hạng nhân viên (no employee ranking).
- KHÔNG đánh giá năng lực, thái độ hay đưa ra quyết định nhân sự (no HR judgment).
- Mọi Issue và Highlight phải có Evidence ID hợp lệ.

--- DỮ LIỆU ĐƯỢC CẤP QUYỀN:
{{context}}\`,
    expectedSchema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        highlights: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, evidence: { type: "array", items: { type: "string" } }, moduleTags: { type: "array", items: { type: "string" } } } } },
        issues: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, evidence: { type: "array", items: { type: "string" } }, moduleTags: { type: "array", items: { type: "string" } } } } },
        followUps: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, type: { type: "string", enum: ["explicit", "suggested"] }, evidence: { type: "array", items: { type: "string" } } } } }
      },
      required: ["summary", "highlights", "issues", "followUps"]
    }
  }
};
`;
        fs.writeFileSync('src/services/ai/aiPromptRegistry.ts', cleanCode);
    }
}
