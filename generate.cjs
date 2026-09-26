const fs = require('fs');
const prompts = require('./extracted.json');

let out = `import { AIPromptDefinition } from '../../types/ai';

const staffRules = \`- Chỉ sử dụng dữ liệu được cung cấp trong Context.
- Không tự bịa đặt tiến độ, trạng thái hay số liệu.
- Phân biệt rõ việc ĐÃ hoàn thành (có xác nhận) và ĐANG làm.
- Cảnh báo các công việc/báo cáo quá hạn (overdue).
- Nhận diện các vấn đề/rủi ro được người dùng nêu ra.\`;

const teamRules = \`- Tóm tắt tổng quan tình trạng của toàn nhóm.
- Làm nổi bật các cá nhân/công việc có tiến độ xuất sắc.
- Tập trung vào các nút thắt (bottlenecks), rủi ro, hoặc các công việc đang quá hạn.
- Đề xuất các hành động quản lý cụ thể.\`;

const unitRules = \`- Cung cấp cái nhìn toàn cảnh về tình hình hoạt động của Đơn vị.
- Nhận diện xu hướng chung (hoàn thành tốt, chậm trễ, rủi ro diện rộng).
- Chỉ ra các vấn đề nghiêm trọng cần sự can thiệp của Quản lý cấp cao.
- Không đi sâu vào chi tiết nhỏ nhặt của một cá nhân nếu không phải là rủi ro lớn.\`;

export const aiPromptRegistry: Record<string, AIPromptDefinition> = {
`;

prompts.forEach((p, index) => {
    let schemaStr = '';
    
    // Determine evidence schema based on key
    let evProps = '';
    if (p.key.startsWith('kpi')) {
        evProps = `{ type: { type: "string" }, assignmentId: { type: "string" }, assignmentItemId: { type: "string" }, kpiDefinitionId: { type: "string" }, kpiName: { type: "string" }, periodId: { type: "string" }, scoreMode: { type: "string" } }`;
    } else if (p.key.startsWith('daily_report')) {
        evProps = `{ type: { type: "string" }, dailyReportId: { type: "string" }, reportDate: { type: "string" } }`;
    } else if (p.key.startsWith('task')) {
        evProps = `{ type: { type: "string" }, taskId: { type: "string" }, dueDate: { type: "string" } }`;
    } else if (p.key.startsWith('executive')) {
        evProps = `{ type: "string" }`; // Executive uses flat strings
    }
    
    if (p.key.startsWith('executive')) {
        schemaStr = `{
      type: "object",
      properties: {
        summary: { type: "string" },
        highlights: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, evidence: { type: "array", items: ${evProps} }, moduleTags: { type: "array", items: { type: "string" } } } } },
        issues: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, evidence: { type: "array", items: ${evProps} }, moduleTags: { type: "array", items: { type: "string" } } } } },
        followUps: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, type: { type: "string", enum: ["explicit", "suggested"] }, evidence: { type: "array", items: ${evProps} } } } }
      },
      required: ["summary", "highlights", "issues", "followUps"]
    }`;
    } else {
        // Module summaries
        let summaryDesc = 'Tóm tắt ngắn gọn 1-2 câu';
        
        let riskType = '';
        if (p.key.startsWith('task')) {
             riskType = `, riskType: { type: "string", enum: ["overdue", "attention"] }`;
        }
        
        schemaStr = `{
      type: "object",
      properties: {
        summary: { type: "string", description: "${summaryDesc}" },
        highlights: { type: "array", items: { type: "object", properties: { text: { type: "string" }${riskType}, evidence: { type: "array", items: { type: "object", properties: ${evProps} } } } } },
        issues: { type: "array", items: { type: "object", properties: { text: { type: "string" }${riskType}, evidence: { type: "array", items: { type: "object", properties: ${evProps} } } } } },
        actions: { type: "array", items: { type: "object", properties: { text: { type: "string" }, actionType: { type: "string", enum: ["explicit", "suggested"] }, evidence: { type: "array", items: { type: "object", properties: ${evProps} } } } } }
      },
      required: ["summary", "highlights", "issues", "actions"]
    }`;
    }

    let objKey = p.objKey ? p.objKey : `'${p.key}'`;

    out += `  ${objKey}: {
    key: '${p.key}',
    version: '${p.version}',
    purpose: '${p.purpose}',
    systemInstruction: \`${p.systemInstruction}\`,
    expectedSchema: ${schemaStr}
  }${index < prompts.length - 1 ? ',' : ''}
`;
});

out += `};
`;

fs.writeFileSync('src/services/ai/aiPromptRegistry.ts', out);
