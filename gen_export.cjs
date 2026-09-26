const fs = require('fs');

const routeCode = `
app.get('/api/kpi/dashboard/export', authenticateUser, async (req: Request, res: Response) => {
  try {
    const periodId = req.query.period_id as string;
    const unitId = req.query.unit_id as string;
    const assignmentStatus = req.query.assignment_status as string;
    const resultMode = (req.query.result_mode || 'all').toString().toLowerCase();
    const assigneeType = req.query.assignee_type as string;
    const reviewStatus = req.query.review_status as string;
    const completionStatus = req.query.completion_status as string;
    const effectiveFrom = req.query.effective_from as string;
    const effectiveTo = req.query.effective_to as string;
    const reqKpiKey = req.query.kpi_key as string;
    const format = req.query.format as string || 'xlsx';
    
    if (!periodId) return res.status(400).json({ error: 'Missing period_id' });

    const supabaseAdmin = res.locals.supabaseAdmin || getSupabaseAdminClient(req);
    const userId = res.locals.user.id;
    const profile = res.locals.profile;
    const userRole = profile?.system_role;

    if (userRole !== 'manager' && userRole !== 'admin' && userRole !== 'executive') {
      return res.status(403).json({ error: 'access_denied', message: 'Staff users are not authorized' });
    }

    const scopeData = await resolveManagerScopeUnits(supabaseAdmin, userId, userRole);
    if (!scopeData) return res.status(403).json({ error: 'access_denied' });
    let allowedUnitIds = scopeData.scopeUnitIds;

    if (unitId) {
      if (!allowedUnitIds.has(unitId)) return res.status(403).json({ error: 'access_denied' });
      const { data: allUnits } = await supabaseAdmin.from('organization_units').select('id, parent_id');
      const requestedScope = getDescendantUnitIds(allUnits || [], unitId);
      allowedUnitIds = new Set([...allowedUnitIds].filter(x => requestedScope.has(x)));
    }
    const allowedUnitsArr = Array.from(allowedUnitIds);
    
    if (allowedUnitsArr.length === 0) {
      return res.status(404).send('Không có dữ liệu phù hợp để xuất.');
    }

    let query = supabaseAdmin.from('kpi_assignments')
      .select(\`
        id, period_id, template_id, template_version_id, assignee_type, assignee_user_id, assignee_organization_unit_id,
        assignee_unit_id_snapshot, status, effective_from, effective_to, created_at, assigned_at, config,
        period:period_id(id, name),
        template:template_id(id, name),
        assignee_user:assignee_user_id(id, full_name),
        assignee_unit:assignee_organization_unit_id(id, name),
        snapshot_unit:assignee_unit_id_snapshot(id, name)
      \`)
      .eq('period_id', periodId)
      .or(\`assignee_unit_id_snapshot.in.(\${allowedUnitsArr.join(',')}),assignee_organization_unit_id.in.(\${allowedUnitsArr.join(',')})\`);

    if (assigneeType && assigneeType !== 'all') query = query.eq('assignee_type', assigneeType);
    if (assignmentStatus && assignmentStatus !== 'all') query = query.eq('status', assignmentStatus);
    else query = query.not('status', 'eq', 'draft');
    if (resultMode === 'live') query = query.not('status', 'eq', 'locked');
    else if (resultMode === 'official') query = query.eq('status', 'locked');
    if (effectiveFrom) query = query.or(\`effective_to.gte.\${effectiveFrom},effective_to.is.null\`);
    if (effectiveTo) query = query.or(\`effective_from.lte.\${effectiveTo},effective_from.is.null\`);
    query = query.order('created_at', { ascending: false });

    const { data: rawAssignments, error } = await query;
    if (error) throw error;

    const assignmentMap = new Map<string, any>();
    for (const a of (rawAssignments || [])) {
      if (assignmentMap.has(a.id)) continue;
      const targetUnitId = a.assignee_type === 'individual'
        ? (a.assignee_unit_id_snapshot || a.assignee_organization_unit_id)
        : (a.assignee_organization_unit_id || a.assignee_unit_id_snapshot);
      if (!targetUnitId || !allowedUnitIds.has(targetUnitId)) continue;
      assignmentMap.set(a.id, a);
    }
    let filteredAssignments = Array.from(assignmentMap.values());

    const { finalAssignments, liveScoreMap, officialScoreMap, liveItemsMap, officialItemsMap, revMap } = await applyAdvancedFiltersAndBatchResolve(supabaseAdmin, filteredAssignments, { reviewStatus, completionStatus });

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Chi tiết KPI');

    sheet.columns = [
      { header: 'Kỳ KPI', key: 'period', width: 15 },
      { header: 'Mã Assignment', key: 'assignment_id', width: 20 },
      { header: 'Đối tượng', key: 'assignee_name', width: 25 },
      { header: 'Loại đối tượng', key: 'assignee_type', width: 15 },
      { header: 'Đơn vị', key: 'unit_name', width: 25 },
      { header: 'Mã KPI', key: 'kpi_code', width: 15 },
      { header: 'Tên KPI', key: 'kpi_name', width: 30 },
      { header: 'Trạng thái Assignment', key: 'status', width: 15 },
      { header: 'Trạng thái đánh giá', key: 'review_status', width: 15 },
      { header: 'Loại kết quả', key: 'result_mode', width: 15 },
      { header: 'Trạng thái dữ liệu', key: 'data_status', width: 15 },
      { header: 'Trọng số', key: 'weight', width: 10 },
      { header: 'Target', key: 'target', width: 15 },
      { header: 'Actual', key: 'actual', width: 15 },
      { header: 'Mức đạt (%)', key: 'ach', width: 15 },
      { header: 'Điểm KPI', key: 'raw_score', width: 15 },
      { header: 'Điểm theo trọng số', key: 'weighted_score', width: 20 },
      { header: 'Từ ngày', key: 'from', width: 15 },
      { header: 'Đến ngày', key: 'to', width: 15 }
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const sanitizeText = (text: any) => {
      if (typeof text !== 'string') return text;
      if (/^[=+ \-@]/.test(text)) return "'" + text;
      return text;
    };

    let hasData = false;
    for (const a of finalAssignments) {
      const isLocked = a.status === 'locked';
      const itemsMap = isLocked ? officialItemsMap : liveItemsMap;
      const items = itemsMap?.get(a.id) || [];
      
      const rev = revMap.get(a.id);
      let rs = rev?.status || a.config?.review?.status || null;
      if (!rs && isLocked) rs = 'approved';
      if (!rs) rs = 'not_started';

      let assigneeName = '';
      let unitName = '';
      if (a.assignee_type === 'individual') {
        assigneeName = a.assignee_user?.full_name || '';
        unitName = a.snapshot_unit?.name || a.assignee_unit?.name || '';
      } else {
        assigneeName = a.assignee_unit?.name || '';
        unitName = a.assignee_unit?.name || a.snapshot_unit?.name || '';
      }

      for (const it of items) {
        // Resolve item specifics
        let kpiCode = it.definition?.code || it.definition_snapshot?.code || it.kpi_definition_id || '';
        if (isLocked) {
           kpiCode = it.score_snapshot?.definition_snapshot?.code || kpiCode;
        }

        const kKey = it.kpi_definition_id || (kpiCode ? 'code:'+kpiCode : it.id);
        if (reqKpiKey && kKey !== reqKpiKey) continue;

        let kpiName = it.definition?.name || it.definition_snapshot?.name || 'Unknown';
        if (isLocked) {
           kpiName = it.score_snapshot?.definition_snapshot?.name || kpiName;
        }
        
        let weight = isLocked ? (Number(it.weight || it.score_snapshot?.weight) || 0) : (Number(it.weight) || 0);
        
        let target = '';
        let actual = '';
        let ach = '';
        let rawScore = '';
        let weightedScore = '';
        let dataStatus = 'Chưa có điểm';

        if (isLocked) {
          // official item format from itemReviews or a.config.review_items
          ach = it.final_achievement_percent !== null && it.final_achievement_percent !== undefined ? it.final_achievement_percent : (it.score_snapshot?.score_result?.achievement_percent || '');
          rawScore = it.final_raw_score !== null && it.final_raw_score !== undefined ? it.final_raw_score : (it.score_snapshot?.score_result?.raw_score || '');
          weightedScore = it.final_weighted_score !== null && it.final_weighted_score !== undefined ? it.final_weighted_score : (it.score_snapshot?.score_result?.weighted_score || '');
          if (rawScore !== '') dataStatus = 'Đã có điểm';
          target = it.score_snapshot?.target_config?.target_value || '';
          actual = it.score_snapshot?.score_result?.actual_value || '';
        } else {
           if (it.resolved_is_scored) {
             dataStatus = 'Đã có điểm';
             ach = it.resolved_ach;
             rawScore = it.resolved_raw;
             weightedScore = it.resolved_weighted;
             actual = it.resolved_actual;
           }
           target = it.target_config?.target_value || '';
        }

        const row = {
          period: sanitizeText(a.period?.name || ''),
          assignment_id: sanitizeText(a.id),
          assignee_name: sanitizeText(assigneeName),
          assignee_type: a.assignee_type === 'individual' ? 'Cá nhân' : 'Đơn vị',
          unit_name: sanitizeText(unitName),
          kpi_code: sanitizeText(kpiCode),
          kpi_name: sanitizeText(kpiName),
          status: a.status === 'locked' ? 'Đã khóa' : (a.status === 'active' ? 'Đang thực hiện' : a.status),
          review_status: rs,
          result_mode: isLocked ? 'Chính thức' : 'Tạm tính',
          data_status: dataStatus,
          weight: weight,
          target: target,
          actual: actual,
          ach: ach !== '' ? Number(ach).toFixed(2) : '',
          raw_score: rawScore !== '' ? Number(rawScore).toFixed(2) : '',
          weighted_score: weightedScore !== '' ? Number(weightedScore).toFixed(2) : '',
          from: a.effective_from ? new Date(a.effective_from).toISOString().split('T')[0] : '',
          to: a.effective_to ? new Date(a.effective_to).toISOString().split('T')[0] : ''
        };
        sheet.addRow(row);
        hasData = true;
      }
    }

    if (!hasData) {
      return res.status(404).send('Không có dữ liệu phù hợp để xuất.');
    }

    const scopeName = unitId ? 'Unit' : 'Dashboard';
    const dateStr = new Date().toISOString().split('T')[0];
    
    if (format === 'csv') {
      const csvBuffer = await workbook.csv.writeBuffer();
      // Add UTF-8 BOM
      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      const finalBuffer = Buffer.concat([bom, csvBuffer]);
      const filename = \`KPI_\${periodId}_\${scopeName}_\${dateStr}.csv\`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', \`attachment; filename="\${filename}"\`);
      return res.send(finalBuffer);
    } else {
      const filename = \`KPI_\${periodId}_\${scopeName}_\${dateStr}.xlsx\`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', \`attachment; filename="\${filename}"\`);
      await workbook.xlsx.write(res);
      return res.end();
    }
  } catch (err: any) {
    console.error('[API kpi_export] Error:', err);
    res.status(500).json({ error: err.message });
  }
});
`;

let serverContent = fs.readFileSync('server.ts', 'utf8');
serverContent = serverContent.replace(
  "if (process.env.NODE_ENV !== 'production') {",
  routeCode + "\n  if (process.env.NODE_ENV !== 'production') {"
);
fs.writeFileSync('server.ts', serverContent);
