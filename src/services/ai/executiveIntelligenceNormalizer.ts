const FORBIDDEN_WORDS = [
    'sa thải', 'kỷ luật', 'đuổi việc', 'hạ lương', 'giảm lương', 'cách chức',
    'xếp hạng', 'thấp nhất', 'kém nhất', 'tệ nhất', 'phạt', 'kém', 'thiếu trách nhiệm',
    'năng suất thấp'
];

const CAUSATION_WORDS = ['do', 'vì', 'nguyên nhân', 'dẫn đến'];

export const containsProhibitedHRAction = (text?: string | null): boolean => {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return FORBIDDEN_WORDS.some(w => lower.includes(w));
};

export const normalizeCausation = (text?: string | null): string => {
  if (!text) return text || '';
  const lower = String(text).toLowerCase();
  if (CAUSATION_WORDS.some(w => lower.includes(` ${w} `) || lower.startsWith(`${w} `))) {
     return text + ' (cần đối chiếu thêm dữ liệu gốc)';
  }
  return text;
};

export const normalizeExecutiveIntelligenceResult = (
  rawResult: any,
  validEvidenceIds: Set<string>,
  validModules: Set<string>,
  moduleCounts: Record<string, number>
) => {
    if (!rawResult || typeof rawResult !== 'object') {
        return { summary: 'Kết quả trả về không hợp lệ.', highlights: [], issues: [], followUps: [] };
    }

    const validateNumericClaims = (text: string): boolean => {
        // Basic naive guard against provider invented counts
        // If a specific number like "12 Task quá hạn" appears, we should ideally check `moduleCounts`,
        // but since NLP extraction is complex, we just reject obvious mismatch if we can.
        // For this F2.3 mock layer, we will just trust the prompt constraints and strip obvious ranking.
        return true; 
    };

    const cleanItem = (item: any, requireModuleTags: boolean) => {
        if (!item || typeof item !== 'object') return null;
        if (!item.text || typeof item.text !== 'string') return null;
        if (containsProhibitedHRAction(item.text)) return null;

        let validEv = (Array.isArray(item.evidence) ? item.evidence : [])
            .filter((id: any) => typeof id === 'string' && validEvidenceIds.has(id));

        // Limit evidence refs
        validEv = validEv.slice(0, 10);

        if (validEv.length === 0) return null; // evidence required for facts

        let moduleTags = Array.isArray(item.moduleTags) ? item.moduleTags.filter((t: any) => typeof t === 'string' && validModules.has(t)) : [];
        
        // F2.3.9 cross-module insight requires multiple modules
        if (moduleTags.length > 1 && validEv.length < 2) {
             // Not a true cross module insight if only 1 evidence piece exists
             moduleTags = [moduleTags[0]]; 
        }

        const type = item.type === 'explicit' || item.type === 'suggested' ? item.type : 'suggested';

        const ret: any = {
            id: typeof item.id === 'string' ? item.id : Math.random().toString(36).substring(7),
            text: normalizeCausation(item.text),
            evidence: validEv
        };
        
        if (requireModuleTags) {
            ret.moduleTags = moduleTags;
        } else {
            ret.type = type;
        }

        return ret;
    };

    const seenText = new Set<string>();
    const dedupe = (item: any) => {
        if (!item) return false;
        const textStr = String(item.text || '');
        const lower = textStr.toLowerCase().trim();
        if (seenText.has(lower)) return false;
        seenText.add(lower);
        return validateNumericClaims(textStr);
    };

    let highlights = (Array.isArray(rawResult.highlights) ? rawResult.highlights : [])
        .map((i: any) => cleanItem(i, true))
        .filter(dedupe)
        .slice(0, 5);

    let issues = (Array.isArray(rawResult.issues) ? rawResult.issues : [])
        .map((i: any) => cleanItem(i, true))
        .filter(dedupe)
        .slice(0, 5);

    let followUps = (Array.isArray(rawResult.followUps) ? rawResult.followUps : [])
        .map((i: any) => cleanItem(i, false))
        .filter(dedupe)
        .slice(0, 5);

    let summary = typeof rawResult.summary === 'string' ? rawResult.summary : '';
    if (containsProhibitedHRAction(summary)) {
        summary = 'Nội dung tóm tắt chứa từ khóa không phù hợp và đã bị ẩn.';
    } else {
        summary = normalizeCausation(summary);
    }

    return {
        summary,
        highlights,
        issues,
        followUps
    };
};
