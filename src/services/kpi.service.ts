import { supabase } from '../lib/supabase/client';
import { 
  KpiPeriod, 
  KpiObjective, 
  KpiDefinition, 
  KpiTemplate, 
  KpiTemplateVersion, 
  KpiTemplateItem,
  KpiTemplateStatus 
} from '../types/kpi';

export const kpiService = {
  // --- Periods ---
  async getPeriods(orgUnitId?: string | null): Promise<{ data: KpiPeriod[] | null; error: Error | null }> {
    try {
      let query = supabase.from('kpi_periods').select('*').order('start_date', { ascending: false });
      if (orgUnitId !== undefined) {
        if (orgUnitId === null) {
          query = query.is('organization_unit_id', null);
        } else {
          query = query.eq('organization_unit_id', orgUnitId);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return { data: data as KpiPeriod[], error: null };
    } catch (err: any) {
      console.error('getPeriods error:', err);
      return { data: null, error: err };
    }
  },

  async createPeriod(period: Partial<KpiPeriod>): Promise<{ data: KpiPeriod | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_periods') as any).insert([period]).select().single();
      if (error) throw error;
      return { data: data as KpiPeriod, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async updatePeriod(id: string, period: Partial<KpiPeriod>): Promise<{ data: KpiPeriod | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_periods') as any).update(period).eq('id', id).select().single();
      if (error) throw error;
      return { data: data as KpiPeriod, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  // --- Objectives ---
  async getObjectives(orgUnitId?: string | null): Promise<{ data: KpiObjective[] | null; error: Error | null }> {
    try {
      let query = supabase.from('kpi_objectives').select('*').order('sort_order', { ascending: true });
      if (orgUnitId !== undefined) {
        if (orgUnitId === null) {
          query = query.is('organization_unit_id', null);
        } else {
          query = query.eq('organization_unit_id', orgUnitId);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return { data: data as KpiObjective[], error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async createObjective(objective: Partial<KpiObjective>): Promise<{ data: KpiObjective | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_objectives') as any).insert([objective]).select().single();
      if (error) throw error;
      return { data: data as KpiObjective, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async updateObjective(id: string, objective: Partial<KpiObjective>): Promise<{ data: KpiObjective | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_objectives') as any).update(objective).eq('id', id).select().single();
      if (error) throw error;
      return { data: data as KpiObjective, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  // --- Definitions ---
  async getDefinitions(orgUnitId?: string | null): Promise<{ data: KpiDefinition[] | null; error: Error | null }> {
    try {
      let query = supabase.from('kpi_definitions').select('*').order('code', { ascending: true });
      if (orgUnitId !== undefined) {
        if (orgUnitId === null) {
          query = query.is('owner_organization_unit_id', null);
        } else {
          query = query.eq('owner_organization_unit_id', orgUnitId);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return { data: data as KpiDefinition[], error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async createDefinition(definition: Partial<KpiDefinition>): Promise<{ data: KpiDefinition | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_definitions') as any).insert([definition]).select().single();
      if (error) throw error;
      return { data: data as KpiDefinition, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async updateDefinition(id: string, definition: Partial<KpiDefinition>): Promise<{ data: KpiDefinition | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_definitions') as any).update(definition).eq('id', id).select().single();
      if (error) throw error;
      return { data: data as KpiDefinition, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  // --- Templates ---
  async getTemplates(orgUnitId?: string | null): Promise<{ data: (KpiTemplate & { versions?: KpiTemplateVersion[] })[] | null; error: Error | null }> {
    try {
      let query = supabase.from('kpi_templates').select('*, versions:kpi_template_versions(*)').order('created_at', { ascending: false });
      if (orgUnitId !== undefined) {
        if (orgUnitId === null) {
          query = query.is('owner_organization_unit_id', null);
        } else {
          query = query.eq('owner_organization_unit_id', orgUnitId);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      
      const templates = data.map((t: any) => {
        const sortedVersions = (t.versions || []).sort((a: any, b: any) => b.version_no - a.version_no);
        const latest = sortedVersions[0];
        return {
          ...t,
          latest_version: latest?.version_no,
          latest_version_status: latest?.status,
        };
      });
      return { data: templates, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async createTemplate(template: Partial<KpiTemplate>): Promise<{ data: KpiTemplate | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_templates') as any).insert([template]).select().single();
      if (error || !data) throw error || new Error('Không thể tạo mẫu KPI');
      
      // Auto create draft version 1
      const { error: vError } = await (supabase.from('kpi_template_versions') as any).insert([{
        template_id: (data as any).id,
        version_no: 1,
        status: 'draft'
      }]);
      if (vError) throw vError;
      
      return { data: data as KpiTemplate, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async updateTemplate(id: string, template: Partial<KpiTemplate>): Promise<{ data: KpiTemplate | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_templates') as any).update(template).eq('id', id).select().single();
      if (error) throw error;
      return { data: data as KpiTemplate, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  // --- Template Versions ---
  async getTemplateVersions(templateId: string): Promise<{ data: KpiTemplateVersion[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.from('kpi_template_versions').select('*').eq('template_id', templateId).order('version_no', { ascending: false });
      if (error) throw error;
      return { data: data as KpiTemplateVersion[], error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async cloneTemplateVersion(templateId: string, sourceVersionId: string): Promise<{ data: KpiTemplateVersion | null; error: Error | null }> {
    try {
      const { data: versions, error: vError } = await supabase.from('kpi_template_versions')
        .select('version_no')
        .eq('template_id', templateId)
        .order('version_no', { ascending: false })
        .limit(1);
      if (vError) throw vError;
      const nextVersion = ((versions as any[])?.[0]?.version_no || 0) + 1;
      
      const { data: newVersion, error: createError } = await (supabase.from('kpi_template_versions') as any).insert([{
        template_id: templateId,
        version_no: nextVersion,
        status: 'draft'
      }]).select().single();
      if (createError || !newVersion) throw createError || new Error('Không thể nhân bản phiên bản');

      // Copy items
      const { data: sourceItems, error: itemsError } = await supabase.from('kpi_template_items')
        .select('*')
        .eq('template_version_id', sourceVersionId);
      if (itemsError) throw itemsError;

      if (sourceItems && sourceItems.length > 0) {
        const newItems = (sourceItems as any[]).map(item => ({
          template_version_id: (newVersion as any).id,
          kpi_definition_id: item.kpi_definition_id,
          objective_id: item.objective_id,
          weight: item.weight,
          target_config: item.target_config,
          scoring_config: item.scoring_config,
          cap_percent: item.cap_percent,
          is_required: item.is_required,
          sort_order: item.sort_order,
          config: item.config
        }));
        const { error: insertItemsError } = await (supabase.from('kpi_template_items') as any).insert(newItems);
        if (insertItemsError) throw insertItemsError;
      }

      return { data: newVersion as KpiTemplateVersion, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async updateTemplateVersionStatus(versionId: string, status: KpiTemplateStatus): Promise<{ data: KpiTemplateVersion | null; error: Error | null }> {
    try {
      const updateData: any = { status };
      let query = (supabase.from('kpi_template_versions') as any).update(updateData).eq('id', versionId);
      
      // If publishing, ensure it is currently draft
      if (status === 'published') {
        query = query.eq('status', 'draft');
      }
      
      const { data, error } = await query.select().single();
      if (error) throw error;
      
      if (!data) {
        throw new Error("Không thể cập nhật trạng thái. Dữ liệu không tồn tại hoặc bạn không có quyền thực hiện.");
      }
      
      return { data: data as KpiTemplateVersion, error: null };
    } catch (err: any) {
      console.error('updateTemplateVersionStatus error:', err);
      return { data: null, error: err };
    }
  },

  // --- Template Items ---
  async getTemplateItems(versionId: string): Promise<{ data: KpiTemplateItem[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.from('kpi_template_items')
        .select('*, definition:kpi_definitions(*), objective:kpi_objectives(*)')
        .eq('template_version_id', versionId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return { data: data as KpiTemplateItem[], error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async addTemplateItem(item: Partial<KpiTemplateItem>): Promise<{ data: KpiTemplateItem | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_template_items') as any).insert([item]).select().single();
      if (error) throw error;
      return { data: data as KpiTemplateItem, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async updateTemplateItem(id: string, item: Partial<KpiTemplateItem>): Promise<{ data: KpiTemplateItem | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_template_items') as any).update(item).eq('id', id).select().single();
      if (error) throw error;
      return { data: data as KpiTemplateItem, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async deleteTemplateItem(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.from('kpi_template_items').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }
};
