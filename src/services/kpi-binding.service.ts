import { getSupabaseClient } from './supabaseClient';
import { KpiTemplateItemBinding } from '../types/kpi';
import { MetricDefinition } from '../types/metric';

export const kpiBindingService = {
  /**
   * Fetch all bindings for a specific template version
   */
  async getTemplateVersionBindings(versionId: string): Promise<{ data: KpiTemplateItemBinding[] | null; error: Error | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      // First get all item IDs for the version
      const { data: items, error: itemsError } = await (supabase.from('kpi_template_items') as any)
        .select('id')
        .eq('template_version_id', versionId);
        
      if (itemsError) throw itemsError;
      
      if (!items || items.length === 0) return { data: [], error: null };
      
      const itemIds = items.map((item: any) => item.id);
      
      const { data, error } = await (supabase.from('kpi_template_item_bindings') as any)
        .select('*')
        .in('template_item_id', itemIds)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      return { data: data as KpiTemplateItemBinding[], error: null };
    } catch (err: any) {
      console.error('[KpiBindingService] getTemplateVersionBindings error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetch bindings for a specific template item
   */
  async getTemplateItemBindings(templateItemId: string): Promise<{ data: KpiTemplateItemBinding[] | null; error: Error | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      const { data, error } = await (supabase.from('kpi_template_item_bindings') as any)
        .select('*')
        .eq('template_item_id', templateItemId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      return { data: data as KpiTemplateItemBinding[], error: null };
    } catch (err: any) {
      console.error('[KpiBindingService] getTemplateItemBindings error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Create a new template item binding
   */
  async createTemplateItemBinding(payload: Omit<KpiTemplateItemBinding, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: KpiTemplateItemBinding | null; error: Error | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      const { data, error } = await (supabase.from('kpi_template_item_bindings') as any)
        .insert([payload])
        .select()
        .single();
        
      if (error) throw error;
      return { data: data as KpiTemplateItemBinding, error: null };
    } catch (err: any) {
      console.error('[KpiBindingService] createTemplateItemBinding error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Update an existing template item binding
   */
  async updateTemplateItemBinding(bindingId: string, payload: Partial<KpiTemplateItemBinding>): Promise<{ data: KpiTemplateItemBinding | null; error: Error | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      const { data, error } = await (supabase.from('kpi_template_item_bindings') as any)
        .update(payload)
        .eq('id', bindingId)
        .select()
        .single();
        
      if (error) throw error;
      return { data: data as KpiTemplateItemBinding, error: null };
    } catch (err: any) {
      console.error('[KpiBindingService] updateTemplateItemBinding error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Delete a template item binding
   */
  async deleteTemplateItemBinding(bindingId: string): Promise<{ error: Error | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { error: new Error('Supabase client not initialized') };

    try {
      const { error } = await (supabase.from('kpi_template_item_bindings') as any)
        .delete()
        .eq('id', bindingId);
        
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      console.error('[KpiBindingService] deleteTemplateItemBinding error:', err);
      return { error: err };
    }
  },

  /**
   * Get available metric sources (excluding calculated ones if they are marked differently, or just get all metrics for now)
   */
  async getAvailableMetricSources(): Promise<MetricDefinition[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data, error } = await (supabase.from('metric_definitions') as any)
        .select('id, name, code')
        .eq('is_active', true)
        // Adjust filter based on how calculated metrics are stored if necessary
        .order('name');
        
      if (error) return [];
      return data || [];
    } catch (err) {
      return [];
    }
  },

  /**
   * Get available calculated metric sources
   */
  async getAvailableCalculatedMetricSources(): Promise<MetricDefinition[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      // For now assuming we might distinguish calculated metrics. If not, just return empty or same list.
      // E.g., if there's a category = 'calculated', add .eq('category', 'calculated')
      const { data, error } = await (supabase.from('metric_definitions') as any)
        .select('id, name, code')
        .eq('is_active', true)
        // .eq('metric_type', 'calculated') // if schema supports it
        .order('name');
        
      if (error) return [];
      return data || [];
    } catch (err) {
      return [];
    }
  },

  /**
   * Get available task measures
   */
  getTaskMeasures(): { value: string; label: string }[] {
    return [
      { value: 'assigned_count', label: 'Số lượng công việc được giao' },
      { value: 'completed_count', label: 'Số lượng công việc đã hoàn thành' },
      { value: 'completion_rate', label: 'Tỷ lệ hoàn thành công việc (%)' },
      { value: 'completed_on_time_count', label: 'Số lượng công việc hoàn thành đúng hạn' },
      { value: 'on_time_completion_rate', label: 'Tỷ lệ hoàn thành công việc đúng hạn (%)' },
      { value: 'overdue_count', label: 'Số lượng công việc quá hạn' },
      { value: 'overdue_rate', label: 'Tỷ lệ công việc quá hạn (%)' }
    ];
  }
};
