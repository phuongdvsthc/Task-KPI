import { AIContextData, AICrossModuleGroup, AICrossModuleFollowUp, AIFollowUpCategory, AIFollowUpType, AIContextModule } from '../../types/ai';
import { aiService } from './aiService';

const MAX_FOLLOW_UPS = 8;
const MAX_EVIDENCE_PER_FOLLOW_UP = 20;

export const executiveFollowUpGenerator = {
  async generateFollowUps(supabaseAdmin: any, userId: string, featureKey: string, envelope: AIContextData, groups: AICrossModuleGroup[]): Promise<AICrossModuleFollowUp[]> {
    if (!groups || groups.length === 0) {
      return [];
    }

    // Pass the grouped issues array to AI
    const promptPayload = {
      instructions: "Đề xuất follow-ups dựa trên các nhóm vấn đề (issue groups) sau. Trả về cấu trúc followUps.",
      candidates: groups.map(g => ({
        groupId: g.groupId,
        title: g.title,
        categories: g.categories,
        modules: g.modules,
        issueIds: g.issueIds,
        evidence: g.evidence,
        relationshipType: g.relationshipType
      }))
    };

    let aiResult;
    try {
      const response = await aiService.execute(supabaseAdmin, {
        userId,
        userRole: envelope.actor?.role || 'staff',
        featureKey,
        promptKey: 'executive.follow_up',
        variables: { context: JSON.stringify(promptPayload) },
        context: envelope
      });
      
      aiResult = response;
    } catch (error) {
      console.warn("AI generation failed for follow-ups. Returning empty.", error);
      return [];
    }

    return this.normalizeFollowUps(aiResult, groups, envelope);
  },

  normalizeFollowUps(aiResult: any, groups: AICrossModuleGroup[], envelope: AIContextData): AICrossModuleFollowUp[] {
    const rawFollowUps = aiResult?.followUps;
    if (!Array.isArray(rawFollowUps)) {
      return [];
    }

    const allValidIssues = new Set<string>();
    groups.forEach(g => g.issueIds.forEach(id => allValidIssues.add(id)));

    const allEvidence = new Set<string>();
    if (envelope.data.dailyReports?.reports) {
      envelope.data.dailyReports.reports.forEach((r: any) => allEvidence.add(r.dailyReportId));
    }
    if (envelope.data.tasks?.tasks) {
      envelope.data.tasks.tasks.forEach((t: any) => allEvidence.add(t.taskId));
    }
    if (envelope.data.kpis?.assignments) {
      envelope.data.kpis.assignments.forEach((a: any) => {
        allEvidence.add(a.id);
        a.items?.forEach((it: any) => allEvidence.add(it.id));
      });
    }

    const normalized: AICrossModuleFollowUp[] = [];
    const seenTexts = new Set<string>();

    const FORBIDDEN_WORDS = [
        'sa thải', 'kỷ luật', 'đuổi việc', 'hạ lương', 'giảm lương', 'cách chức',
        'xếp hạng', 'thấp nhất', 'kém nhất', 'tệ nhất', 'phạt', 'kém', 'thiếu trách nhiệm',
        'năng suất thấp'
    ];
    const containsProhibited = (text: string): boolean => {
      if (!text) return false;
      const lower = text.toLowerCase();
      return FORBIDDEN_WORDS.some(w => lower.includes(w));
    };

    for (const raw of rawFollowUps) {
      if (normalized.length >= MAX_FOLLOW_UPS) break;

      let text = typeof raw.text === 'string' ? raw.text.trim() : '';
      if (!text || containsProhibited(text)) continue;
      
      // Basic deduplication
      const lowerText = text.toLowerCase();
      if (seenTexts.has(lowerText)) continue;

      let issueIds = Array.isArray(raw.issueIds) 
          ? Array.from(new Set<string>(raw.issueIds.map((id: any) => String(id)).filter((id: string) => allValidIssues.has(id))))
          : [];
      
      if (issueIds.length === 0) continue; // Must trace back to >=1 validated issueId

      let rawEvidence = Array.isArray(raw.evidence) ? raw.evidence.map((e: any) => String(e)) : [];
      
      // Auto-attach evidence from the groups if the follow-up explicitly references those issues
      // to ensure evidence is always rich and accurate.
      const inherentEvidence = groups
        .filter(g => g.issueIds.some(id => issueIds.includes(id)))
        .flatMap(g => g.evidence);
        
      rawEvidence = [...new Set([...rawEvidence, ...inherentEvidence])];

      const validEvidence = rawEvidence.filter((eId: string) => allEvidence.has(eId)).slice(0, MAX_EVIDENCE_PER_FOLLOW_UP);
      
      if (validEvidence.length === 0) continue; // Every follow-up requires valid evidence

      let type: AIFollowUpType = raw.type === 'explicit' ? 'explicit' : 'suggested';
      let category: AIFollowUpCategory = raw.category || 'monitor_progress';
      const allowedCategories = ['review_source', 'verify_data', 'monitor_progress', 'review_task', 'review_kpi', 'cross_module_check'];
      if (!allowedCategories.includes(category)) {
          category = 'monitor_progress';
      }

      let moduleTags: AIContextModule[] = Array.isArray(raw.moduleTags) ? raw.moduleTags.filter((t: any) => ['daily_report', 'task', 'kpi'].includes(t)) : [];
      if (moduleTags.length === 0) {
         // Infer from groups
         moduleTags = [...new Set(groups.filter(g => g.issueIds.some(id => issueIds.includes(id))).flatMap(g => g.modules))];
      }

      // If cross-module group
      if (moduleTags.length >= 2 && category !== 'cross_module_check') {
          category = 'cross_module_check';
      }

      const followUpId = raw.followUpId || `fu_${issueIds[0]}_${normalized.length}`;

      normalized.push({
        followUpId,
        text,
        type,
        category,
        issueIds,
        evidence: validEvidence,
        moduleTags
      });

      seenTexts.add(lowerText);
    }

    // Deterministic sort: explicit first, then by followUpId
    normalized.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'explicit' ? -1 : 1;
        return a.followUpId.localeCompare(b.followUpId);
    });

    return normalized;
  }
};
