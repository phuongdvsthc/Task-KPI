/**
 * Parser and Validator for Google Sheets Admission Data (v0.8-E1)
 */

import crypto from 'crypto';

export interface ParsedRow {
  rowIndex: number;
  stt: string | null;
  className: string | null;
  registeredCount: number | null;
  paidCount: number | null;
  notes: string | null;
  status: 'valid' | 'warning' | 'error' | 'ignored';
  messages: string[];
}

export interface ParsedSheetData {
  sheetName: string;
  groupCode: 'TRUNG_CAP' | 'NGAN_HAN' | 'SUMMARY_TOTAL' | 'IGNORED';
  proposedCampaignDate: string | null; // DD/MM/YYYY
  titleDate: string | null;
  entryModeSuggestion: 'detail_sum' | 'manual_total' | 'none';
  detailRegistered: number;
  detailPaid: number;
  sheetTotalRegistered: number | null;
  sheetTotalPaid: number | null;
  rowCount: number;
  warnings: string[];
  errors: string[];
  rows: ParsedRow[];
}

export interface SpreadsheetPreviewResult {
  spreadsheetId: string;
  title: string;
  sourceYear: number;
  readAt: string;
  sourceHash: string;
  summary: {
    totalSheets: number;
    recognizedCampaignSheets: number;
    tcSheets: number;
    nhSheets: number;
    ignoredSheets: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
    totalRegistered: number;
    totalPaid: number;
  };
  sheets: ParsedSheetData[];
  reconciliation: {
    computedRegistered: number;
    computedPaid: number;
    summarySheetRegistered: number | null;
    summarySheetPaid: number | null;
    differenceRegistered: number;
    differencePaid: number;
    status: 'MATCH' | 'MISMATCH' | 'NO_SUMMARY_SHEET';
  };
}

export function parseSheetName(sheetName: string, sourceYear: number): { groupCode: 'TRUNG_CAP' | 'NGAN_HAN' | 'SUMMARY_TOTAL' | 'IGNORED'; proposedDate: string | null } {
  const trimmed = sheetName.trim();
  const upper = trimmed.toUpperCase();

  if (upper === 'TỔNG' || upper === 'TONG' || upper === 'SUMMARY') {
    return { groupCode: 'SUMMARY_TOTAL', proposedDate: null };
  }

  // Match TC dd.mm or TC dd/mm or TCdd.mm
  const tcMatch = trimmed.match(/^TC\s*[:\-]?\s*(\d{1,2})[\.\/](\d{1,2})(?:[\.\/](\d{2,4}))?/i);
  if (tcMatch) {
    const day = tcMatch[1].padStart(2, '0');
    const month = tcMatch[2].padStart(2, '0');
    const year = tcMatch[3] ? (tcMatch[3].length === 2 ? '20' + tcMatch[3] : tcMatch[3]) : String(sourceYear);
    return { groupCode: 'TRUNG_CAP', proposedDate: `${day}/${month}/${year}` };
  }

  // Match NH dd.mm or NH dd/mm
  const nhMatch = trimmed.match(/^NH\s*[:\-]?\s*(\d{1,2})[\.\/](\d{1,2})(?:[\.\/](\d{2,4}))?/i);
  if (nhMatch) {
    const day = nhMatch[1].padStart(2, '0');
    const month = nhMatch[2].padStart(2, '0');
    const year = nhMatch[3] ? (nhMatch[3].length === 2 ? '20' + nhMatch[3] : nhMatch[3]) : String(sourceYear);
    return { groupCode: 'NGAN_HAN', proposedDate: `${day}/${month}/${year}` };
  }

  if (upper.startsWith('TC')) {
    return { groupCode: 'TRUNG_CAP', proposedDate: `01/01/${sourceYear}` };
  }
  if (upper.startsWith('NH')) {
    return { groupCode: 'NGAN_HAN', proposedDate: `01/01/${sourceYear}` };
  }

  return { groupCode: 'IGNORED', proposedDate: null };
}

export function parseNumericCell(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim().replace(/\./g, '').replace(/,/g, '');
  if (str === '') return null;
  const num = Number(str);
  return isNaN(num) ? null : num;
}

export function parseSheetRows(sheetName: string, rawRows: any[][], sourceYear: number): ParsedSheetData {
  const { groupCode, proposedDate } = parseSheetName(sheetName, sourceYear);
  const warnings: string[] = [];
  const errors: string[] = [];
  const rows: ParsedRow[] = [];

  if (groupCode === 'IGNORED') {
    return {
      sheetName,
      groupCode,
      proposedCampaignDate: null,
      titleDate: null,
      entryModeSuggestion: 'none',
      detailRegistered: 0,
      detailPaid: 0,
      sheetTotalRegistered: null,
      sheetTotalPaid: null,
      rowCount: rawRows.length,
      warnings: ['Sheet bị bỏ qua do không khớp định dạng TC hoặc NH.'],
      errors: [],
      rows: []
    };
  }

  let titleDate: string | null = null;
  let headerIndex = -1;
  let colMap = { stt: 0, className: 1, registered: 2, paid: 3, notes: 4 };

  // Scan first few rows for header and title date
  for (let i = 0; i < Math.min(rawRows.length, 6); i++) {
    const row = rawRows[i] || [];
    const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
    
    // Check title date
    const dateMatch = rowStr.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})/);
    if (dateMatch && !titleDate) {
      titleDate = `${dateMatch[1].padStart(2, '0')}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]}`;
    }

    // Check header keywords
    if (rowStr.includes('lớp') || rowStr.includes('ngành') || rowStr.includes('đăng ký') || rowStr.includes('đã đóng')) {
      headerIndex = i;
      row.forEach((cell, idx) => {
        const text = String(cell || '').toLowerCase();
        if (text.includes('stt')) colMap.stt = idx;
        else if (text.includes('lớp') || text.includes('ngành') || text.includes('tên')) colMap.className = idx;
        else if (text.includes('đăng ký') || text.includes('sl đk')) colMap.registered = idx;
        else if (text.includes('đóng') || text.includes('hp') || text.includes('đã đóng')) colMap.paid = idx;
        else if (text.includes('ghi chú') || text.includes('tỷ lệ')) colMap.notes = idx;
      });
      break;
    }
  }

  if (titleDate && proposedDate) {
    const titleYear = titleDate.split('/')[2];
    const proposedYear = proposedDate.split('/')[2];
    if (titleYear && proposedYear && titleYear !== proposedYear) {
      warnings.push(`Cảnh báo: Tiêu đề trong sheet ghi năm (${titleYear}) không khớp với năm nguồn (${proposedYear}).`);
    }
  }

  let sheetTotalRegistered: number | null = null;
  let sheetTotalPaid: number | null = null;
  let validDetailCount = 0;
  let detailRegistered = 0;
  let detailPaid = 0;

  const startRow = headerIndex >= 0 ? headerIndex + 1 : 0;

  for (let i = startRow; i < rawRows.length; i++) {
    const r = rawRows[i] || [];
    if (r.every(cell => !cell || String(cell).trim() === '')) continue;

    const rowText = r.map(c => String(c || '').toLowerCase()).join(' ');
    const sttVal = r[colMap.stt] !== undefined ? String(r[colMap.stt]).trim() : '';
    const classNameVal = r[colMap.className] !== undefined ? String(r[colMap.className]).trim() : '';
    const regVal = parseNumericCell(r[colMap.registered] !== undefined ? r[colMap.registered] : r[colMap.registered + 1]);
    const paidVal = parseNumericCell(r[colMap.paid] !== undefined ? r[colMap.paid] : r[colMap.paid + 1]);
    const notesVal = r[colMap.notes] !== undefined ? String(r[colMap.notes]).trim() : '';

    // Check if summary row
    if (rowText.includes('cộng') || rowText.includes('tổng cộng') || rowText.includes('tổng số') || rowText.includes('total')) {
      // Find numeric cells in summary row
      const nums = r.map(c => parseNumericCell(c)).filter((n): n is number => n !== null);
      if (nums.length >= 2) {
        sheetTotalRegistered = sheetTotalRegistered !== null ? sheetTotalRegistered : nums[0];
        sheetTotalPaid = sheetTotalPaid !== null ? sheetTotalPaid : nums[1];
      } else if (nums.length === 1) {
        sheetTotalRegistered = sheetTotalRegistered !== null ? sheetTotalRegistered : nums[0];
      }
      if (regVal !== null) sheetTotalRegistered = regVal;
      if (paidVal !== null) sheetTotalPaid = paidVal;
      continue;
    }

    // Skip empty or trivial header rows
    if (!classNameVal && !sttVal && regVal === null && paidVal === null) {
      continue;
    }

    const messages: string[] = [];
    let rowStatus: 'valid' | 'warning' | 'error' | 'ignored' = 'valid';

    if (!classNameVal && !sttVal) {
      rowStatus = 'error';
      messages.push('Thiếu tên lớp/ngành.');
    }

    if (regVal !== null && regVal < 0) {
      rowStatus = 'error';
      messages.push('Số lượng đăng ký âm.');
    }

    if (paidVal !== null && paidVal < 0) {
      rowStatus = 'error';
      messages.push('Số lượng đóng học phí âm.');
    }

    if (regVal === null && paidVal !== null) {
      rowStatus = 'warning';
      messages.push('Có số đóng học phí nhưng thiếu số đăng ký.');
    }

    if (regVal !== null && paidVal !== null && paidVal > regVal) {
      rowStatus = 'error';
      messages.push('Số đóng học phí lớn hơn số đăng ký.');
    }

    if (rowStatus === 'error') {
      errors.push(`Dòng ${i + 1} (${classNameVal || sttVal || 'Không tên'}): ${messages.join(' ')}`);
    } else if (rowStatus === 'warning') {
      warnings.push(`Dòng ${i + 1} (${classNameVal || sttVal}): ${messages.join(' ')}`);
    }

    if (rowStatus !== 'error' && (classNameVal || sttVal)) {
      validDetailCount++;
      if (regVal !== null) detailRegistered += regVal;
      if (paidVal !== null) detailPaid += paidVal;
    }

    rows.push({
      rowIndex: i + 1,
      stt: sttVal || null,
      className: classNameVal || null,
      registeredCount: regVal,
      paidCount: paidVal,
      notes: notesVal || null,
      status: rowStatus,
      messages
    });
  }

  let entryModeSuggestion: 'detail_sum' | 'manual_total' | 'none' = 'detail_sum';
  if (groupCode === 'SUMMARY_TOTAL') {
    entryModeSuggestion = 'none';
  } else if (validDetailCount > 0) {
    entryModeSuggestion = 'detail_sum';
  } else if ((sheetTotalRegistered !== null && sheetTotalRegistered > 0) || (sheetTotalPaid !== null && sheetTotalPaid > 0)) {
    entryModeSuggestion = 'manual_total';
    warnings.push('Sheet có số tổng nhưng chưa có số liệu chi tiết theo ngành/lớp (Nhận diện: manual_total).');
  }

  return {
    sheetName,
    groupCode,
    proposedCampaignDate: proposedDate,
    titleDate,
    entryModeSuggestion,
    detailRegistered,
    detailPaid,
    sheetTotalRegistered,
    sheetTotalPaid,
    rowCount: rawRows.length,
    warnings,
    errors,
    rows
  };
}

export function computeSourceHash(spreadsheetId: string, sourceYear: number, sheets: ParsedSheetData[]): string {
  const payload = {
    spreadsheetId,
    sourceYear,
    sheets: sheets.map(s => ({
      name: s.sheetName,
      group: s.groupCode,
      date: s.proposedCampaignDate,
      rows: s.rows.map(r => ({ c: r.className, reg: r.registeredCount, paid: r.paidCount }))
    }))
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
