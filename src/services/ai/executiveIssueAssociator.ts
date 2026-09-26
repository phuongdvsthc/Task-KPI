import { AIContextData, AICrossModuleIssue, AICrossModuleGroup, AICrossModuleIssueCategory, AIContextModule, AICrossModuleRelationshipType } from '../../types/ai';
import { aiService } from './aiService';

const MAX_GROUPS = 15;
const MAX_ISSUES_PER_GROUP = 10;
const MAX_EVIDENCE_PER_GROUP = 20;

export const executiveIssueAssociator = {
  async associateIssues(supabaseAdmin: any, userId: string, featureKey: string, envelope: AIContextData, issues: AICrossModuleIssue[]): Promise<AICrossModuleGroup[]> {
    if (!issues || issues.length === 0) {
      return [];
    }

    // Pass the issues array to AI to group them
    const promptPayload = {
      instructions: "Nhóm các vấn đề liên quan. Trả về cấu trúc issueGroups.",
      candidates: issues.map(i => ({
        issueId: i.issueId,
        category: i.category,
        module: i.module,
        title: i.title,
        factualState: i.factualState,
        evidence: i.evidence,
        scope: i.scope,
        scoreMode: i.scoreMode
      }))
    };

    let aiResult;
    try {
      const response = await aiService.execute(supabaseAdmin, {
        userId,
        userRole: envelope.actor?.role || 'staff',
        featureKey,
        promptKey: 'executive.cross_module_issues',
        variables: { candidates: JSON.stringify(promptPayload.candidates) },
        context: envelope
      });
      
      aiResult = response;
    } catch (error) {
      console.warn("AI generation failed or timed out for cross-module issues. Falling back to single groups.", error);
      // Fallback: each issue is its own group
      return this.fallbackSingleGroups(issues);
    }

    return this.normalizeGroups(aiResult, issues, envelope);
  },

  normalizeGroups(aiResult: any, issues: AICrossModuleIssue[], envelope: AIContextData): AICrossModuleGroup[] {
    const rawGroups = aiResult?.issueGroups;
    if (!Array.isArray(rawGroups)) {
      return this.fallbackSingleGroups(issues);
    }

    const validIssues = new Map(issues.map(i => [i.issueId, i]));
    const allEvidence = new Set<string>();
    
    // Gather all valid evidence from the envelope
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

    const normalizedGroups: AICrossModuleGroup[] = [];
    const usedIssueIds = new Set<string>();

    for (const raw of rawGroups) {
      if (normalizedGroups.length >= MAX_GROUPS) break;

      const groupIssueIds: string[] = Array.isArray(raw.issueIds) 
          ? Array.from(new Set<string>(raw.issueIds.map((id: any) => String(id)).filter((id: string) => validIssues.has(id) && !usedIssueIds.has(id))))
          : [];

      if (groupIssueIds.length === 0) continue;

      const groupIssues = groupIssueIds.map(id => validIssues.get(id) as AICrossModuleIssue).slice(0, MAX_ISSUES_PER_GROUP);
      
      const modules = [...new Set(groupIssues.map(i => i.module))];
      const categories = [...new Set(groupIssues.map(i => i.category))];
      
      let rawEvidence = Array.isArray(raw.evidence) ? raw.evidence : [];
      // Collect evidence inherently from the issues themselves, combine with raw.evidence
      const inherentEvidence = groupIssues.flatMap(i => i.evidence);
      rawEvidence = [...new Set([...rawEvidence, ...inherentEvidence])];

      // Validate evidence
      const validEvidence = rawEvidence.filter((eId: string) => allEvidence.has(eId)).slice(0, MAX_EVIDENCE_PER_GROUP);

      // Determine relationshipType
      let relType: AICrossModuleRelationshipType = raw.relationshipType || 'co_occurrence';
      const allowedRels = ['same_business_item', 'explicit_reference', 'related_context', 'co_occurrence', 'single_issue'];
      if (!allowedRels.includes(relType)) {
          relType = 'co_occurrence';
      }
      
      if (groupIssues.length === 1) {
          relType = 'single_issue';
      }

      // If claiming cross-module but < 2 modules, downgrade rel to single_issue or co_occurrence
      if (modules.length < 2 && relType !== 'single_issue' && relType !== 'co_occurrence') {
          relType = 'related_context';
      }

      // For deduplication, if multiple issues are the exact same blocker from Daily Reports,
      // it should have >=2 issueIds but 1 module ('daily_report') and relType could be related_context or same_business_item
      
      const groupId = raw.groupId || `group_${groupIssues[0].issueId}`;
      const title = typeof raw.title === 'string' && raw.title.length > 0 ? raw.title.substring(0, 200) : groupIssues[0].title;
      const explanation = typeof raw.explanation === 'string' && raw.explanation.length > 0 ? raw.explanation.substring(0, 500) : '';

      normalizedGroups.push({
        groupId,
        title,
        categories,
        modules,
        issueIds: groupIssues.map(i => i.issueId),
        evidence: validEvidence,
        relationshipType: relType as AICrossModuleRelationshipType,
        explanation
      });

      groupIssues.forEach(i => usedIssueIds.add(i.issueId));
    }

    // Add remaining un-grouped issues as single groups
    for (const issue of issues) {
      if (!usedIssueIds.has(issue.issueId)) {
        normalizedGroups.push({
          groupId: `group_${issue.issueId}`,
          title: issue.title,
          categories: [issue.category],
          modules: [issue.module],
          issueIds: [issue.issueId],
          evidence: issue.evidence.filter(e => allEvidence.has(e)).slice(0, MAX_EVIDENCE_PER_GROUP),
          relationshipType: 'single_issue' as AICrossModuleRelationshipType,
          explanation: 'Single independent issue.'
        });
      }
    }

    // Deterministic sort by groupId
    normalizedGroups.sort((a, b) => a.groupId.localeCompare(b.groupId));

    return normalizedGroups.slice(0, MAX_GROUPS);
  },

  fallbackSingleGroups(issues: AICrossModuleIssue[]): AICrossModuleGroup[] {
    return issues.slice(0, MAX_GROUPS).map(issue => ({
      groupId: `group_${issue.issueId}`,
      title: issue.title,
      categories: [issue.category],
      modules: [issue.module],
      issueIds: [issue.issueId],
      evidence: issue.evidence, // Pre-validated by F4.1
      relationshipType: 'single_issue' as AICrossModuleRelationshipType,
      explanation: 'Single independent issue (fallback).'
    })).sort((a, b) => a.groupId.localeCompare(b.groupId));
  }
};
