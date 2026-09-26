import { getSupabaseClient } from './supabaseClient';

export interface KpiScoringResult {
  assignment_item_id: string;
  status: 'scored' | 'not_scored' | 'invalid_target' | 'invalid_config' | 'unsupported_method';
  reason: 'actual_not_available' | 'invalid_target' | 'invalid_actual' | 'invalid_config' | 'unsupported_method' | 'access_denied' | 'assignment_draft' | null;
  target: any;
  actual: string | null;
  raw_achievement_percent: number | null;
  achievement_percent: number | null;
  raw_score: number | null;
  weight_percent: number;
  weighted_score: number | null;
  trace: any;
}

export interface KpiAssignmentScoreResult {
  assignment_id: string;
  status: 'complete' | 'partial' | 'not_scored';
  total_weight: number;
  scored_weight: number;
  unscored_weight: number;
  total_score: number;
  items: KpiScoringResult[];
}

export const kpiScoringService = {
  /**
   * Calculate live score for a single KPI Assignment Item.
   */
  async resolveAssignmentItemScore(assignmentItemId: string): Promise<{ data: KpiScoringResult | null; error: Error | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      const { data, error } = await (supabase.rpc as any)('kpi_resolve_assignment_item_score', {
        p_assignment_item_id: assignmentItemId
      });
      if (error) throw error;
      return { data: data as KpiScoringResult, error: null };
    } catch (err: any) {
      console.error('[KpiScoringService] resolveAssignmentItemScore error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Calculate live scores for all items in a KPI Assignment.
   */
  async resolveAssignmentScore(assignmentId: string): Promise<{ data: KpiAssignmentScoreResult | null; error: Error | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      const { data, error } = await (supabase.rpc as any)('kpi_resolve_assignment_score', {
        p_assignment_id: assignmentId
      });
      if (error) throw error;
      return { data: data as KpiAssignmentScoreResult, error: null };
    } catch (err: any) {
      console.error('[KpiScoringService] resolveAssignmentScore error:', err);
      return { data: null, error: err };
    }
  }
};
