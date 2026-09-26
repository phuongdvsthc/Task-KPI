const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf-8');

const orgRoutes = `
  // --------------------------------------------------------
  // ORGANIZATION UNITS (Admin only)
  // --------------------------------------------------------

  // GET All organization units
  app.get('/api/admin/organization-units', authenticateAdmin, async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    try {
      const { data, error } = await supabaseAdmin
        .from('organization_units')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
        
      if (error) throw new Error(error.message);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET Single organization unit
  app.get('/api/admin/organization-units/:id', authenticateAdmin, async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    try {
      const { data, error } = await supabaseAdmin
        .from('organization_units')
        .select('*')
        .eq('id', req.params.id)
        .single();
        
      if (error) throw new Error(error.message);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST Create organization unit
  app.post('/api/admin/organization-units', authenticateAdmin, async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const { name, code, unit_type, parent_id, description, sort_order, is_active } = req.body;
    
    try {
      if (!name) throw new Error('Tên đơn vị là bắt buộc');
      if (!code) throw new Error('Mã đơn vị là bắt buộc');
      
      const cleanCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
        throw new Error('Mã đơn vị chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới');
      }

      // Check code uniqueness
      const { data: existing } = await supabaseAdmin
        .from('organization_units')
        .select('id')
        .eq('code', cleanCode)
        .maybeSingle();
        
      if (existing) {
        throw new Error('Mã đơn vị đã tồn tại');
      }

      // Check parent constraint
      if (parent_id) {
         const { data: parent } = await supabaseAdmin.from('organization_units').select('is_active').eq('id', parent_id).single();
         if (!parent || !parent.is_active) throw new Error('Đơn vị cấp trên không tồn tại hoặc đã bị vô hiệu hóa');
      }

      const { data, error } = await supabaseAdmin
        .from('organization_units')
        .insert({
           name, 
           code: cleanCode, 
           unit_type, 
           parent_id: parent_id || null, 
           description, 
           sort_order: sort_order || 0, 
           is_active: is_active ?? true
        })
        .select()
        .single();
        
      if (error) throw new Error(error.message);
      res.json(data);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT Update organization unit
  app.put('/api/admin/organization-units/:id', authenticateAdmin, async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const id = req.params.id;
    const { name, code, unit_type, parent_id, description, sort_order, is_active } = req.body;
    
    try {
      if (!name) throw new Error('Tên đơn vị là bắt buộc');
      if (!code) throw new Error('Mã đơn vị là bắt buộc');

      // 1. Get current
      const { data: current, error: currentErr } = await supabaseAdmin.from('organization_units').select('*').eq('id', id).single();
      if (currentErr || !current) throw new Error('Không tìm thấy đơn vị');

      // 2. Prevent invalid operations on ROOT
      const isRoot = !current.parent_id && current.unit_type === 'school';
      if (isRoot) {
         if (parent_id) throw new Error('Không thể gán đơn vị cha cho root (Trường)');
         if (is_active === false) throw new Error('Không thể vô hiệu hóa đơn vị root');
         // We do allow name, code, description, sort_order
      }

      // 3. Validation code
      const cleanCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
        throw new Error('Mã đơn vị chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới');
      }

      if (cleanCode !== current.code) {
        const { data: existing } = await supabaseAdmin.from('organization_units').select('id').eq('code', cleanCode).maybeSingle();
        if (existing) throw new Error('Mã đơn vị đã tồn tại');
      }

      // 4. Validate Parent & Cycle
      if (parent_id && parent_id !== current.parent_id) {
         if (parent_id === id) throw new Error('Đơn vị cha không hợp lệ (không thể chọn chính mình)');
         
         const { data: parentInfo } = await supabaseAdmin.from('organization_units').select('is_active').eq('id', parent_id).single();
         if (!parentInfo || !parentInfo.is_active) throw new Error('Đơn vị cấp trên không tồn tại hoặc đã bị vô hiệu hóa');

         // Check cycle: find all ancestors of parent_id, if any is \`id\`, then cycle
         let checkId = parent_id;
         while (checkId) {
             const { data: ancestor } = await supabaseAdmin.from('organization_units').select('parent_id').eq('id', checkId).single();
             if (!ancestor) break;
             if (ancestor.parent_id === id) {
                 throw new Error('Tạo thành vòng lặp: Đơn vị cha không thể là đơn vị con của đơn vị hiện tại');
             }
             checkId = ancestor.parent_id;
         }
      }

      // 5. Check deactivate constraint
      if (is_active === false && current.is_active === true) {
         const { data: activeChildren } = await supabaseAdmin.from('organization_units').select('id').eq('parent_id', id).eq('is_active', true).limit(1);
         if (activeChildren && activeChildren.length > 0) {
             throw new Error('Đơn vị vẫn còn đơn vị trực thuộc đang hoạt động. Hãy ngừng các đơn vị con trước.');
         }
      }

      const { data, error } = await supabaseAdmin
        .from('organization_units')
        .update({
           name, 
           code: cleanCode, 
           unit_type: isRoot ? 'school' : unit_type, 
           parent_id: isRoot ? null : (parent_id || null), 
           description, 
           sort_order: sort_order || 0, 
           is_active: isRoot ? true : (is_active ?? true),
           updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw new Error(error.message);
      res.json(data);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE organization unit
  app.delete('/api/admin/organization-units/:id', authenticateAdmin, async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const id = req.params.id;
    
    try {
      const { data: current, error: currentErr } = await supabaseAdmin.from('organization_units').select('*').eq('id', id).single();
      if (currentErr || !current) throw new Error('Không tìm thấy đơn vị');

      const isRoot = !current.parent_id && current.unit_type === 'school';
      if (isRoot) {
         throw new Error('Không thể xóa đơn vị root (Trường)');
      }

      // Check dependencies
      // 1. organization_units.parent_id
      const { count: c1 } = await supabaseAdmin.from('organization_units').select('*', { count: 'exact', head: true }).eq('parent_id', id);
      if (c1 > 0) throw new Error('Không thể xóa đơn vị vì đã có dữ liệu phát sinh. Hãy sử dụng Ngừng sử dụng.');

      // 2. organization_members.organization_unit_id
      const { count: c2 } = await supabaseAdmin.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_unit_id', id);
      if (c2 > 0) throw new Error('Không thể xóa đơn vị vì đã có dữ liệu phát sinh. Hãy sử dụng Ngừng sử dụng.');

      // 3. tasks.organization_unit_id
      const { count: c3 } = await supabaseAdmin.from('tasks').select('*', { count: 'exact', head: true }).eq('organization_unit_id', id);
      if (c3 > 0) throw new Error('Không thể xóa đơn vị vì đã có dữ liệu phát sinh. Hãy sử dụng Ngừng sử dụng.');

      // 4. daily_reports.organization_unit_id
      const { count: c4 } = await supabaseAdmin.from('daily_reports').select('*', { count: 'exact', head: true }).eq('organization_unit_id', id);
      if (c4 > 0) throw new Error('Không thể xóa đơn vị vì đã có dữ liệu phát sinh. Hãy sử dụng Ngừng sử dụng.');

      // 5. metric_definitions.organization_unit_id
      const { count: c5 } = await supabaseAdmin.from('metric_definitions').select('*', { count: 'exact', head: true }).eq('organization_unit_id', id);
      if (c5 > 0) throw new Error('Không thể xóa đơn vị vì đã có dữ liệu phát sinh. Hãy sử dụng Ngừng sử dụng.');

      // 6. metric_entries.organization_unit_id
      const { count: c6 } = await supabaseAdmin.from('metric_entries').select('*', { count: 'exact', head: true }).eq('organization_unit_id', id);
      if (c6 > 0) throw new Error('Không thể xóa đơn vị vì đã có dữ liệu phát sinh. Hãy sử dụng Ngừng sử dụng.');

      const { error: delError } = await supabaseAdmin.from('organization_units').delete().eq('id', id);
      if (delError) throw new Error(delError.message);

      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Vite middleware for development
`;

serverCode = serverCode.replace('  // Vite middleware for development', orgRoutes);

fs.writeFileSync('server.ts', serverCode);

console.log('Routes added.');
