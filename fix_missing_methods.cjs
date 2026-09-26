const fs = require('fs');
let code = fs.readFileSync('src/services/metric.service.ts', 'utf-8');

const newMethods = `
  async createMetricDefinition(
    payload: any,
    userId?: string
  ): Promise<MetricDefinition> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await (supabase.from('metric_definitions') as any)
      .insert([{
        ...payload,
        created_by: userId,
      }])
      .select()
      .single();

    if (error) {
        if (error.code === '23505') throw new Error('Mã chỉ số đã tồn tại. Vui lòng chọn mã khác.');
        throw error;
    }
    return data as MetricDefinition;
  },

  async updateMetricDefinition(
    id: string,
    updates: any
  ): Promise<MetricDefinition> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await (supabase.from('metric_definitions') as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
        if (error.code === '23505') throw new Error('Mã chỉ số đã tồn tại. Vui lòng chọn mã khác.');
        throw error;
    }
    return data as MetricDefinition;
  },

  async toggleMetricDefinition(id: string, is_active?: boolean): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');
    
    if (is_active === undefined) {
      const { data } = await (supabase.from('metric_definitions') as any).select('is_active').eq('id', id).single();
      is_active = !data?.is_active;
    }

    const { error } = await (supabase.from('metric_definitions') as any)
      .update({ is_active })
      .eq('id', id);

    if (error) throw error;
  },
`;

code = code.replace(/async _enrichMetricEntryWithDetails/g, newMethods + "\n  async _enrichMetricEntryWithDetails");
fs.writeFileSync('src/services/metric.service.ts', code);
