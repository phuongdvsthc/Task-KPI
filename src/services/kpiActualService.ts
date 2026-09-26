import { getSupabaseClient } from './supabaseClient';

export interface KpiActualResolverResult {
  assignment_item_id: string;
  status: 'resolved' | 'no_binding' | 'no_data' | 'unsupported_source' | 'ambiguous_binding' | 'invalid_config' | 'invalid_manual_history';
  value_numeric: number | null;
  value_boolean: boolean | null;
  value_text: string | null;
  value_json: any | null;
  source_type: string;
  resolved_at: string;
  trace: any;
}

export interface KpiManualActualPayload {
  assignment_item_binding_id: string;
  value_numeric?: number | null;
  value_boolean?: boolean | null;
  value_text?: string | null;
  value_json?: any | null;
  note?: string | null;
}

export const kpiActualService = {
  /**
   * Resolve live Actual values for a single KPI Assignment Item.
   * This calls the kpi_resolve_assignment_item_actual RPC in the database.
   */
  async resolveAssignmentItemActual(assignmentItemId: string): Promise<{ data: KpiActualResolverResult | null; error: Error | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      const { data, error } = await (supabase.rpc as any)('kpi_resolve_assignment_item_actual', {
        p_assignment_item_id: assignmentItemId
      });

      if (error) throw error;
      return { data: data as KpiActualResolverResult, error: null };
    } catch (err: any) {
      console.error('[KpiActualService] resolveAssignmentItemActual error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Resolve live Actual values for all items in a KPI Assignment.
   * This calls the kpi_resolve_assignment_actuals RPC for efficiency.
   */
  async resolveAssignmentActuals(assignmentId: string): Promise<{ data: KpiActualResolverResult[] | null; error: Error | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      const { data, error } = await (supabase.rpc as any)('kpi_resolve_assignment_actuals', {
        p_assignment_id: assignmentId
      });

      if (error) throw error;
      return { data: data as KpiActualResolverResult[], error: null };
    } catch (err: any) {
      console.error('[KpiActualService] resolveAssignmentActuals error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Submit a new manual actual entry.
   */
  async submitManualActual(payload: KpiManualActualPayload): Promise<{ data: any | null; error: Error | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      const { data, error } = await (supabase.rpc as any)('kpi_submit_manual_actual', {
        p_assignment_item_binding_id: payload.assignment_item_binding_id,
        p_value_numeric: payload.value_numeric,
        p_value_boolean: payload.value_boolean,
        p_value_text: payload.value_text,
        p_value_json: payload.value_json,
        p_note: payload.note
      });
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      console.error('[KpiActualService] submitManualActual error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Get the data trace for an actual value.
   */
  async getActualTrace(assignmentItemId: string): Promise<{ data: any | null; error: Error | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      const { data, error } = await (supabase.rpc as any)('kpi_get_actual_trace', {
        p_assignment_item_id: assignmentItemId
      });
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      console.error('[KpiActualService] getActualTrace error:', err);
      return { data: null, error: err };
    }
  }
};
