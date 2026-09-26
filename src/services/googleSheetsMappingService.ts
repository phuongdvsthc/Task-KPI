/**
 * Google Sheets Mapping & Normalization Service (v0.8-E2)
 */

export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-');
}

export type MatchLevel = 'exact' | 'normalized_exact' | 'suggested' | 'unresolved';

export interface ProgramMatchCandidate {
  programId: string;
  code: string;
  name: string;
  groupId: string;
  matchLevel: MatchLevel;
  similarityScore: number;
}

export function findBestProgramMatch(sourceName: string, groupId: string, activePrograms: any[]): ProgramMatchCandidate {
  const trimmedSource = sourceName.trim();
  const normalizedSource = normalizeName(sourceName);

  const groupPrograms = activePrograms.filter(p => p.group_id === groupId && p.is_active);

  // 1. Exact match
  const exactMatch = groupPrograms.find(p => p.name.trim() === trimmedSource);
  if (exactMatch) {
    return {
      programId: exactMatch.id,
      code: exactMatch.code,
      name: exactMatch.name,
      groupId: exactMatch.group_id,
      matchLevel: 'exact',
      similarityScore: 1.0
    };
  }

  // 2. Normalized exact match
  const normExactMatch = groupPrograms.find(p => normalizeName(p.name) === normalizedSource);
  if (normExactMatch) {
    return {
      programId: normExactMatch.id,
      code: normExactMatch.code,
      name: normExactMatch.name,
      groupId: normExactMatch.group_id,
      matchLevel: 'normalized_exact',
      similarityScore: 0.95
    };
  }

  // 3. Suggested match (contains words or substring)
  let bestCandidate: any = null;
  let bestScore = 0;

  for (const p of groupPrograms) {
    const normPName = normalizeName(p.name);
    const sourceWords = normalizedSource.split(' ').filter(w => w.length > 2);
    const pWords = normPName.split(' ').filter(w => w.length > 2);

    if (sourceWords.length === 0 || pWords.length === 0) continue;

    let commonCount = 0;
    for (const w of sourceWords) {
      if (pWords.includes(w)) commonCount++;
    }

    const score = commonCount / Math.max(sourceWords.length, pWords.length);
    if (score > 0.4 && score > bestScore) {
      bestScore = score;
      bestCandidate = p;
    }
  }

  if (bestCandidate && bestScore >= 0.4) {
    return {
      programId: bestCandidate.id,
      code: bestCandidate.code,
      name: bestCandidate.name,
      groupId: bestCandidate.group_id,
      matchLevel: 'suggested',
      similarityScore: bestScore
    };
  }

  return {
    programId: '',
    code: '',
    name: '',
    groupId,
    matchLevel: 'unresolved',
    similarityScore: 0
  };
}

export function suggestCampaignForSheet(sheetName: string, groupCode: string, proposedDate: string | null, activeCampaigns: any[]): { campaignId: string | null; matchStatus: 'mapped' | 'unresolved' | 'ambiguous'; reason?: string } {
  const matchingCampaigns = activeCampaigns.filter(c => {
    // Check group code match
    const groupMatches = c.group?.code === groupCode || c.group_id === groupCode;
    if (!groupMatches) return false;

    // Check year/date if available
    if (proposedDate && c.start_date) {
      // compare date or year
      const campaignYear = new Date(c.start_date).getFullYear();
      const sheetYear = proposedDate.split('/')[2];
      if (sheetYear && Number(sheetYear) !== campaignYear) return false;
    }

    return c.status === 'active' || c.status === 'planning';
  });

  if (matchingCampaigns.length === 1) {
    return { campaignId: matchingCampaigns[0].id, matchStatus: 'mapped' };
  } else if (matchingCampaigns.length > 1) {
    // Check if exact date match narrows it down
    if (proposedDate) {
      const exactDateMatch = matchingCampaigns.filter(c => {
        if (!c.start_date) return false;
        // format c.start_date (YYYY-MM-DD) to DD/MM/YYYY
        const parts = c.start_date.split('T')[0].split('-');
        if (parts.length === 3) {
          const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
          return formatted === proposedDate;
        }
        return false;
      });

      if (exactDateMatch.length === 1) {
        return { campaignId: exactDateMatch[0].id, matchStatus: 'mapped' };
      } else if (exactDateMatch.length > 1) {
        return { campaignId: null, matchStatus: 'ambiguous', reason: 'AMBIGUOUS_CAMPAIGN: Nhiều đợt tuyển sinh phù hợp chính xác ngày.' };
      }
    }
    return { campaignId: null, matchStatus: 'ambiguous', reason: 'AMBIGUOUS_CAMPAIGN: Nhiều đợt tuyển sinh phù hợp điều kiện.' };
  }

  return { campaignId: null, matchStatus: 'unresolved', reason: 'CAMPAIGN_NOT_FOUND: Không tìm thấy đợt tuyển sinh phù hợp.' };
}
