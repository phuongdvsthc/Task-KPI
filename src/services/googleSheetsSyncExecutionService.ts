/**
 * Google Sheets Sync Execution Service (v0.8-E3)
 */

import crypto from 'crypto';

export function calculateSheetHash(sheet: { spreadsheetId: string; sheetName: string; sourceYear: number; rows: any[]; summary: any }): string {
  const content = JSON.stringify({
    spreadsheetId: sheet.spreadsheetId,
    sheetName: sheet.sheetName,
    sourceYear: sheet.sourceYear,
    rows: (sheet.rows || []).map(r => ({ className: r.className, reg: r.registeredCount, paid: r.paidCount })),
    summary: sheet.summary || {}
  });
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function executeSyncBatch(
  supabaseAdmin: any,
  adminUserId: string,
  spreadsheetId: string,
  selectedSheetNames: string[],
  idempotencyKey: string,
  freshSheetsData: any[],
  campaignMappings: any[],
  programMappings: any[]
): Promise<any> {
  // 1. Check idempotency
  if (idempotencyKey) {
    const { data: existingBatch } = await supabaseAdmin
      .from('admission_sync_batches')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .limit(1);

    if (existingBatch && existingBatch.length > 0) {
      return { batch: existingBatch[0], idempotent: true };
    }
  }

  const batchStartTime = new Date().toISOString();

  // Create batch record (processing)
  const { data: batchInsert, error: batchErr } = await supabaseAdmin
    .from('admission_sync_batches')
    .insert([{
      source_id: spreadsheetId,
      idempotency_key: idempotencyKey || crypto.randomUUID(),
      requested_by: adminUserId,
      status: 'processing',
      selected_sheet_count: selectedSheetNames.length,
      started_at: batchStartTime
    }])
    .select()
    .single();

  if (batchErr) {
    throw new Error('Không thể khởi tạo phiên đồng bộ: ' + batchErr.message);
  }

  const batchId = batchInsert.id;
  const batchSheetRecords: any[] = [];

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let totalReg = 0;
  let totalPaid = 0;
  let hasError = false;
  let errorSummary = '';

  for (const sheetName of selectedSheetNames) {
    const freshSheet = freshSheetsData.find(s => s.sheetName === sheetName);
    if (!freshSheet) {
      hasError = true;
      errorSummary = `Không tìm thấy dữ liệu mới cho sheet '${sheetName}'.`;
      break;
    }

    const sheetHash = calculateSheetHash({
      spreadsheetId,
      sheetName,
      sourceYear: freshSheet.sourceYear || 2026,
      rows: freshSheet.rows || [],
      summary: freshSheet.summary || {}
    });

    const mapping = campaignMappings.find(m => m.source_sheet_name === sheetName);
    if (!mapping || !mapping.campaign_id) {
      hasError = true;
      errorSummary = `Sheet '${sheetName}' chưa được ánh xạ đợt tuyển sinh.`;
      break;
    }

    const campaignId = mapping.campaign_id;

    // Check finalized
    const { data: existingResult } = await supabaseAdmin
      .from('admission_results')
      .select('*')
      .eq('campaign_id', campaignId)
      .limit(1);

    if (existingResult && existingResult.length > 0 && existingResult[0].data_status === 'finalized') {
      hasError = true;
      errorSummary = `Đợt tuyển sinh của sheet '${sheetName}' đã bị chốt (finalized).`;
      break;
    }

    // Determine entry mode and totals
    const isManualTotal = freshSheet.groupCode === 'NGAN_HAN' || (!freshSheet.rows || freshSheet.rows.length === 0);
    const entryMode = isManualTotal ? 'manual_total' : 'detail_sum';

    let regCount = 0;
    let paidCount = 0;

    if (isManualTotal) {
      regCount = freshSheet.summary?.totalRegistered || 0;
      paidCount = freshSheet.summary?.totalPaid || 0;
    } else {
      for (const r of freshSheet.rows || []) {
        regCount += (r.registeredCount || 0);
        paidCount += (r.paidCount || 0);
      }
    }

    totalReg += regCount;
    totalPaid += paidCount;

    // Action: create, update, or unchanged
    let action = 'create';
    if (existingResult && existingResult.length > 0) {
      const cur = existingResult[0];
      if (cur.total_registered === regCount && cur.total_paid === paidCount && cur.entry_mode === entryMode) {
        action = 'unchanged';
        unchangedCount++;
      } else {
        action = 'update';
        updatedCount++;
      }
    } else {
      createdCount++;
    }

    const sheetStartTime = new Date().toISOString();

    try {
      if (action !== 'unchanged') {
        let resultId = '';
        if (existingResult && existingResult.length > 0) {
          resultId = existingResult[0].id;
          await supabaseAdmin
            .from('admission_results')
            .update({
              total_registered: regCount,
              total_paid: paidCount,
              entry_mode: entryMode,
              source_type: 'google_sheets',
              data_status: 'draft',
              updated_by: adminUserId,
              updated_at: new Date().toISOString()
            })
            .eq('id', resultId);
        } else {
          const { data: newRes, error: resErr } = await supabaseAdmin
            .from('admission_results')
            .insert([{
              campaign_id: campaignId,
              total_registered: regCount,
              total_paid: paidCount,
              entry_mode: entryMode,
              source_type: 'google_sheets',
              data_status: 'draft',
              created_by: adminUserId,
              updated_by: adminUserId
            }])
            .select()
            .single();

          if (resErr) throw new Error(resErr.message);
          resultId = newRes.id;
        }

        if (entryMode === 'detail_sum') {
          // Delete existing items for this result and insert fresh
          await supabaseAdmin.from('admission_result_items').delete().eq('result_id', resultId);

          const itemsToInsert: any[] = [];
          for (const r of freshSheet.rows || []) {
            const pMapping = programMappings.find(pm => pm.source_program_name === r.className && pm.source_id === spreadsheetId);
            if (pMapping && pMapping.program_id) {
              itemsToInsert.push({
                result_id: resultId,
                program_id: pMapping.program_id,
                registered: r.registeredCount || 0,
                paid: r.paidCount || 0,
                note: r.note || null
              });
            }
          }

          if (itemsToInsert.length > 0) {
            const { error: itemsErr } = await supabaseAdmin.from('admission_result_items').insert(itemsToInsert);
            if (itemsErr) throw new Error(itemsErr.message);
          }
        }
      }

      batchSheetRecords.push({
        batch_id: batchId,
        sheet_name: sheetName,
        sheet_hash: sheetHash,
        campaign_id: campaignId,
        entry_mode: entryMode,
        action,
        status: 'success',
        registered_count: regCount,
        paid_count: paidCount,
        detail_row_count: freshSheet.rows?.length || 0,
        warning_count: 0,
        started_at: sheetStartTime,
        completed_at: new Date().toISOString()
      });
    } catch (sheetErr: any) {
      hasError = true;
      errorSummary = `Lỗi xử lý sheet '${sheetName}': ${sheetErr.message}`;
      batchSheetRecords.push({
        batch_id: batchId,
        sheet_name: sheetName,
        sheet_hash: sheetHash,
        campaign_id: campaignId,
        entry_mode: entryMode,
        action,
        status: 'failed',
        registered_count: regCount,
        paid_count: paidCount,
        detail_row_count: freshSheet.rows?.length || 0,
        error_message: sheetErr.message,
        started_at: sheetStartTime,
        completed_at: new Date().toISOString()
      });
      break;
    }
  }

  if (hasError) {
    // Rollback batch status to failed and throw
    await supabaseAdmin
      .from('admission_sync_batches')
      .update({
        status: 'failed',
        error_summary: errorSummary,
        completed_at: new Date().toISOString()
      })
      .eq('id', batchId);

    throw new Error(errorSummary);
  }

  // Insert batch sheets
  if (batchSheetRecords.length > 0) {
    await supabaseAdmin.from('admission_sync_batch_sheets').insert(batchSheetRecords);
  }

  // Complete batch successfully
  const { data: finalBatch } = await supabaseAdmin
    .from('admission_sync_batches')
    .update({
      status: 'succeeded',
      created_result_count: createdCount,
      updated_result_count: updatedCount,
      unchanged_result_count: unchangedCount,
      total_registered: totalReg,
      total_paid: totalPaid,
      completed_at: new Date().toISOString()
    })
    .eq('id', batchId)
    .select()
    .single();

  return { batch: finalBatch, idempotent: false };
}
