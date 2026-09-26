const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const traceRpcCode = `
// ==========================================
// KPI TRACE RPC (v0.4.3-D)
// ==========================================
app.post('/api/rpc/kpi_submit_manual_actual', authenticateUser, async (req: Request, res: Response) => {
  const { p_assignment_item_binding_id, p_value_numeric, p_value_boolean, p_value_text, p_value_json, p_note } = req.body;
  if (!p_assignment_item_binding_id) return res.status(400).json({ error: 'Missing p_assignment_item_binding_id' });
  
  try {
    const supabase = (req as any).supabase;
    const userId = (req as any).user.id;
    
    // 1. Find binding
    const { data: binding } = await supabase.from('kpi_assignment_item_bindings').select('*').eq('id', p_assignment_item_binding_id).single();
    if (!binding) return res.status(404).json({ error: 'binding_not_found' });
    if (binding.source_type !== 'manual') return res.status(400).json({ error: 'invalid_source_type' });
    
    // 2. Verify kpi_can_enter_manual_actual
    const { data: canEnter } = await supabase.rpc('kpi_can_enter_manual_actual', { p_assignment_binding_id: p_assignment_item_binding_id });
    if (!canEnter) return res.status(403).json({ error: 'access_denied' });
    
    // 3. Assignment status
    const { data: item } = await supabase.from('kpi_assignment_items').select('*, assignment:kpi_assignments(*)').eq('id', binding.assignment_item_id).single();
    if (!item || !['assigned', 'active'].includes(item.assignment.status)) {
      return res.status(400).json({ error: 'invalid_assignment_status' });
    }
    
    // 4. Note required?
    if (binding.source_config?.require_note === true && (!p_note || p_note.trim() === '')) {
      return res.status(400).json({ error: 'note_required' });
    }
    
    let suppliedCount = 0;
    if (p_value_numeric !== undefined && p_value_numeric !== null) suppliedCount++;
    if (p_value_boolean !== undefined && p_value_boolean !== null) suppliedCount++;
    if (p_value_text !== undefined && p_value_text !== null) suppliedCount++;
    if (p_value_json !== undefined && p_value_json !== null) suppliedCount++;
    if (suppliedCount !== 1) return res.status(400).json({ error: 'exactly_one_value_required' });
    
    // 5. Find current head
    const { data: entries } = await supabase.from('kpi_manual_actual_entries').select('id, supersedes_entry_id').eq('assignment_item_id', binding.assignment_item_id);
    const supersedesSet = new Set((entries || []).map((e: any) => e.supersedes_entry_id).filter(Boolean));
    const heads = (entries || []).filter((e: any) => !supersedesSet.has(e.id));
    
    if (heads.length > 1) return res.status(400).json({ error: 'invalid_manual_history' });
    const headId = heads.length === 1 ? heads[0].id : null;
    
    // 6. Insert
    const { data: newEntry, error: insErr } = await supabase.from('kpi_manual_actual_entries').insert({
      assignment_item_id: binding.assignment_item_id,
      value_numeric: p_value_numeric,
      value_boolean: p_value_boolean,
      value_text: p_value_text,
      value_json: p_value_json,
      note: p_note,
      entered_by: userId,
      supersedes_entry_id: headId
    }).select().single();
    
    if (insErr) throw insErr;
    
    res.json({ id: newEntry.id, status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rpc/kpi_get_actual_trace', authenticateUser, async (req: Request, res: Response) => {
  const { p_assignment_item_id } = req.body;
  if (!p_assignment_item_id) return res.status(400).json({ error: 'Missing p_assignment_item_id' });
  
  try {
    const supabase = (req as any).supabase;
    
    // Security Check
    const { data: canView } = await supabase.rpc('kpi_can_view_assignment_item', { p_assignment_item_id });
    if (canView === false) return res.status(403).json({ error: 'access_denied' });
    
    const { data: item } = await supabase.from('kpi_assignment_items').select('*, assignment:kpi_assignments(*, period:kpi_periods(*))').eq('id', p_assignment_item_id).single();
    if (!item) return res.status(404).json({ error: 'item_not_found' });
    
    const assignment = item.assignment;
    const period = assignment.period;
    const start_date = assignment.effective_from || period.start_date;
    const end_date = assignment.effective_to || period.end_date;
    
    const { data: binding } = await supabase.from('kpi_assignment_item_bindings')
      .select('*').eq('assignment_item_id', p_assignment_item_id).eq('is_active', true).eq('binding_key', 'primary').single();
      
    if (!binding) return res.json({ status: 'no_binding' });
    const source_type = binding.source_type;
    
    const getOrgIds = async (orgId: string) => { return [orgId]; };
    const org_ids = assignment.assignee_type === 'organization' ? await getOrgIds(assignment.assignee_organization_unit_id) : [];

    if (source_type === 'manual') {
       const { data: history } = await supabase.from('kpi_manual_actual_entries')
         .select('*, user:entered_by(full_name)')
         .eq('assignment_item_id', p_assignment_item_id)
         .order('created_at', { ascending: false });
         
       if (!history || history.length === 0) return res.json({ status: 'no_data', source_type: 'manual' });
       
       const mappedHistory = history.map((e: any) => ({
         entry_id: e.id,
         value_numeric: e.value_numeric,
         value_boolean: e.value_boolean,
         value_text: e.value_text,
         value_json: e.value_json,
         note: e.note,
         entered_by: e.entered_by,
         entered_by_name: e.user?.full_name,
         entered_at: e.created_at,
         supersedes_entry_id: e.supersedes_entry_id
       }));
       
       return res.json({
         status: 'resolved',
         source_type: 'manual',
         history: mappedHistory,
         current_entry: mappedHistory[0]
       });
    } else if (source_type === 'metric') {
       if (!binding.source_reference_id) return res.json({ status: 'invalid_config' });
       const { data: def } = await supabase.from('metric_definitions').select('*').eq('id', binding.source_reference_id).single();
       
       let query = supabase.from('metric_entries')
         .select('*, user:user_id(full_name), org:organization_unit_id(name)')
         .eq('metric_definition_id', binding.source_reference_id)
         .gte('period_start', start_date).lte('period_start', end_date);
         
       if (assignment.assignee_type === 'individual') query = query.eq('user_id', assignment.assignee_user_id);
       else query = query.eq('organization_unit_id', assignment.assignee_organization_unit_id);
       
       const { data: details } = await query.order('period_start', { ascending: false }).limit(100);
       const { count } = await supabase.from('metric_entries')
         .select('id', { count: 'exact', head: true })
         .eq('metric_definition_id', binding.source_reference_id)
         .gte('period_start', start_date).lte('period_start', end_date)
         .eq(assignment.assignee_type === 'individual' ? 'user_id' : 'organization_unit_id', 
             assignment.assignee_type === 'individual' ? assignment.assignee_user_id : assignment.assignee_organization_unit_id);
             
       return res.json({
         status: 'resolved',
         source_type: 'metric',
         metric_name: def?.name,
         metric_code: def?.code,
         aggregation_method: binding.aggregation_method,
         date_from: start_date,
         date_to: end_date,
         total_record_count: count || 0,
         detail_row_count: details?.length || 0,
         truncated: (count || 0) > 100,
         details: (details || []).map((d: any) => ({
            id: d.id, value: d.value, period_start: d.period_start, period_end: d.period_end,
            user_name: d.user?.full_name, org_name: d.org?.name
         }))
       });
    } else if (source_type === 'calculated_metric') {
       return res.json({
         status: 'resolved',
         source_type: 'calculated_metric',
         message: 'Calculated metric breakdown uses metric engine dependencies.'
       });
    } else if (source_type === 'task') {
       let query = supabase.from('tasks').select('*')
         .gte('start_date', start_date).lte('start_date', end_date)
         .eq('owner_id', assignment.assignee_user_id);
         
       const { data: details } = await query.order('created_at', { ascending: false }).limit(100);
       const { count } = await supabase.from('tasks').select('id', { count: 'exact', head: true })
         .gte('start_date', start_date).lte('start_date', end_date).eq('owner_id', assignment.assignee_user_id);
         
       return res.json({
         status: 'resolved',
         source_type: 'task',
         measure: binding.source_config?.measure,
         date_from: start_date,
         date_to: end_date,
         total_record_count: count || 0,
         detail_row_count: details?.length || 0,
         truncated: (count || 0) > 100,
         details: (details || []).map((d: any) => ({
           id: d.id, title: d.title, status: d.status, due_date: d.due_date, completed_at: d.completed_at, start_date: d.start_date
         }))
       });
    } else {
       return res.json({ status: 'unsupported_source' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
`;

if (!code.includes('/api/rpc/kpi_submit_manual_actual')) {
  const target = "if (process.env.NODE_ENV !== 'production') {";
  const index = code.lastIndexOf(target);
  if (index !== -1) {
    code = code.slice(0, index) + traceRpcCode + '\n  ' + code.slice(index);
    fs.writeFileSync('server.ts', code);
    console.log('Successfully injected API endpoints to server.ts');
  }
}
