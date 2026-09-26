import { aiContextService } from './aiContextService';
import { aiService } from './aiService';
import { AIConfigError } from '../../types/ai';
import { AIContextError } from '../../types/ai_errors';
import {
  KPIIntelligenceFeature,
  KPIIntelligenceRequest,
  KPIEvidenceRef,
  KPIIntelligenceResult,
  KPIInsightItem,
  KPIActionItem
} from '../../types/kpi-intelligence';

export type {
  KPIIntelligenceFeature,
  KPIIntelligenceRequest,
  KPIEvidenceRef,
  KPIIntelligenceResult,
  KPIInsightItem,
  KPIActionItem
};

export const PROHIBITED_RANKING_PATTERNS = [
  /top\s*\d+/i,
  /xếp hạng/i,
  /bảng xếp hạng/i,
  /leaderboard/i,
  /nhân viên (giỏi|tốt|yếu|kém|xuất sắc|thấp|cao|tệ) nhất/i,
  /nhân viên đứng đầu/i,
  /người (giỏi|tốt|yếu|kém|xuất sắc|thấp|cao|tệ) nhất/i,
  /(best|worst) employee/i,
  /(best|worst) performer/i,
  /unit (tốt|yếu|kém|xuất sắc|thấp|cao|tệ) nhất/i,
  /đơn vị (tốt|yếu|kém|xuất sắc|thấp|cao|tệ) nhất/i,
  /thi đua giữa các đơn vị/i,
  /thi đua/i,
  /ai performance score/i,
  /điểm hiệu suất ai/i,
  /điểm trung bình của team/i,
  /điểm trung bình toàn đội/i,
  /team average score/i
];

export const PROHIBITED_EMPLOYEE_FAILURE_PATTERNS = [
  /thất bại/i,
  /không hoàn thành nhiệm vụ/i,
  /kém cỏi/i,
  /yếu kém/i,
  /năng lực (kém|yếu|thấp|tệ)/i,
  /nhân viên (kém|yếu|thất bại|tệ)/i,
  /đạo đức|thái độ (kém|yếu|tệ)/i,
  /failed employee/i,
  /employee failure/i,
  // E4.4.60: no performance score
  /(điểm\s+hiệu\s+suất(\s+(cá\s+nhân|nhân\s+viên|ai))?|performance\s+score)/i,
  // E4.4.61: no productivity score
  /(productivity\s+score|điểm\s+năng\s+suất)/i,
  // E4.4.62: no competence inference
  /(năng\s+lực\s+(chuyên\s+môn|kém|yếu|thấp|tệ)|thiếu\s+năng\s+lực|incompetent|lacks?\s+competence)/i,
  // E4.4.63: no attitude inference
  /(đạo\s+đức|thái\s+độ|ý\s+thức\s+chấp\s+hành|thiếu\s+nhiệt\s+tình|poor\s+attitude)/i,
  // E4.4.64: no motivation inference
  /(động\s+lực\s+(làm\s+việc|của\s+nhân\s+sự)|lack\s+of\s+motivation|unmotivated|thiếu\s+động\s+lực)/i
];

export const PROHIBITED_RISK_PATTERNS = [
  // Predictive failure / probability / forecast
  /(nguy cơ|khả năng|xác suất|dự báo|dự đoán)\s+(thất bại|không đạt|hỏng|trượt|không hoàn thành|bị hụt)/i,
  /(chắc chắn sẽ không đạt|sẽ không thể về đích|khó lòng đạt được|gần như không thể đạt)/i,
  /(likely to fail|will not achieve|high chance of missing|probability of failure|forecasted to fail)/i,
  /(xác\s+suất|tỷ\s+lệ|khả\s+năng)\s+(đạt|thành\s+công|thất\s+bại|rủi\s+ro)/i,
  /tỷ\s+lệ\s+rủi\s+ro/i,
  /(\d+%\s+chance|probability\s+of|chance\s+of\s+(failure|success))/i,

  // Employee risk / staff risk / performance risk / AI rating / risk scores
  /(nhân viên|nhân sự|cá nhân|người lao động)[^.,;!?\n]*\brủi ro/i,
  /rủi ro[^.,;!?\n]*(nhân sự|nhân viên|hiệu suất|năng lực|đội ngũ|cá nhân)/i,
  /(employee|staff|personnel|workforce|performance)\s+risk/i,
  /(risk score|employee risk score|performance risk score|điểm rủi ro)/i,
  /(ai rating|ai risk rating|đánh giá rủi ro nhân sự|xếp loại rủi ro)/i,

  // Team / unit / department risk / weak team
  /(team|nhóm|đơn vị|phòng ban|bộ phận)[^.,;!?\n]*\brủi ro/i,
  /rủi ro[^.,;!?\n]*(nhóm|team|đơn vị|phòng ban|bộ phận)/i,
  /(team|unit|department)\s+risk/i,
  /(weak team|nhóm yếu kém|phòng ban yếu kém|đơn vị yếu kém|đội ngũ yếu)/i,

  // High / medium / low / critical invented severity
  /(mức độ|mức|cấp độ)\s+(rủi ro|nguy cơ)\s*(cao|trung bình|thấp|nghiêm trọng)/i,
  /(rủi ro|nguy cơ)\s*(mức độ|mức|cấp độ)?\s*(cao|trung bình|thấp|nghiêm trọng)/i,
  /(high|medium|low|critical)\s+risk/i,
  /(high|medium|low|critical)\s+severity/i,

  // Trend claims without authorized time-series data
  /(xu hướng|chiều hướng)\s+(đi xuống|tụt dốc|xấu đi|tốt lên|cải thiện|suy giảm)/i,
  /(đang ngày càng|ngày càng)\s+(kém|xấu|tụt|giảm sút)/i,
  /(declining|improving|getting worse)\s+trend/i,
  /(on track|off track|đúng tiến độ|chệch tiến độ)/i
];

export const PROHIBITED_ACTION_PATTERNS = [
  // 1. Target change / weight adjustment
  /(hạ|giảm|tăng|nâng|thay đổi|điều chỉnh|sửa|chỉnh sửa)\s*(mục tiêu|chỉ tiêu|target|trọng số|weight)/i,
  /(lower|reduce|increase|raise|adjust|change|modify)\s*(the\s*)?(target|weight)/i,
  /(điều chỉnh|thay đổi)\s+(kế hoạch|phân bổ|giao lại)\s*(target|chỉ tiêu)/i,

  // 2. Score override / manual scoring
  /(ghi đè|áp đặt|nhập tay|chấm lại|chỉnh sửa|thay đổi|sửa)\s*(lại\s*)?(điểm|score|phương pháp chấm|công thức chấm)/i,
  /(thay đổi|chọn lại)\s*(phương pháp chấm|công thức)/i,
  /(override|manually set|change scoring method|alter score)/i,

  // 3. Employee performance blame / discipline
  /(kỷ luật|khiển trách|cảnh cáo|xử phạt|chế tài|phạt|truy cứu)/i,
  /(discipline|penalize|punish)/i,

  // 4. Personnel change / replacement / transfer / firing
  /(sa thải|đuổi việc|thay thế nhân sự|thay nhân sự|thay đổi nhân sự|điều chuyển|thuyên chuyển|thay người phụ trách|bố trí lại nhân sự|thay thế nhân viên)/i,
  /(replace personnel|replace employee|fire employee|transfer employee)/i,

  // 5. Salary / bonus / compensation
  /(tăng|giảm|hạ|cắt|trừ)\s*(lương|thưởng|thu nhập|phụ cấp)/i,
  /(salary|wage|bonus)/i,

  // 6. HR evaluation / ranking / ratings / capacity assessment
  /(hạ\s+xếp\s+loại|xếp\s+loại\s+(thi\s+đua|kém|năng\s+lực|nhân\s+sự|nhân\s+viên|mức\s+[a-z0-9]+)|đánh\s+giá(\s+lại)?\s+năng\s+lực(\s+nhân\s+viên)?)/i,
  /(nhân viên|nhân sự)\s+(cần|phải)\s+(cải thiện|nâng cao)\s+(hiệu suất|năng lực)/i,
  /(cần cải thiện|nâng cao)\s+(hiệu suất|năng lực)\s+(của\s+)?(nhân viên|nhân sự)/i,

  // 7. Unsupported mandatory training
  /(bắt buộc|yêu cầu|tổ chức|cử đi)[^.,;!?\n]*(đào tạo|tập huấn|khóa học)|cử đi học/i,
  /(mandatory training|require training)/i,

  // 8. Cross-module side effects: Tasks, Notifications, Reviews, Assignments
  /(tạo|giao|thêm|khởi tạo)\s*(task|công việc|nhiệm vụ)\s*(mới|tự động)?/i,
  /(gửi|phát)\s*(thông báo|notification|tin nhắn|email)\s*(cho|tự động)?/i,
  /(tự động|trực tiếp)?\s*(phê duyệt|duyệt|từ chối|trả lại|khóa|mở khóa)\s*(bản\s+|kỳ\s+)?(đánh giá|review|kpi)/i,
  /(tạo|thêm)\s*(phân công|assignment)\s*kpi/i,
  /(create\s+(a\s+)?task|assign\s+(a\s+)?task|send\s+(a\s+)?notification|approve\s+(a\s+)?review|lock\s+(a\s+)?review|unlock\s+(a\s+)?review)/i,

  // 9. Generic consulting fluff
  /(tăng ngân sách|thuê tư vấn|tái cấu trúc|mời chuyên gia)/i
];

export const containsProhibitedContent = (text: string): boolean => {
  if (!text) return false;
  return PROHIBITED_RANKING_PATTERNS.some(p => p.test(text)) ||
         PROHIBITED_EMPLOYEE_FAILURE_PATTERNS.some(p => p.test(text)) ||
         PROHIBITED_RISK_PATTERNS.some(p => p.test(text));
};

export const containsProhibitedActionContent = (text: string): boolean => {
  if (!text) return false;
  return PROHIBITED_ACTION_PATTERNS.some(p => p.test(text));
};

export const normalizeKPIIntelligenceResult = (
  rawResult: any,
  validAssignmentIds: Set<string>,
  validItemIds: Set<string>,
  assignmentsById: Map<string, any>,
  options?: {
    feature?: string;
    actorRole?: string;
    truncatedContext?: boolean;
  }
): Pick<KPIIntelligenceResult, 'summary' | 'highlights' | 'issues' | 'actions'> => {
  if (!rawResult || typeof rawResult !== 'object' || Array.isArray(rawResult)) {
    const err: any = new Error('Invalid whole response from AI provider.');
    err.code = 'INVALID_RESPONSE';
    throw err;
  }

  const allAssignments = Array.from(assignmentsById.values());
  const allLive = allAssignments.length > 0 && allAssignments.every(a => a.resultMode === 'live');
  const allItemsList = allAssignments.flatMap(a => (Array.isArray(a.items) ? a.items : []));

  let summary = typeof rawResult.summary === 'string' ? rawResult.summary.trim() : '';
  if (summary) {
    const sentences = summary.split(/(?<=[.!?\n])\s+/);
    const safeSentences = sentences.filter((s: string) => {
      if (containsProhibitedContent(s)) return false;
      if (allLive && /kết quả chính thức|điểm chính thức|đã khóa|kết luận cuối cùng/i.test(s)) return false;
      if (options?.truncatedContext) {
        if (/(toàn bộ|tất cả|toàn thể)\s*(kpi|nhân viên|thành viên|đơn vị)/i.test(s) ||
            /(all|entire)\s*(kpi|kpis|employees|staff)/i.test(s) ||
            /(đầy đủ 100%|bao quát toàn bộ)/i.test(s)) {
          return false;
        }
      }
      return true;
    });
    summary = safeSentences.join(' ').trim();
  }

  const seenActionKeys = new Set<string>();

  const processItems = (items: any[], requireEvidence = false, isAction = false, category?: 'highlights' | 'issues' | 'actions'): any[] => {
    if (!Array.isArray(items)) return [];
    const resultItems: any[] = [];
    const seenTexts = new Set<string>();

    for (const item of items.slice(0, 10)) {
      if (!item || !item.text) continue;
      const text = String(item.text).substring(0, 500).trim();
      
      if (containsProhibitedContent(text)) continue;
      if (isAction && containsProhibitedActionContent(text)) continue;

      const lowerText = text.toLowerCase();
      if (seenTexts.has(lowerText)) continue;
      
      if (isAction) {
        const canonicalActionKey = lowerText.replace(/[.,;:!?\s]+/g, ' ').trim();
        if (seenActionKeys.has(canonicalActionKey)) continue;
      }

      const matchedItems: any[] = [];
      const matchedAssignments: any[] = [];

      const evidence: KPIEvidenceRef[] = Array.isArray(item.evidence)
        ? item.evidence
            .filter((e: any) => {
              if (!e || !validAssignmentIds.has(String(e.assignmentId))) return false;
              if (e.type === 'kpi_item') {
                return !!(e.assignmentItemId && validItemIds.has(String(e.assignmentItemId)));
              }
              return e.type === 'kpi_assignment';
            })
            .map((e: any) => {
              const matchedAssignment = assignmentsById.get(String(e.assignmentId));
              if (matchedAssignment) matchedAssignments.push(matchedAssignment);
              const assigneeLabel = matchedAssignment?.assigneeUserName || matchedAssignment?.assigneeUnitName || e.assigneeLabel;
              
              if (e.type === 'kpi_item') {
                const matchedItem = matchedAssignment?.items?.find((i: any) => String(i.assignmentItemId || i.id || i.assignment_item_id) === String(e.assignmentItemId));
                if (matchedItem) matchedItems.push(matchedItem);

                return {
                  type: 'kpi_item' as const,
                  assignmentId: String(e.assignmentId),
                  assignmentItemId: String(e.assignmentItemId),
                  periodId: matchedAssignment?.periodId || e.periodId,
                  assigneeLabel,
                  kpiDefinitionId: matchedItem?.kpiDefinitionId || e.kpiDefinitionId,
                  kpiName: matchedItem?.kpiName || e.kpiName,
                  scoreMode: matchedAssignment?.resultMode || e.scoreMode
                };
              }
              
              return {
                type: 'kpi_assignment' as const,
                assignmentId: String(e.assignmentId),
                periodId: matchedAssignment?.periodId || e.periodId,
                assigneeLabel,
                scoreMode: matchedAssignment?.resultMode || e.scoreMode
              };
            })
        : [];
      
      if (requireEvidence && evidence.length === 0) continue;

      // Fact-checking rule 1: Official wording on live data
      const isLiveOnly = matchedAssignments.length > 0 && matchedAssignments.every(a => a.resultMode === 'live');
      if (isLiveOnly && /kết quả chính thức|điểm chính thức|đã khóa|kết luận cuối cùng/i.test(text)) {
        continue;
      }

      // Fact-checking rule 2: Unsupported zero claims for missing actual
      if (matchedItems.length > 0) {
        const hasMissingActual = matchedItems.some(i => i.actual === null || i.actual === undefined);
        const hasZeroActual = matchedItems.some(i => i.actual === 0);
        if (hasMissingActual && !hasZeroActual && /(bằng 0|đạt 0|0 điểm|thất bại)/i.test(text)) {
          continue;
        }

        // Fact-checking rule 3: Unsupported failed / 0 score claims for unscored KPI
        const hasUnscored = matchedItems.some(i => i.scoringStatus === 'not_scored' || i.scoringStatus === 'invalid_target' || i.scoringStatus === 'invalid_config' || i.scoringStatus === 'unsupported_method');
        if (hasUnscored && /(0 điểm|thất bại|vi phạm)/i.test(text)) {
          continue;
        }

        // Fact-checking rule 4: AI claims KPI is unscored but context says all scored
        const allScored = matchedItems.every(i => i.scoringStatus === 'scored');
        if (allScored && /chưa (được )?chấm điểm|chưa có điểm/i.test(text)) {
          continue;
        }

        // Fact-checking rule 5: Issues claiming under-target/gap when actually achieved or exceeded
        if (category === 'issues') {
          const allAchieved = matchedItems.every(i => i.attainmentState === 'achieved' || i.attainmentState === 'exceeded' || (i.achievementPercent !== null && Number(i.achievementPercent) >= 100));
          if (allAchieved && /(chưa đạt|không đạt|khoảng cách|còn thiếu|thiếu hụt|thiếu|hụt|gap|chậm)/i.test(text)) {
            continue;
          }
        }

        // Fact-checking rule 6: Highlights claiming achieved when actually under-target or unscored
        if (category === 'highlights') {
          const allUnderOrUnscored = matchedItems.every(i => i.attainmentState === 'under_target' || i.scoringStatus !== 'scored' || i.actual === null);
          if (allUnderOrUnscored && /(đạt target|hoàn thành xuất sắc|vượt target|đạt mục tiêu)/i.test(text)) {
            continue;
          }
        }

        // Fact-checking rule 7: Invalid config / invalid target blaming employee
        const hasInvalidConfig = matchedItems.some(i => i.scoringStatus === 'invalid_target' || i.scoringStatus === 'invalid_config' || i.scoringStatus === 'unsupported_method');
        if (hasInvalidConfig && /do nhân viên|lỗi của nhân viên|nhân viên không/i.test(text)) {
          continue;
        }

        // Fact-checking rule 8: Locked/official KPI described as future or pending risk
        const isOfficialAssignment = matchedAssignments.length > 0 && matchedAssignments.every(a => a.resultMode === 'official' || a.status === 'locked');
        if (isOfficialAssignment && /(nguy cơ|rủi ro|chưa hoàn thành có nguy cơ|cần lưu ý về sau|đe dọa mục tiêu|khả năng không đạt)/i.test(text)) {
          continue;
        }

        // Fact-checking rule 9: Missing Actual, Unscored, or Partial claiming employee fault or performance failure
        const hasMissingOrUnscored = matchedItems.some(i => i.actual === null || i.scoringStatus !== 'scored');
        if (hasMissingOrUnscored && /(lỗi|trách nhiệm|sa sút|yếu kém|không hoàn thành|vi phạm)/i.test(text)) {
          continue;
        }

        // Fact-checking rule 10: Boolean KPI achieved claimed as gap or risk
        const isBooleanAchieved = matchedItems.some(i => i.measurementType === 'boolean' && (i.attainmentState === 'achieved' || i.attainmentState === 'exceeded'));
        if (isBooleanAchieved && /(còn thiếu|khoảng cách|gap|chưa đạt|rủi ro|nguy cơ)/i.test(text)) {
          continue;
        }
      }
      
      if (isAction) {
        // Staff action scope check: staff cannot issue manager directives to others
        if (options?.actorRole === 'staff' || options?.feature === 'staff_kpi_summary') {
          if (/(giao việc|đốc thúc|chỉ đạo|yêu cầu nhân viên|nhân sự cấp dưới)/i.test(text)) {
            continue;
          }
        }

        // Locked / official KPI check: immutable, cannot suggest changing target, actual, score, or re-evaluating
        const isLockedContext = matchedAssignments.length > 0
          ? matchedAssignments.every(a => a.resultMode === 'official' || a.status === 'locked')
          : allAssignments.length > 0 && allAssignments.every(a => a.resultMode === 'official' || a.status === 'locked');

        if (isLockedContext) {
          if (/(thay đổi|điều chỉnh|cập nhật|chấm lại|sửa|hạ|tăng|ghi đè)\s*(lại\s*)?(target|actual|điểm|score|mục tiêu)/i.test(text)) {
            continue;
          }
          if (/(đánh giá lại|tính lại|xét lại|xem xét lại kết quả)/i.test(text)) {
            continue;
          }
        }

        // Anti-injection / non-actionable command injection filter
        if (/(system_command|system:|auto_create|auto_send|command:|<script|prompt_injection)/i.test(text)) {
          continue;
        }

        // Organization KPI check: cannot blame individual employee
        const isOrgAssignment = matchedAssignments.some(a => a.assigneeType === 'organization' || a.organizationId) ||
          (matchedAssignments.length === 0 && allAssignments.some(a => a.assigneeType === 'organization'));
        if (isOrgAssignment && /(do nhân viên|lỗi của nhân viên|nhân viên phụ trách|trách nhiệm của nhân viên)/i.test(text)) {
          continue;
        }

        // Target items to verify factual support
        const targetItems = matchedItems.length > 0 ? matchedItems : allItemsList;

        // Healthy KPI check: do not force or allow problem-solving actions if everything is achieved, scored, and complete
        const isHealthyTarget = targetItems.length > 0 && targetItems.every(i =>
          (i.attainmentState === 'achieved' || i.attainmentState === 'exceeded' || (i.achievementPercent !== null && Number(i.achievementPercent) >= 100)) &&
          i.scoringStatus === 'scored' &&
          i.actual !== null &&
          i.actual !== undefined &&
          (i.gap === null || i.gap === undefined || Number(i.gap) === 0) &&
          i.scoringStatus !== 'invalid_config' &&
          i.scoringStatus !== 'invalid_target'
        );

        if (isHealthyTarget) {
          if (/(kiểm tra|rà soát|dữ liệu nguồn|chấm điểm|cấu hình|tiến độ|theo dõi|khoảng cách)/i.test(text)) {
            continue;
          }
        }

        // Factual domain validation for suggested actions
        const isRecognizedKPIAction =
          /(dữ liệu nguồn|nguồn dữ liệu|cập nhật actual|thiếu actual|thiếu số liệu|kiểm tra actual)/i.test(text) ||
          /(trạng thái chấm điểm|chưa được chấm|kpi chưa chấm|chưa chấm|chấm điểm)/i.test(text) ||
          /(tiến độ|theo dõi kết quả|khoảng cách|chưa đạt target)/i.test(text) ||
          /(cấu hình chấm điểm|cấu hình)/i.test(text) ||
          /(đối chiếu|xem xét|theo dõi|rà soát)/i.test(text);

        if (!isRecognizedKPIAction) {
          continue;
        }

        // Factual support checks for specific problem topics:
        if (/(dữ liệu nguồn|nguồn dữ liệu|cập nhật actual|thiếu actual|thiếu số liệu)/i.test(text)) {
          const hasMissingOrGap = targetItems.some(i => i.actual === null || i.actual === undefined || (i.gap !== null && Number(i.gap) > 0) || i.attainmentState === 'under_target');
          if (!hasMissingOrGap) continue;
        }

        if (/(cấu hình chấm điểm|cấu hình)/i.test(text)) {
          const hasInvalid = targetItems.some(i => i.scoringStatus === 'invalid_config' || i.scoringStatus === 'invalid_target' || i.scoringStatus === 'unsupported_method');
          if (!hasInvalid) continue;
        } else if (/(trạng thái chấm điểm|chưa (được )?chấm|tiến độ chấm)/i.test(text)) {
          const hasUnscored = targetItems.some(i => i.scoringStatus === 'not_scored' || i.scoringStatus === 'partial');
          if (!hasUnscored) continue;
        }

        if (/(chưa được chấm|kpi chưa chấm|bộ phận|chưa đầy đủ)/i.test(text)) {
          const hasPartialOrUnscored = targetItems.some(i => i.scoringStatus === 'partial' || i.scoringStatus === 'not_scored');
          if (!hasPartialOrUnscored) continue;
        }

        if (/(tiến độ|theo dõi kết quả( hiện tại)?|khoảng cách|chưa đạt target)/i.test(text)) {
          const hasGap = targetItems.some(i => i.attainmentState === 'under_target' || (i.gap !== null && Number(i.gap) > 0));
          if (!hasGap) continue;
        }

        const actionType = (item.actionType === 'explicit' || item.actionType === 'suggested')
           ? item.actionType
           : 'suggested';
        
        if (actionType === 'explicit' && evidence.length === 0) {
          continue;
        }

        const canonicalActionKey = lowerText.replace(/[.,;:!?\s]+/g, ' ').trim();
        seenActionKeys.add(canonicalActionKey);
        seenTexts.add(lowerText);

        resultItems.push({
          text,
          actionType,
          evidence
        });
        continue;
      }
      
      seenTexts.add(lowerText);
      resultItems.push({ text, evidence });
    }
    
    return resultItems;
  };

  return {
    summary,
    highlights: processItems(rawResult.highlights, true, false, 'highlights'),
    issues: processItems(rawResult.issues, true, false, 'issues'),
    actions: processItems(rawResult.actions, false, true, 'actions')
  };
};

export const kpiIntelligenceService = {
  async generate(supabaseAdmin: any, req: KPIIntelligenceRequest, actorId: string, actorRole: string): Promise<KPIIntelligenceResult> {
    const featureMap: Record<string, string> = {
      'staff_kpi_summary': 'kpi.staff_summary',
      'manager_team_kpi_summary': 'kpi.team_summary',
      'manager_unit_kpi_summary': 'kpi.unit_summary'
    };

    const featureKey = featureMap[req.feature] || req.feature;
    const promptKey = featureKey;

    // Authorization checks
    if (req.feature === 'staff_kpi_summary') {
      if (actorRole === 'staff') {
         // No spoofing
      }
    } else if (req.feature === 'manager_team_kpi_summary') {
      if (actorRole === 'staff') {
        throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Staff cannot request team summary.');
      }
    } else if (req.feature === 'manager_unit_kpi_summary') {
      if (actorRole === 'staff') {
        throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Staff cannot request unit summary.');
      }
      if (!req.unitId) {
        throw new AIContextError('AI_CONTEXT_INVALID_SCOPE', 'Unit Summary requires unitId.');
      }
    }

    // Build context
    const contextData = await aiContextService.buildContext(supabaseAdmin, {
      userId: actorId,
      unitId: req.unitId,
      periodId: req.periodId,
      modules: ['kpi'],
      featureKey: featureKey,
      ...{
        status: req.status
      }
    });

    const kpiSummary = contextData.data?.kpis?.summary || {};
    const assignmentCount = kpiSummary.assignmentCount || 0;
    const lockedCount = kpiSummary.lockedCount || 0;
    const liveCount = (kpiSummary.closedCount || 0) + (kpiSummary.activeCount || 0);
    const scoredCount = kpiSummary.scoredCount || 0;
    const unscoredCount = kpiSummary.unscoredCount || 0;
    
    let scopeLabel = req.feature === 'manager_team_kpi_summary' ? 'team' : (req.unitId ? 'unit' : 'self');

    let authoritativeUnitName: string | undefined = undefined;
    if (req.unitId) {
      const { data: uData } = await supabaseAdmin
        .from('organization_units')
        .select('name')
        .eq('id', req.unitId)
        .maybeSingle();
      if (uData?.name) {
        authoritativeUnitName = uData.name;
      }
    }

    const firstAssignment = contextData.data?.kpis?.assignments?.[0];
    const periodLabel = firstAssignment?.periodName || undefined;

    // Empty context fast path
    if (assignmentCount === 0) {
      return {
        summary: authoritativeUnitName 
          ? `Đơn vị "${authoritativeUnitName}" không có dữ liệu KPI phù hợp trong phạm vi đã chọn.`
          : "Không có dữ liệu KPI phù hợp trong phạm vi đã chọn.",
        highlights: [],
        issues: [],
        actions: [],
        metadata: {
          featureKey,
          promptKey,
          generatedAt: new Date().toISOString(),
          periodId: req.periodId,
          periodLabel,
          truncatedContext: false,
          unitId: req.unitId,
          unitName: authoritativeUnitName,
          scopeLabel,
          assignmentCount: 0,
          itemCount: 0,
          scoredCount: 0,
          unscoredCount: 0,
          lockedCount: 0,
          individualAssignmentCount: 0,
          organizationAssignmentCount: 0,
          liveCount: 0
        }
      };
    }

    let itemCount = 0;
    contextData.data.kpis.assignments.forEach((a: any) => {
        itemCount += (a.items?.length || 0);
    });

    const variables = {
      assignmentCount,
      itemCount,
      unitName: authoritativeUnitName || '',
      kpi_context: JSON.stringify({
        unitName: authoritativeUnitName,
        assignments: contextData.data.kpis.assignments
      })
    };

    try {
      const result = await aiService.execute(supabaseAdmin, {
        promptKey: promptKey,
        variables,
        context: contextData,
        userId: actorId,
        userRole: actorRole,
        featureKey
      });
      
      let structuredResult: any = result;
      if (typeof result === 'string') {
        try {
          structuredResult = JSON.parse(result);
        } catch (e) {
          const parseErr: any = new Error('Invalid structured response from AI provider.');
          parseErr.code = 'INVALID_RESPONSE';
          throw parseErr;
        }
      }

      // Evidence validation
      const validAssignmentIds = new Set<string>();
      const validItemIds = new Set<string>();
      const assignmentsById = new Map<string, any>();

      contextData.data.kpis.assignments.forEach((a: any) => {
        const aId = String(a.assignmentId || a.id);
        validAssignmentIds.add(aId);
        assignmentsById.set(aId, a);
        if (a.items && Array.isArray(a.items)) {
          a.items.forEach((it: any) => {
             const itId = String(it.assignmentItemId || it.id || it.assignment_item_id);
             if (itId && itId !== 'undefined') {
                validItemIds.add(itId);
             }
          });
        }
      });
      
      const normalized = normalizeKPIIntelligenceResult(structuredResult, validAssignmentIds, validItemIds, assignmentsById, {
        feature: req.feature,
        actorRole,
        truncatedContext: contextData.metadata.truncated || false
      });

      return {
        ...normalized,
        metadata: {
          featureKey,
          promptKey,
          promptVersion: (structuredResult as any)?.promptVersion || (result as any)?.promptVersion || 1,
          generatedAt: new Date().toISOString(),
          periodId: req.periodId,
          periodLabel,
          truncatedContext: contextData.metadata.truncated || false,
          unitId: req.unitId,
          unitName: authoritativeUnitName,
          scopeLabel,
          assignmentCount,
          itemCount,
          scoredCount,
          unscoredCount,
          lockedCount,
          individualAssignmentCount: kpiSummary.individualAssignmentCount || 0,
          organizationAssignmentCount: kpiSummary.organizationAssignmentCount || 0,
          liveCount
        }
      };
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (err.code === 'AI_DISABLED' || err.code === 'AI_NOT_CONFIGURED' || err.code === 'AI_CONTEXT_UNAUTHORIZED' || err.code === 'AI_CONTEXT_INVALID_SCOPE') {
        throw err;
      }
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || err.status === 429) {
        const rateLimitErr: any = new Error('AI rate limit reached. Please try again later.');
        rateLimitErr.code = 'RATE_LIMITED';
        throw rateLimitErr;
      }
      if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || err.status === 503) {
        const unavailErr: any = new Error('AI provider temporarily unavailable.');
        unavailErr.code = 'PROVIDER_UNAVAILABLE';
        throw unavailErr;
      }
      if (msg.includes('504') || msg.includes('TIMEOUT') || msg.includes('deadline')) {
        const timeoutErr: any = new Error('AI provider timed out.');
        timeoutErr.code = 'TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    }
  }
};
