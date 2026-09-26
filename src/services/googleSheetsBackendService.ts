/**
 * Google Sheets Backend Service (v0.8-E1)
 */

import { google } from 'googleapis';
import { parseSheetRows, computeSourceHash, SpreadsheetPreviewResult, ParsedSheetData } from './googleSheetsParser';

function getGoogleSheetsClient(overrideEmail?: string, overrideKey?: string) {
  const email = overrideEmail || process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  let rawKey = overrideKey || process.env.GOOGLE_SHEETS_PRIVATE_KEY;

  if (!rawKey && process.env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
    try {
      const creds = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
      if (creds.client_email && creds.private_key) {
        if (!email) process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL = creds.client_email;
        if (!rawKey) process.env.GOOGLE_SHEETS_PRIVATE_KEY = creds.private_key;
      }
    } catch {
      // ignore
    }
  }

  const clientEmail = email || process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const privateKey = rawKey || process.env.GOOGLE_SHEETS_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Chưa cấu hình GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL và GOOGLE_SHEETS_PRIVATE_KEY. Vui lòng nhập trực tiếp thông tin Service Account trong form cấu hình bên dưới hoặc cài đặt biến môi trường trên server.');
  }

  let formattedKey = privateKey.trim().replace(/^["']|["']$/g, '');
  // Handle various escaped newline representations
  formattedKey = formattedKey
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\\\n/g, '\n');

  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----') && !formattedKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    throw new Error('Định dạng Private Key không hợp lệ. Private Key phải bắt đầu bằng -----BEGIN PRIVATE KEY-----.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: formattedKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  try {
    return google.sheets({ version: 'v4', auth });
  } catch (err: any) {
    if (err?.message?.includes('unsupported') || err?.message?.includes('DECODER')) {
      throw new Error('Lỗi định dạng OpenSSL (unsupported). Vui lòng kiểm tra lại định dạng Private Key, đảm bảo các ký tự xuống dòng \\n được giữ nguyên vẹn.');
    }
    throw err;
  }
}

export function extractSpreadsheetId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export const googleSheetsBackendService = {
  async getConfig(supabase: any) {
    try {
      const { data, error } = await supabase
        .from('admission_google_sheets_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return {
          name: 'Theo dõi hồ sơ tuyển sinh 2026',
          spreadsheet_id: '',
          owner_unit: 'Phòng Tuyển sinh',
          source_year: 2026,
          is_active: true,
          service_account_email: '',
          private_key: ''
        };
      }
      return data[0];
    } catch {
      return {
        name: 'Theo dõi hồ sơ tuyển sinh 2026',
        spreadsheet_id: '',
        owner_unit: 'Phòng Tuyển sinh',
        source_year: 2026,
        is_active: true,
        service_account_email: '',
        private_key: ''
      };
    }
  },

  async saveConfig(supabase: any, configData: any, userId: string) {
    const spreadsheetId = extractSpreadsheetId(configData.spreadsheet_id || configData.spreadsheetId);
    const payload = {
      name: configData.name || 'Theo dõi hồ sơ tuyển sinh 2026',
      spreadsheet_id: spreadsheetId,
      owner_unit: configData.owner_unit || configData.ownerUnit || 'Phòng Tuyển sinh',
      source_year: Number(configData.source_year || configData.sourceYear || 2026),
      is_active: configData.is_active !== false,
      service_account_email: configData.service_account_email || configData.serviceAccountEmail || '',
      private_key: configData.private_key || configData.privateKey || '',
      updated_at: new Date().toISOString(),
      created_by: userId
    };

    // Try to update existing or insert
    const { data: existing, error: existingErr } = await supabase
      .from('admission_google_sheets_config')
      .select('id')
      .limit(1);

    if (existingErr && (existingErr.message.includes('Could not find the table') || existingErr.message.includes('does not exist'))) {
      // Table doesn't exist yet, return payload gracefully so UI succeeds
      return payload;
    }

    if (existing && existing.length > 0) {
      const { data, error } = await supabase
        .from('admission_google_sheets_config')
        .update(payload)
        .eq('id', existing[0].id)
        .select()
        .single();
      if (error) {
        if (error.message.includes('service_account_email') || error.message.includes('column')) {
          const fallbackPayload = {
            name: payload.name,
            spreadsheet_id: payload.spreadsheet_id,
            owner_unit: payload.owner_unit,
            source_year: payload.source_year,
            is_active: payload.is_active,
            updated_at: payload.updated_at,
            created_by: payload.created_by
          };
          const { data: fbData, error: fbErr } = await supabase
            .from('admission_google_sheets_config')
            .update(fallbackPayload)
            .eq('id', existing[0].id)
            .select()
            .single();
          if (fbErr) throw new Error(fbErr.message);
          return { ...fbData, service_account_email: payload.service_account_email, private_key: payload.private_key };
        }
        throw new Error(error.message);
      }
      return data;
    } else {
      const { data, error } = await supabase
        .from('admission_google_sheets_config')
        .insert([payload])
        .select()
        .single();
      if (error) {
        if (error.message.includes('service_account_email') || error.message.includes('column')) {
          const fallbackPayload = {
            name: payload.name,
            spreadsheet_id: payload.spreadsheet_id,
            owner_unit: payload.owner_unit,
            source_year: payload.source_year,
            is_active: payload.is_active,
            updated_at: payload.updated_at,
            created_by: payload.created_by
          };
          const { data: fbData, error: fbErr } = await supabase
            .from('admission_google_sheets_config')
            .insert([fallbackPayload])
            .select()
            .single();
          if (fbErr) throw new Error(fbErr.message);
          return { ...fbData, service_account_email: payload.service_account_email, private_key: payload.private_key };
        }
        throw new Error(error.message);
      }
      return data;
    }
  },

  async testConnection(urlOrId: string, serviceAccountEmail?: string, privateKey?: string, supabaseAdmin?: any) {
    const spreadsheetId = extractSpreadsheetId(urlOrId);
    if (!spreadsheetId) {
      throw new Error('Google Sheets URL hoặc Spreadsheet ID không hợp lệ.');
    }

    let email = serviceAccountEmail;
    let key = privateKey;

    if ((!email || !key) && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin.from('admission_google_sheets_config').select('service_account_email, private_key').limit(1);
        if (data && data[0]) {
          email = email || data[0].service_account_email;
          key = key || data[0].private_key;
        }
      } catch {
        // ignore
      }
    }

    const sheets = getGoogleSheetsClient(email, key);
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false
    });

    const title = response.data.properties?.title || 'Untitled Spreadsheet';
    const sheetList = (response.data.sheets || []).map((s: any) => ({
      sheetId: s.properties?.sheetId,
      title: s.properties?.title,
      index: s.properties?.index
    }));

    return {
      success: true,
      spreadsheetId,
      title,
      sheetCount: sheetList.length,
      sheets: sheetList
    };
  },

  async previewSpreadsheet(urlOrId: string, sourceYear: number = 2026, serviceAccountEmail?: string, privateKey?: string, supabaseAdmin?: any): Promise<SpreadsheetPreviewResult> {
    const spreadsheetId = extractSpreadsheetId(urlOrId);
    if (!spreadsheetId) {
      throw new Error('Google Sheets URL hoặc Spreadsheet ID không hợp lệ.');
    }

    let email = serviceAccountEmail;
    let key = privateKey;

    if ((!email || !key) && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin.from('admission_google_sheets_config').select('service_account_email, private_key').limit(1);
        if (data && data[0]) {
          email = email || data[0].service_account_email;
          key = key || data[0].private_key;
        }
      } catch {
        // ignore
      }
    }

    const sheetsClient = getGoogleSheetsClient(email, key);
    const meta = await sheetsClient.spreadsheets.get({
      spreadsheetId,
      includeGridData: false
    });

    const title = meta.data.properties?.title || 'Untitled Spreadsheet';
    const rawSheetList = meta.data.sheets || [];
    const sheetNames = rawSheetList.map((s: any) => s.properties?.title).filter(Boolean) as string[];

    if (sheetNames.length === 0) {
      throw new Error('Spreadsheet không có sheet nào.');
    }

    // Batch get values for all sheets
    const ranges = sheetNames.map(name => `'${name}'!A1:Z500`);
    const valuesRes = await sheetsClient.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });

    const valueRanges = valuesRes.data.valueRanges || [];
    const parsedSheets: ParsedSheetData[] = [];
    let summarySheetRegistered: number | null = null;
    let summarySheetPaid: number | null = null;

    sheetNames.forEach((sheetName, index) => {
      const vr = valueRanges[index];
      const rawRows = (vr?.values || []) as any[][];
      const parsed = parseSheetRows(sheetName, rawRows, sourceYear);

      if (parsed.groupCode === 'SUMMARY_TOTAL') {
        // extract totals from TỔNG sheet if possible
        let regSum = 0;
        let paidSum = 0;
        parsed.rows.forEach(r => {
          if (r.registeredCount !== null) regSum += r.registeredCount;
          if (r.paidCount !== null) paidSum += r.paidCount;
        });
        if (parsed.sheetTotalRegistered !== null) summarySheetRegistered = parsed.sheetTotalRegistered;
        else if (regSum > 0) summarySheetRegistered = regSum;

        if (parsed.sheetTotalPaid !== null) summarySheetPaid = parsed.sheetTotalPaid;
        else if (paidSum > 0) summarySheetPaid = paidSum;
      }

      parsedSheets.push(parsed);
    });

    const recognizedSheets = parsedSheets.filter(s => s.groupCode === 'TRUNG_CAP' || s.groupCode === 'NGAN_HAN');
    const tcSheets = parsedSheets.filter(s => s.groupCode === 'TRUNG_CAP');
    const nhSheets = parsedSheets.filter(s => s.groupCode === 'NGAN_HAN');
    const ignoredSheets = parsedSheets.filter(s => s.groupCode === 'IGNORED' || s.groupCode === 'SUMMARY_TOTAL');

    let totalRegistered = 0;
    let totalPaid = 0;
    let validRows = 0;
    let warningRows = 0;
    let errorRows = 0;

    recognizedSheets.forEach(s => {
      totalRegistered += s.detailRegistered;
      totalPaid += s.detailPaid;
      s.rows.forEach(r => {
        if (r.status === 'valid') validRows++;
        else if (r.status === 'warning') { validRows++; warningRows++; }
        else if (r.status === 'error') errorRows++;
      });
    });

    const diffReg = summarySheetRegistered !== null ? totalRegistered - summarySheetRegistered : 0;
    const diffPaid = summarySheetPaid !== null ? totalPaid - summarySheetPaid : 0;
    let reconStatus: 'MATCH' | 'MISMATCH' | 'NO_SUMMARY_SHEET' = 'NO_SUMMARY_SHEET';
    if (summarySheetRegistered !== null || summarySheetPaid !== null) {
      reconStatus = (diffReg === 0 && diffPaid === 0) ? 'MATCH' : 'MISMATCH';
    }

    const sourceHash = computeSourceHash(spreadsheetId, sourceYear, parsedSheets);

    return {
      spreadsheetId,
      title,
      sourceYear,
      readAt: new Date().toISOString(),
      sourceHash,
      summary: {
        totalSheets: sheetNames.length,
        recognizedCampaignSheets: recognizedSheets.length,
        tcSheets: tcSheets.length,
        nhSheets: nhSheets.length,
        ignoredSheets: ignoredSheets.length,
        validRows,
        warningRows,
        errorRows,
        totalRegistered,
        totalPaid
      },
      sheets: parsedSheets,
      reconciliation: {
        computedRegistered: totalRegistered,
        computedPaid: totalPaid,
        summarySheetRegistered,
        summarySheetPaid,
        differenceRegistered: diffReg,
        differencePaid: diffPaid,
        status: reconStatus
      }
    };
  }
};
