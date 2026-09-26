import { Request, Response } from 'express';
import { aiPromptRegistryService } from './aiPromptRegistry.service';
import { requirePermission, requireAnyCapability } from '../../../server/authorization/authorization.middleware';

export function registerPromptRegistryRoutes(app: any, authMiddleware: any, getSupabaseAdminClient: any) {
  app.get('/api/admin/prompt-registry', authMiddleware, requireAnyCapability(['ai.prompt_manage', 'system.settings.view']), async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdminClient(req);
      const { data, error } = await supabaseAdmin
        .from('ai_prompt_definitions')
        .select(`
          *,
          ai_prompt_versions!left (
             id, version_number, status
          )
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/prompt-registry', authMiddleware, requirePermission('ai.prompt_manage'), async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdminClient(req);
      const { prompt_key, name, description, feature_group, system_prompt, user_prompt_template, output_mode } = req.body;
      
      if (!prompt_key || !name) {
        return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Prompt Key and Name are required.' });
      }

      const { data: user } = await supabaseAdmin.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));

      const { data: defData, error: defError } = await supabaseAdmin
        .from('ai_prompt_definitions')
        .insert({
          prompt_key, 
          name, 
          description: description || '', 
          feature_group: feature_group || 'general',
          created_by: user?.user?.id
        })
        .select()
        .single();
        
      if (defError) {
        if (defError.code === '23505') {
          return res.status(400).json({ error: 'DUPLICATE_KEY', message: `Prompt key '${prompt_key}' already exists.` });
        }
        throw defError;
      }

      const { error: verError } = await supabaseAdmin
        .from('ai_prompt_versions')
        .insert({
          prompt_definition_id: defData.id,
          version_number: 1,
          status: 'active',
          system_prompt: system_prompt || '',
          user_prompt_template: user_prompt_template || '',
          output_mode: output_mode || 'text',
          created_by: user?.user?.id,
          activated_by: user?.user?.id,
          activated_at: new Date().toISOString()
        });

      if (verError) {
        await supabaseAdmin.from('ai_prompt_definitions').delete().eq('id', defData.id);
        throw verError;
      }

      res.json(defData);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/prompt-registry/:id/status', authMiddleware, requirePermission('ai.prompt_manage'), async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdminClient(req);
      const { enabled } = req.body;
      
      const { data, error } = await supabaseAdmin
        .from('ai_prompt_definitions')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
        
      if (error) throw error;
      if (data) aiPromptRegistryService.invalidateCache(data.prompt_key);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/prompt-registry/:id/versions', authMiddleware, requireAnyCapability(['ai.prompt_manage', 'system.settings.view']), async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdminClient(req);
      const { data, error } = await supabaseAdmin
        .from('ai_prompt_versions')
        .select('*')
        .eq('prompt_definition_id', req.params.id)
        .order('version_number', { ascending: false });
        
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/prompt-registry/:id/versions', authMiddleware, requirePermission('ai.prompt_manage'), async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdminClient(req);
      const definitionId = req.params.id;
      
      const { data: latest } = await supabaseAdmin
        .from('ai_prompt_versions')
        .select('version_number')
        .eq('prompt_definition_id', definitionId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();
        
      const nextVersion = (latest?.version_number || 0) + 1;

      const { data: user } = await supabaseAdmin.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
      
      const { data: activeVersion } = await supabaseAdmin
        .from('ai_prompt_versions')
        .select('*')
        .eq('prompt_definition_id', definitionId)
        .eq('status', 'active')
        .single();

      const newVersion = {
        prompt_definition_id: definitionId,
        version_number: nextVersion,
        status: 'draft',
        system_prompt: activeVersion?.system_prompt || '',
        user_prompt_template: activeVersion?.user_prompt_template || '',
        output_mode: activeVersion?.output_mode || 'text',
        response_schema: activeVersion?.response_schema || null,
        default_temperature: activeVersion?.default_temperature || null,
        default_max_output_tokens: activeVersion?.default_max_output_tokens || null,
        created_by: user?.user?.id
      };

      const { data, error } = await supabaseAdmin
        .from('ai_prompt_versions')
        .insert(newVersion)
        .select()
        .single();
        
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/prompt-registry/versions/:versionId', authMiddleware, requirePermission('ai.prompt_manage'), async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdminClient(req);
      const versionId = req.params.versionId;
      
      const { data: current, error: fetchErr } = await supabaseAdmin
        .from('ai_prompt_versions')
        .select('status')
        .eq('id', versionId)
        .single();
        
      if (fetchErr || !current) throw new Error('Version not found');
      if (current.status !== 'draft') {
        return res.status(400).json({ error: 'PROMPT_VERSION_IMMUTABLE', message: 'Only draft versions can be edited' });
      }

      const { system_prompt, user_prompt_template, output_mode, response_schema, default_temperature, default_max_output_tokens, notes } = req.body;

      const { data, error } = await supabaseAdmin
        .from('ai_prompt_versions')
        .update({
          system_prompt, user_prompt_template, output_mode, response_schema, default_temperature, default_max_output_tokens, notes
        })
        .eq('id', versionId)
        .select()
        .single();
        
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/prompt-registry/versions/:versionId/activate', authMiddleware, requirePermission('ai.prompt_manage'), async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdminClient(req);
      const versionId = req.params.versionId;

      const { data: targetVersion, error: fetchErr } = await supabaseAdmin
        .from('ai_prompt_versions')
        .select('*')
        .eq('id', versionId)
        .single();
        
      if (fetchErr || !targetVersion) {
        return res.status(404).json({ error: 'VERSION_NOT_FOUND', message: 'Phiên bản prompt không tồn tại.' });
      }

      const definitionId = targetVersion.prompt_definition_id;

      // If already active, return immediately
      if (targetVersion.status === 'active') {
        return res.json(targetVersion);
      }

      const { data: user } = await supabaseAdmin.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));

      // Find currently active version for rollback safety
      const { data: previousActiveVersions } = await supabaseAdmin
        .from('ai_prompt_versions')
        .select('id, version_number')
        .eq('prompt_definition_id', definitionId)
        .eq('status', 'active');

      const previousActiveId = previousActiveVersions?.[0]?.id;

      // 1. Retire previous active version
      const { error: retireErr } = await supabaseAdmin
        .from('ai_prompt_versions')
        .update({ status: 'retired' })
        .eq('prompt_definition_id', definitionId)
        .eq('status', 'active');

      if (retireErr) {
        return res.status(500).json({ 
          error: 'RETIRE_FAILED', 
          message: retireErr.message || 'Không thể chuyển phiên bản cũ sang retired.' 
        });
      }

      // 2. Activate target version
      const { data: activatedVersion, error: activateErr } = await supabaseAdmin
        .from('ai_prompt_versions')
        .update({ 
          status: 'active', 
          activated_at: new Date().toISOString(), 
          activated_by: user?.user?.id 
        })
        .eq('id', versionId)
        .select()
        .single();
        
      if (activateErr) {
        // Rollback: Re-activate the previously active version so definition is never left without an active version
        if (previousActiveId) {
          await supabaseAdmin
            .from('ai_prompt_versions')
            .update({ status: 'active' })
            .eq('id', previousActiveId);
        }
        return res.status(500).json({ 
          error: 'ACTIVATE_FAILED', 
          message: activateErr.message || 'Không thể kích hoạt phiên bản mới. Đã khôi phục phiên bản trước.' 
        });
      }

      // 3. Invalidate cache for prompt_key
      const { data: def } = await supabaseAdmin
        .from('ai_prompt_definitions')
        .select('prompt_key')
        .eq('id', definitionId)
        .single();

      if (def) {
        aiPromptRegistryService.invalidateCache(def.prompt_key);
      }

      res.json(activatedVersion);
    } catch (err: any) {
      res.status(500).json({ error: err.code || 'INTERNAL_ERROR', message: err.message });
    }
  });
}
