const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const authUserMiddleware = `
  const authenticateUser = async (req: Request, res: Response, next: express.NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ error: 'No authorization header' });
        return;
      }
      const token = authHeader.replace('Bearer ', '');
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('system_role')
        .eq('id', user.id)
        .single();
      if (profileError || !profile) {
        res.status(403).json({ error: 'Forbidden: Profile not found' });
        return;
      }

      res.locals.supabaseAdmin = supabaseAdmin;
      res.locals.user = user;
      res.locals.profile = profile;
      next();
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };
`;

const taskMembersEndpoint = `
  // GET /api/task-members
  app.get('/api/task-members', authenticateUser, async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const user = res.locals.user;
    const profile = res.locals.profile;
    const orgId = req.query.organization_unit_id as string;

    if (!orgId) {
      res.status(400).json({ error: 'Missing organization_unit_id' });
      return;
    }

    try {
      // Check permissions
      if (profile.system_role !== 'admin') {
        if (profile.system_role === 'executive' || profile.system_role === 'viewer') {
          res.status(403).json({ error: 'Forbidden: Role not allowed to create tasks' });
          return;
        }
        
        // For manager and staff, check if they belong to this org
        const { data: userMember, error: checkErr } = await supabaseAdmin
          .from('organization_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_unit_id', orgId)
          .maybeSingle();
          
        if (checkErr || !userMember) {
          res.status(403).json({ error: 'Forbidden: You do not have access to this organization' });
          return;
        }
      }

      // Fetch active members of the organization
      const { data: members, error: fetchErr } = await supabaseAdmin
        .from('organization_members')
        .select(\`
          user_id,
          profiles!inner (
            id,
            full_name,
            employee_code,
            job_title,
            is_active
          )
        \`)
        .eq('organization_unit_id', orgId)
        .eq('profiles.is_active', true);

      if (fetchErr) {
        res.status(500).json({ error: \`Database error: \${fetchErr.message}\` });
        return;
      }

      // Map to flat structure
      const formattedMembers = members.map((m: any) => ({
        id: m.profiles.id,
        full_name: m.profiles.full_name,
        employee_code: m.profiles.employee_code,
        job_title: m.profiles.job_title
      }));

      res.json(formattedMembers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
`;

if (!code.includes('const authenticateUser =')) {
  code = code.replace('// Helper middleware for Supabase Admin Auth', authUserMiddleware + '\n\n  // Helper middleware for Supabase Admin Auth');
}
if (!code.includes('app.get(\'/api/task-members\'')) {
  code = code.replace('// UPDATE User', taskMembersEndpoint + '\n\n  // UPDATE User');
}

fs.writeFileSync('server.ts', code);
