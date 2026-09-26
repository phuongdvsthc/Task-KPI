const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const routes = `
  // --- REPORT SOURCES API ---

  // Admin GET all report sources with assignments
  app.get('/api/admin/report-sources', authenticateAdmin, async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('report_sources')
        .select(\`
          *,
          report_source_unit_assignments (
            id,
            organization_unit_id,
            is_active,
            sort_order
          )
        \`)
        .order('sort_order');
      
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching report sources:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin GET single report source
  app.get('/api/admin/report-sources/:id', authenticateAdmin, async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('report_sources')
        .select(\`
          *,
          report_source_unit_assignments (
            id,
            organization_unit_id,
            is_active,
            sort_order
          )
        \`)
        .eq('id', req.params.id)
        .single();
      
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching report source:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin POST create report source
  app.post('/api/admin/report-sources', authenticateAdmin, async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user.id;
      const { code, name, category, description, is_active, sort_order, assignments } = req.body;
      
      const { data: source, error: sourceError } = await supabase
        .from('report_sources')
        .insert({
          code, name, category, description, is_active, sort_order,
          created_by: adminId
        })
        .select()
        .single();
        
      if (sourceError) throw sourceError;
      
      if (assignments && Array.isArray(assignments)) {
        const assignmentData = assignments.map(a => ({
          report_source_id: source.id,
          organization_unit_id: a.organization_unit_id,
          is_active: a.is_active !== undefined ? a.is_active : true,
          sort_order: a.sort_order || 0,
          created_by: adminId
        }));
        
        if (assignmentData.length > 0) {
          const { error: assignError } = await supabase
            .from('report_source_unit_assignments')
            .insert(assignmentData);
          if (assignError) throw assignError;
        }
      }
      
      res.json(source);
    } catch (error: any) {
      console.error('Error creating report source:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin PUT update report source
  app.put('/api/admin/report-sources/:id', authenticateAdmin, async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user.id;
      const id = req.params.id;
      const { code, name, category, description, is_active, sort_order, assignments } = req.body;
      
      const { data: source, error: sourceError } = await supabase
        .from('report_sources')
        .update({
          code, name, category, description, is_active, sort_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
        
      if (sourceError) throw sourceError;
      
      if (assignments && Array.isArray(assignments)) {
        // Delete old assignments
        await supabase
          .from('report_source_unit_assignments')
          .delete()
          .eq('report_source_id', id);
          
        const assignmentData = assignments.map(a => ({
          report_source_id: id,
          organization_unit_id: a.organization_unit_id,
          is_active: a.is_active !== undefined ? a.is_active : true,
          sort_order: a.sort_order || 0,
          created_by: adminId
        }));
        
        if (assignmentData.length > 0) {
          const { error: assignError } = await supabase
            .from('report_source_unit_assignments')
            .insert(assignmentData);
          if (assignError) throw assignError;
        }
      }
      
      res.json(source);
    } catch (error: any) {
      console.error('Error updating report source:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET active report sources for a specific organization unit (used by staff)
  app.get('/api/report-sources', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { organization_unit_id } = req.query;
      if (!organization_unit_id) {
        return res.status(400).json({ error: 'organization_unit_id is required' });
      }

      // We need to fetch report sources that are assigned to this organization unit and active
      const { data, error } = await supabase
        .from('report_source_unit_assignments')
        .select(\`
          sort_order,
          report_sources (
            id,
            code,
            name,
            category,
            description,
            is_active,
            sort_order
          )
        \`)
        .eq('organization_unit_id', organization_unit_id)
        .eq('is_active', true);
        
      if (error) throw error;
      
      // Filter out inactive sources and map to just the source object
      const sources = data
        .filter(item => item.report_sources && item.report_sources.is_active)
        .map(item => ({
          ...item.report_sources,
          assignment_sort_order: item.sort_order
        }))
        .sort((a, b) => {
          if (a.assignment_sort_order !== b.assignment_sort_order) {
            return a.assignment_sort_order - b.assignment_sort_order;
          }
          if (a.sort_order !== b.sort_order) {
            return a.sort_order - b.sort_order;
          }
          return a.name.localeCompare(b.name);
        });
        
      res.json(sources);
    } catch (error: any) {
      console.error('Error fetching active report sources:', error);
      res.status(500).json({ error: error.message });
    }
  });
`;

if (!code.includes('/api/admin/report-sources')) {
  code = code.replace(
    "// --- ASSETS API ---",
    routes + "\n  // --- ASSETS API ---"
  );
  fs.writeFileSync('server.ts', code);
  console.log('Routes added');
} else {
  console.log('Routes already exist');
}
