const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf-8');

const settingsRoutes = `
  // --------------------------------------------------------
  // SYSTEM SETTINGS
  // --------------------------------------------------------

  const PUBLIC_SETTINGS_WHITELIST = [
    'app_name',
    'organization_short_name',
    'organization_address',
    'organization_phone',
    'organization_email',
    'organization_website',
    'timezone',
    'date_format',
    'locale',
    'logo_path',
    'logo_small_path',
    'favicon_path'
  ];

  // GET Public Settings
  app.get('/api/settings/public', async (req: Request, res: Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

      // Get root organization
      const { data: rootOrg } = await supabaseAdmin
        .from('organization_units')
        .select('name')
        .is('parent_id', null)
        .eq('unit_type', 'school')
        .maybeSingle();

      // Get whitelisted settings
      const { data: settings } = await supabaseAdmin
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', PUBLIC_SETTINGS_WHITELIST)
        .eq('is_public', true);

      const settingsMap = (settings || []).reduce((acc: any, cur: any) => {
        acc[cur.setting_key] = cur.setting_value;
        return acc;
      }, {});

      res.json({
        organizationName: rootOrg?.name || '',
        organizationShortName: settingsMap.organization_short_name || '',
        appName: settingsMap.app_name || '',
        organizationAddress: settingsMap.organization_address || '',
        organizationPhone: settingsMap.organization_phone || '',
        organizationEmail: settingsMap.organization_email || '',
        organizationWebsite: settingsMap.organization_website || '',
        timezone: settingsMap.timezone || 'Asia/Ho_Chi_Minh',
        dateFormat: settingsMap.date_format || 'dd/MM/yyyy',
        locale: settingsMap.locale || 'vi-VN',
        logoPath: settingsMap.logo_path || '',
        logoSmallPath: settingsMap.logo_small_path || '',
        faviconPath: settingsMap.favicon_path || ''
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET Admin Settings
  app.get('/api/admin/settings', authenticateAdmin, async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    try {
      const { data: rootOrg } = await supabaseAdmin
        .from('organization_units')
        .select('id, name, code')
        .is('parent_id', null)
        .eq('unit_type', 'school')
        .maybeSingle();

      const { data: settings } = await supabaseAdmin
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', PUBLIC_SETTINGS_WHITELIST);

      const settingsMap = (settings || []).reduce((acc: any, cur: any) => {
        acc[cur.setting_key] = cur.setting_value;
        return acc;
      }, {});

      res.json({
        rootOrg: rootOrg || null,
        settings: settingsMap
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT Admin Settings
  app.put('/api/admin/settings', authenticateAdmin, async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const adminUserId = res.locals.adminUser.id;
    const { rootOrgName, settings } = req.body;

    try {
      if (!rootOrgName || !rootOrgName.trim()) throw new Error('Tên đơn vị là bắt buộc');
      if (!settings.app_name || !settings.app_name.trim()) throw new Error('Tên phần mềm là bắt buộc');
      if (!settings.organization_short_name || !settings.organization_short_name.trim()) throw new Error('Tên viết tắt là bắt buộc');

      if (settings.organization_email && !/^\\S+@\\S+\\.\\S+$/.test(settings.organization_email)) {
        throw new Error('Email không hợp lệ');
      }

      if (settings.organization_website) {
        try {
          new URL(settings.organization_website);
        } catch {
          throw new Error('Website không hợp lệ');
        }
      }

      // 1. Update Root Org
      const { data: currentRoot } = await supabaseAdmin
        .from('organization_units')
        .select('id')
        .is('parent_id', null)
        .eq('unit_type', 'school')
        .maybeSingle();

      if (currentRoot) {
        const { error: rootErr } = await supabaseAdmin
          .from('organization_units')
          .update({ name: rootOrgName.trim(), updated_at: new Date().toISOString() })
          .eq('id', currentRoot.id);
        if (rootErr) throw new Error(\`Lỗi cập nhật tên đơn vị: \${rootErr.message}\`);
      } else {
         // Create root org if not exists
         const { error: insertRootErr } = await supabaseAdmin.from('organization_units').insert({
            name: rootOrgName.trim(),
            code: 'ROOT',
            unit_type: 'school',
            is_active: true
         });
         if (insertRootErr) throw new Error(\`Lỗi khởi tạo đơn vị root: \${insertRootErr.message}\`);
      }

      // 2. Update System Settings
      const updatableKeys = [
        'app_name', 'organization_short_name', 'organization_address',
        'organization_phone', 'organization_email', 'organization_website',
        'timezone', 'date_format', 'locale'
      ];

      for (const key of updatableKeys) {
        const val = settings[key];
        const finalVal = val !== undefined ? (typeof val === 'string' ? val.trim() : val) : null;
        
        // Find existing
        const { data: existing } = await supabaseAdmin.from('system_settings').select('id').eq('setting_key', key).maybeSingle();
        if (existing) {
          await supabaseAdmin.from('system_settings').update({ setting_value: finalVal, updated_by: adminUserId, updated_at: new Date().toISOString() }).eq('id', existing.id);
        } else {
          await supabaseAdmin.from('system_settings').insert({
            setting_key: key,
            setting_value: finalVal,
            is_public: true,
            updated_by: adminUserId
          });
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Vite middleware for development
`;

serverCode = serverCode.replace('  // Vite middleware for development', settingsRoutes);

fs.writeFileSync('server.ts', serverCode);

console.log('Settings Routes added.');
