import { getSupabaseClient } from './supabaseClient';
import { KpiAssignmentReview, KpiAssignmentItemReview } from '../types/kpi';
import { mapReviewErrorMessage } from '../utils/kpiReviewFormatter';
import { safeParseResponseJson } from '../lib/api';

// Active request tracking to prevent concurrent / duplicate calls (Requirement C8)
const activeRequests = new Set<string>();

async function getAuthToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

export const kpiReviewService = {
  /**
   * Helper to map review errors to Vietnamese messages
   */
  mapReviewError(error: any): string {
    return mapReviewErrorMessage(error);
  },

  /**
   * Fetch review record and snapshot items for an assignment
   */
  async getReviewByAssignment(assignmentId: string): Promise<{ data: KpiAssignmentReview | null; error: Error | null }> {
    if (!assignmentId) return { data: null, error: new Error('assignment_id is required') };

    const supabase = getSupabaseClient();

    // 1. Try backend authorized API first
    try {
      const token = await getAuthToken();
      if (token) {
        const res = await fetch(`/api/kpi/assignments/${assignmentId}/review`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const parsed = await safeParseResponseJson<any>(res);
          if (parsed.ok && parsed.data?.data) {
            return { data: parsed.data.data as KpiAssignmentReview, error: null };
          }
        }
      }
    } catch (apiErr) {
      console.warn('[kpiReviewService] Backend review fetch fallback to Supabase:', apiErr);
    }

    // 2. Direct Supabase query fallback if table exists
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      const { data: review, error: rError } = await supabase
        .from('kpi_assignment_reviews')
        .select(`
          *,
          reviewer:reviewer_id (id, full_name, email)
        `)
        .eq('assignment_id', assignmentId)
        .maybeSingle();

      if (rError) {
        // If table doesn't exist yet, return null without error
        if (rError.code === 'PGRST205' || rError.message?.includes('schema cache')) {
          return { data: null, error: null };
        }
        throw rError;
      }

      if (!review) {
        return { data: null, error: null };
      }

      const rev = review as any;

      // Fetch items if approved or exists
      const { data: items, error: iError } = await (supabase
        .from('kpi_assignment_item_reviews') as any)
        .select('*')
        .eq('review_id', rev.id);

      if (iError && iError.code !== 'PGRST205') {
        console.warn('[kpiReviewService] Items fetch warning:', iError);
      }

      let officialTotalScore: number | null = null;
      if (items && items.length > 0) {
        officialTotalScore = items.reduce((sum: number, it: any) => sum + (Number(it.final_weighted_score) || 0), 0);
      }

      const reviewData: KpiAssignmentReview = {
        id: rev.id,
        assignment_id: rev.assignment_id,
        status: rev.status,
        reviewer_id: rev.reviewer_id,
        review_note: rev.review_note,
        started_at: rev.started_at,
        returned_at: rev.returned_at,
        approved_at: rev.approved_at,
        created_at: rev.created_at,
        updated_at: rev.updated_at,
        reviewer: rev.reviewer,
        reviewer_name: rev.reviewer?.full_name || null,
        official_total_score: officialTotalScore,
        items: (items || []) as KpiAssignmentItemReview[]
      };

      return { data: reviewData, error: null };
    } catch (err: any) {
      console.error('[kpiReviewService] getReviewByAssignment error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Start review on a closed assignment: not_started -> in_review
   */
  async startReview(assignmentId: string): Promise<{ data: { review_id: string } | null; error: Error | null }> {
    if (!assignmentId) return { data: null, error: new Error('assignment_id is required') };

    const lockKey = `startReview:${assignmentId}`;
    if (activeRequests.has(lockKey)) {
      return { data: null, error: new Error('Thao tác đang được thực hiện, vui lòng không nhấn nhiều lần.') };
    }
    activeRequests.add(lockKey);

    try {
      // 1. Try Supabase RPC first if available
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('kpi_start_assignment_review', {
            p_assignment_id: assignmentId
          });
          if (!rpcError && rpcData) {
            return { data: { review_id: rpcData }, error: null };
          }
          if (rpcError && rpcError.code !== 'PGRST202' && !rpcError.message?.includes('Could not find')) {
            throw rpcError;
          }
        } catch (rpcErr: any) {
          if (rpcErr.code !== 'PGRST202' && !rpcErr.message?.includes('Could not find')) {
            throw rpcErr;
          }
        }
      }

      // 2. Call authorized backend API route
      const token = await getAuthToken();
      const res = await fetch('/api/rpc/kpi_start_assignment_review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ p_assignment_id: assignmentId })
      });

      const parsed = await safeParseResponseJson<any>(res);
      const json = parsed.data;
      if (!res.ok) {
        throw new Error(json?.error || json?.message || parsed.error || 'Lỗi khi bắt đầu đánh giá');
      }

      return { data: { review_id: json?.review_id || json?.id }, error: null };
    } catch (err: any) {
      console.error('[kpiReviewService] startReview error:', err);
      return { data: null, error: err };
    } finally {
      activeRequests.delete(lockKey);
    }
  },

  /**
   * Return review with a required note: in_review -> returned
   */
  async returnReview(reviewId: string, note: string): Promise<{ data: any | null; error: Error | null }> {
    if (!reviewId) return { data: null, error: new Error('review_id is required') };
    const trimmedNote = (note || '').trim();
    if (!trimmedNote) {
      return { data: null, error: new Error('review_note_required') };
    }

    const lockKey = `returnReview:${reviewId}`;
    if (activeRequests.has(lockKey)) {
      return { data: null, error: new Error('Thao tác đang được thực hiện, vui lòng không nhấn nhiều lần.') };
    }
    activeRequests.add(lockKey);

    try {
      // 1. Try Supabase RPC first
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('kpi_return_assignment_review', {
            p_review_id: reviewId,
            p_note: trimmedNote
          });
          if (!rpcError) {
            return { data: rpcData || { status: 'returned' }, error: null };
          }
          if (rpcError && rpcError.code !== 'PGRST202' && !rpcError.message?.includes('Could not find')) {
            throw rpcError;
          }
        } catch (rpcErr: any) {
          if (rpcErr.code !== 'PGRST202' && !rpcErr.message?.includes('Could not find')) {
            throw rpcErr;
          }
        }
      }

      // 2. Call authorized backend API route
      const token = await getAuthToken();
      const res = await fetch('/api/rpc/kpi_return_assignment_review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ p_review_id: reviewId, p_note: trimmedNote })
      });

      const parsed = await safeParseResponseJson<any>(res);
      const json = parsed.data;
      if (!res.ok) {
        throw new Error(json?.error || json?.message || parsed.error || 'Lỗi khi trả lại đánh giá');
      }

      return { data: json, error: null };
    } catch (err: any) {
      console.error('[kpiReviewService] returnReview error:', err);
      return { data: null, error: err };
    } finally {
      activeRequests.delete(lockKey);
    }
  },

  /**
   * Resubmit review: returned -> in_review
   */
  async resubmitReview(reviewId: string, note?: string): Promise<{ data: any | null; error: Error | null }> {
    if (!reviewId) return { data: null, error: new Error('review_id is required') };

    const lockKey = `resubmitReview:${reviewId}`;
    if (activeRequests.has(lockKey)) {
      return { data: null, error: new Error('Thao tác đang được thực hiện, vui lòng không nhấn nhiều lần.') };
    }
    activeRequests.add(lockKey);

    try {
      const trimmedNote = note ? note.trim() : null;

      // 1. Try Supabase RPC first
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('kpi_resubmit_assignment_review', {
            p_review_id: reviewId,
            p_note: trimmedNote
          });
          if (!rpcError) {
            return { data: rpcData || { status: 'in_review' }, error: null };
          }
          if (rpcError && rpcError.code !== 'PGRST202' && !rpcError.message?.includes('Could not find')) {
            throw rpcError;
          }
        } catch (rpcErr: any) {
          if (rpcErr.code !== 'PGRST202' && !rpcErr.message?.includes('Could not find')) {
            throw rpcErr;
          }
        }
      }

      // 2. Call authorized backend API route
      const token = await getAuthToken();
      const res = await fetch('/api/rpc/kpi_resubmit_assignment_review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ p_review_id: reviewId, p_note: trimmedNote })
      });

      const parsed = await safeParseResponseJson<any>(res);
      const json = parsed.data;
      if (!res.ok) {
        throw new Error(json?.error || json?.message || parsed.error || 'Lỗi khi gửi lại đánh giá');
      }

      return { data: json, error: null };
    } catch (err: any) {
      console.error('[kpiReviewService] resubmitReview error:', err);
      return { data: null, error: err };
    } finally {
      activeRequests.delete(lockKey);
    }
  },

  /**
   * Approve review and create snapshots: in_review -> approved
   * Note: Client only sends reviewId and optional note.
   * Client NEVER sends actuals, scores, or achievements!
   */
  async approveReview(reviewId: string, note?: string): Promise<{ data: any | null; error: Error | null }> {
    if (!reviewId) return { data: null, error: new Error('review_id is required') };

    const lockKey = `approveReview:${reviewId}`;
    if (activeRequests.has(lockKey)) {
      return { data: null, error: new Error('Thao tác đang được thực hiện, vui lòng không nhấn nhiều lần.') };
    }
    activeRequests.add(lockKey);

    try {
      const trimmedNote = note ? note.trim() : null;

      // 1. Try Supabase RPC first
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('kpi_approve_assignment_review', {
            p_review_id: reviewId,
            p_note: trimmedNote
          });
          if (!rpcError) {
            return { data: rpcData || { status: 'approved' }, error: null };
          }
          if (rpcError && rpcError.code !== 'PGRST202' && !rpcError.message?.includes('Could not find')) {
            throw rpcError;
          }
        } catch (rpcErr: any) {
          if (rpcErr.code !== 'PGRST202' && !rpcErr.message?.includes('Could not find')) {
            throw rpcErr;
          }
        }
      }

      // 2. Call authorized backend API route
      const token = await getAuthToken();
      const res = await fetch('/api/rpc/kpi_approve_assignment_review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ p_review_id: reviewId, p_note: trimmedNote })
      });

      const parsed = await safeParseResponseJson<any>(res);
      const json = parsed.data;
      if (!res.ok) {
        throw new Error(json?.error || json?.message || parsed.error || 'Lỗi khi phê duyệt đánh giá');
      }

      return { data: json, error: null };
    } catch (err: any) {
      console.error('[kpiReviewService] approveReview error:', err);
      return { data: null, error: err };
    } finally {
      activeRequests.delete(lockKey);
    }
  },

  /**
   * Fetch item snapshots for a review
   */
  async getReviewItems(reviewId: string): Promise<{ data: KpiAssignmentItemReview[] | null; error: Error | null }> {
    if (!reviewId) return { data: [], error: null };
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

    try {
      const { data, error } = await supabase
        .from('kpi_assignment_item_reviews')
        .select('*')
        .eq('review_id', reviewId);

      if (error) {
        if (error.code === 'PGRST205') return { data: [], error: null };
        throw error;
      }
      return { data: data as KpiAssignmentItemReview[], error: null };
    } catch (err: any) {
      console.error('[kpiReviewService] getReviewItems error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Lock an approved review and freeze official KPI result
   * Frontend sends ONLY review_id and note (does NOT send score, locked_by, locked_at)
   */
  async lockAssignmentReview(reviewId: string, note?: string): Promise<{ data: any | null; error: Error | null }> {
    if (!reviewId) return { data: null, error: new Error('review_id is required') };

    const lockKey = `lockAssignmentReview:${reviewId}`;
    if (activeRequests.has(lockKey)) {
      return { data: null, error: new Error('Thao tác khóa đang được thực hiện, vui lòng không nhấn nhiều lần.') };
    }
    activeRequests.add(lockKey);

    const trimmedNote = (note || '').trim();

    try {
      // 1. Try Supabase RPC first if available
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('kpi_lock_assignment_review', {
            p_review_id: reviewId,
            p_note: trimmedNote || null
          });
          if (!rpcError && rpcData) {
            return { data: rpcData, error: null };
          }
          if (rpcError && rpcError.code !== 'PGRST202' && !rpcError.message?.includes('Could not find')) {
            throw rpcError;
          }
        } catch (rpcErr: any) {
          if (rpcErr.code !== 'PGRST202' && !rpcErr.message?.includes('Could not find')) {
            throw rpcErr;
          }
        }
      }

      // 2. Call backend API route
      const token = await getAuthToken();
      const res = await fetch('/api/rpc/kpi_lock_assignment_review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ p_review_id: reviewId, p_note: trimmedNote || null })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.message || 'Lỗi khi khóa kết quả KPI');
      }

      return { data: json, error: null };
    } catch (err: any) {
      console.error('[kpiReviewService] lockAssignmentReview error:', err);
      return { data: null, error: err };
    } finally {
      activeRequests.delete(lockKey);
    }
  },

  /**
   * Get official approved & locked assignment result
   */
  async getOfficialAssignmentResult(assignmentId: string): Promise<{ data: any | null; error: Error | null }> {
    if (!assignmentId) return { data: null, error: new Error('assignment_id is required') };

    try {
      // 1. Try Supabase RPC if available
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('kpi_get_official_assignment_result', {
            p_assignment_id: assignmentId
          });
          if (!rpcError && rpcData) {
            return { data: rpcData, error: null };
          }
        } catch {}
      }

      // 2. Call backend API route
      const token = await getAuthToken();
      const res = await fetch(`/api/rpc/kpi_get_official_assignment_result?p_assignment_id=${assignmentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.message || 'Lỗi khi tải kết quả chính thức');
      }

      return { data: json, error: null };
    } catch (err: any) {
      console.error('[kpiReviewService] getOfficialAssignmentResult error:', err);
      return { data: null, error: err };
    }
  }
};
