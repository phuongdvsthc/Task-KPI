/**
 * Google Sheets Validation Service (v0.8-E2)
 */

export interface ValidationMessage {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  sheetName?: string;
  sourceProgramName?: string;
}

export interface ValidationReport {
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  messages: ValidationMessage[];
  campaignStats: {
    totalSheets: number;
    mappedSheets: number;
    ignoredSheets: number;
    unresolvedSheets: number;
    willCreate: number;
    willUpdate: number;
    unchanged: number;
    blockedFinalized: number;
  };
}

export function validateSheetsData(
  sheets: any[],
  campaignMappings: any[],
  programMappings: any[],
  existingResults: any[],
  activeCampaigns: any[],
  activePrograms: any[],
  sourceHash: string
): ValidationReport {
  const messages: ValidationMessage[] = [];
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  const campaignStats = {
    totalSheets: sheets.length,
    mappedSheets: 0,
    ignoredSheets: 0,
    unresolvedSheets: 0,
    willCreate: 0,
    willUpdate: 0,
    unchanged: 0,
    blockedFinalized: 0
  };

  const campaignToSheetMap = new Map<string, string[]>();

  for (const sheet of sheets) {
    if (sheet.groupCode === 'SUMMARY_TOTAL') {
      // Sheet TỔNG: comparison only, not mapped to campaign
      messages.push({
        type: 'info',
        code: 'SUMMARY_SHEET_DETECTED',
        message: `Sheet TỔNG '${sheet.sheetName}' được dùng để đối chiếu tổng số liệu.`,
        sheetName: sheet.sheetName
      });
      infoCount++;
      continue;
    }

    if (sheet.groupCode === 'IGNORED') {
      const mapping = campaignMappings.find(m => m.source_sheet_name === sheet.sheetName);
      if (!mapping || mapping.mapping_status !== 'ignored') {
        messages.push({
          type: 'warning',
          code: 'IGNORED_SHEET_REASON_REQUIRED',
          message: `Sheet '${sheet.sheetName}' không thuộc nhóm TC/NH nhưng chưa có lý do bỏ qua (ignored).`,
          sheetName: sheet.sheetName
        });
        warningCount++;
      } else {
        campaignStats.ignoredSheets++;
        infoCount++;
      }
      continue;
    }

    // TC or NH sheet
    const mapping = campaignMappings.find(m => m.source_sheet_name === sheet.sheetName);
    if (!mapping || mapping.mapping_status === 'unresolved' || !mapping.campaign_id) {
      messages.push({
        type: 'error',
        code: 'CAMPAIGN_MAPPING_MISSING',
        message: `Sheet '${sheet.sheetName}' chưa được ánh xạ với đợt tuyển sinh nào.`,
        sheetName: sheet.sheetName
      });
      errorCount++;
      campaignStats.unresolvedSheets++;
      continue;
    }

    if (mapping.mapping_status === 'ignored') {
      campaignStats.ignoredSheets++;
      continue;
    }

    if (mapping.mapping_status === 'mapped') {
      campaignStats.mappedSheets++;
      const campaignId = mapping.campaign_id;
      const campaign = activeCampaigns.find(c => c.id === campaignId);

      if (!campaign) {
        messages.push({
          type: 'error',
          code: 'CAMPAIGN_NOT_FOUND',
          message: `Đợt tuyển sinh ánh xạ cho sheet '${sheet.sheetName}' không tồn tại hoặc đã bị xóa.`,
          sheetName: sheet.sheetName
        });
        errorCount++;
        continue;
      }

      if (campaign.status === 'completed' || campaign.status === 'archived' || !campaign.is_active) {
        messages.push({
          type: 'error',
          code: 'CAMPAIGN_INACTIVE_OR_CLOSED',
          message: `Đợt tuyển sinh '${campaign.name}' đã đóng hoặc không hoạt động, không thể ánh xạ.`,
          sheetName: sheet.sheetName
        });
        errorCount++;
        continue;
      }

      // Check group match
      const sheetGroupPrefix = sheet.groupCode === 'TRUNG_CAP' ? 'TRUNG_CAP' : 'NGAN_HAN';
      const campGroupCode = campaign.group?.code || campaign.group_id;
      if (campGroupCode && !campGroupCode.includes(sheetGroupPrefix) && !sheetGroupPrefix.includes(campGroupCode)) {
        messages.push({
          type: 'error',
          code: 'CAMPAIGN_GROUP_MISMATCH',
          message: `Sheet nhóm '${sheet.groupCode}' không thể ánh xạ với đợt tuyển sinh thuộc nhóm khác ('${campaign.name}').`,
          sheetName: sheet.sheetName
        });
        errorCount++;
      }

      // Track multiple sheets mapping to same campaign
      if (!campaignToSheetMap.has(campaignId)) {
        campaignToSheetMap.set(campaignId, []);
      }
      campaignToSheetMap.get(campaignId)!.push(sheet.sheetName);

      // Check existing results for campaign
      const existingRes = existingResults.find(r => r.campaign_id === campaignId);
      if (existingRes) {
        if (existingRes.data_status === 'finalized') {
          messages.push({
            type: 'error',
            code: 'BLOCKED_FINALIZED',
            message: `Kết quả của đợt tuyển sinh '${campaign.name}' đã chốt (finalized). Cần mở lại trước khi đồng bộ.`,
            sheetName: sheet.sheetName
          });
          errorCount++;
          campaignStats.blockedFinalized++;
        } else {
          // draft comparison
          campaignStats.willUpdate++;
        }
      } else {
        campaignStats.willCreate++;
      }
    }

    // Check row-level errors & program mappings
    const mappedProgramsInSheet = new Set<string>();

    for (const row of sheet.rows || []) {
      const reg = row.registeredCount;
      const paid = row.paidCount;

      // Negative check
      if ((reg !== null && reg < 0) || (paid !== null && paid < 0)) {
        messages.push({
          type: 'error',
          code: 'NEGATIVE_NUMBER',
          message: `Dòng '${row.className}' trong sheet '${sheet.sheetName}' có số lượng âm.`,
          sheetName: sheet.sheetName,
          sourceProgramName: row.className
        });
        errorCount++;
      }

      // Paid > registered check
      if (reg !== null && paid !== null && paid > reg) {
        messages.push({
          type: 'error',
          code: 'PAID_GREATER_THAN_REGISTERED',
          message: `Dòng '${row.className}' trong sheet '${sheet.sheetName}' có số lượng đóng học phí (${paid}) lớn hơn đăng ký (${reg}).`,
          sheetName: sheet.sheetName,
          sourceProgramName: row.className
        });
        errorCount++;
      }

      // Paid present but registered null check
      if (paid !== null && paid > 0 && reg === null) {
        messages.push({
          type: 'error',
          code: 'PAID_WITHOUT_REGISTERED',
          message: `Dòng '${row.className}' trong sheet '${sheet.sheetName}' có số đóng học phí nhưng số đăng ký trống (null).`,
          sheetName: sheet.sheetName,
          sourceProgramName: row.className
        });
        errorCount++;
      }

      // Check program mapping
      const pMapping = programMappings.find(m => m.source_program_name === row.className && m.source_id === sheet.spreadsheetId);
      if (!pMapping || !pMapping.program_id || pMapping.mapping_status === 'unresolved') {
        messages.push({
          type: 'error',
          code: 'PROGRAM_MAPPING_MISSING',
          message: `Tên chương trình/lớp '${row.className}' trong sheet '${sheet.sheetName}' chưa được ánh xạ với danh mục ngành.`,
          sheetName: sheet.sheetName,
          sourceProgramName: row.className
        });
        errorCount++;
      } else if (pMapping.mapping_status === 'mapped') {
        const progId = pMapping.program_id;
        // Check duplicate program in same sheet
        if (mappedProgramsInSheet.has(progId)) {
          messages.push({
            type: 'error',
            code: 'DUPLICATE_PROGRAM_MAPPING',
            message: `Chương trình/ngành này xuất hiện nhiều lần (hoặc qua các tên khác nhau) trong cùng sheet '${sheet.sheetName}'. Không tự cộng gộp.`,
            sheetName: sheet.sheetName,
            sourceProgramName: row.className
          });
          errorCount++;
        } else {
          mappedProgramsInSheet.add(progId);
        }
      }
    }
  }

  // Check multiple sheets mapping to same campaign
  for (const [campId, sheetNames] of campaignToSheetMap.entries()) {
    if (sheetNames.length > 1) {
      messages.push({
        type: 'warning',
        code: 'MULTIPLE_SHEETS_SAME_CAMPAIGN',
        message: `Có ${sheetNames.length} sheet (${sheetNames.join(', ')}) cùng ánh xạ về một đợt tuyển sinh.`,
      });
      warningCount++;
    }
  }

  const isValid = errorCount === 0;

  return {
    isValid,
    errorCount,
    warningCount,
    infoCount,
    messages,
    campaignStats
  };
}
