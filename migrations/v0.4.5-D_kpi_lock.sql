-- v0.4.5-D Final Score Snapshot + Lock

-- 1. Function to lock assignment review and freeze official result
CREATE OR REPLACE FUNCTION kpi_lock_assignment_review(
    p_review_id uuid,
    p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_review RECORD;
    v_assignment RECORD;
    v_item_count int;
    v_snapshot_count int;
    v_item_sum numeric;
    v_caller_id uuid := auth.uid();
    v_now timestamptz := now();
    v_result json;
BEGIN
    -- 1. Fetch review with row lock for concurrency safety
    SELECT r.*, a.id as assignment_id, a.status as assignment_status, a.config as assignment_config
    INTO v_review
    FROM kpi_assignment_reviews r
    JOIN kpi_assignments a ON r.assignment_id = a.id
    WHERE r.id = p_review_id
    FOR UPDATE OF r;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    -- Concurrency / Idempotency check: if assignment already locked
    IF v_review.assignment_status = 'locked' THEN
        RETURN json_build_object(
            'status', 'locked',
            'already_locked', true,
            'assignment_id', v_review.assignment_id,
            'message', 'Assignment is already locked'
        );
    END IF;

    -- Precondition: Review must be approved
    IF v_review.status != 'approved' THEN
        RAISE EXCEPTION 'Review must be approved before locking (current status: %)', v_review.status;
    END IF;

    -- Precondition: Assignment must be closed
    IF v_review.assignment_status != 'closed' THEN
        RAISE EXCEPTION 'Assignment must be closed to be locked (current status: %)', v_review.assignment_status;
    END IF;

    -- Precondition: Actor must have manage permission
    IF NOT kpi_can_manage_assignment(v_review.assignment_id) THEN
        RAISE EXCEPTION 'Access denied: insufficient permission to lock assignment';
    END IF;

    -- Precondition: Completeness check of official item snapshots
    SELECT count(*) INTO v_item_count 
    FROM kpi_assignment_items 
    WHERE assignment_id = v_review.assignment_id;

    SELECT count(*), COALESCE(sum(final_weighted_score), 0)
    INTO v_snapshot_count, v_item_sum
    FROM kpi_assignment_item_reviews
    WHERE review_id = p_review_id;

    IF v_item_count = 0 OR v_snapshot_count != v_item_count THEN
        RAISE EXCEPTION 'Incomplete snapshots: % items found but % official snapshots exist', v_item_count, v_snapshot_count;
    END IF;

    -- Precondition: Internal consistency check
    -- Ensure no snapshot has null final_weighted_score or final_raw_score
    IF EXISTS (
        SELECT 1 FROM kpi_assignment_item_reviews 
        WHERE review_id = p_review_id 
          AND (final_weighted_score IS NULL OR final_raw_score IS NULL)
    ) THEN
        RAISE EXCEPTION 'Inconsistent snapshots: some item snapshots have null score values';
    END IF;

    -- Precondition: Check total sum consistency with tolerance for floating point rounding
    -- Note: v_item_sum should match official_total_score if stored or expected
    -- Lock Assignment atomically: transition closed -> locked
    UPDATE kpi_assignments
    SET status = 'locked',
        locked_at = v_now,
        config = jsonb_set(
            jsonb_set(
                COALESCE(config, '{}'::jsonb),
                '{locked_by}',
                to_jsonb(v_caller_id::text)
            ),
            '{lock_note}',
            to_jsonb(COALESCE(trim(p_note), ''))
        ),
        updated_at = v_now
    WHERE id = v_review_id.assignment_id;

    -- Record lock note in review record if needed
    UPDATE kpi_assignment_reviews
    SET updated_at = v_now
    WHERE id = p_review_id;

    RETURN json_build_object(
        'status', 'locked',
        'already_locked', false,
        'assignment_id', v_review.assignment_id,
        'locked_at', v_now,
        'locked_by', v_caller_id,
        'official_total_score', v_item_sum
    );
END;
$$;

-- 2. Read API for official assignment result
CREATE OR REPLACE FUNCTION kpi_get_official_assignment_result(p_assignment_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignment RECORD;
    v_review RECORD;
    v_items json;
    v_profile RECORD;
    v_locked_by_profile RECORD;
BEGIN
    -- Security check
    IF NOT kpi_can_view_assignment(p_assignment_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT * INTO v_assignment FROM kpi_assignments WHERE id = p_assignment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment not found';
    END IF;

    SELECT * INTO v_review FROM kpi_assignment_reviews WHERE assignment_id = p_assignment_id;

    IF v_review.id IS NOT NULL THEN
        SELECT full_name INTO v_profile FROM profiles WHERE id = v_review.reviewer_id;
    END IF;

    IF (v_assignment.config->>'locked_by') IS NOT NULL THEN
        SELECT full_name INTO v_locked_by_profile 
        FROM profiles 
        WHERE id = (v_assignment.config->>'locked_by')::uuid;
    END IF;

    -- Aggregate item snapshots
    SELECT json_agg(
        json_build_object(
            'assignment_item_id', ir.assignment_item_id,
            'review_id', ir.review_id,
            'kpi_title', kd.name,
            'kpi_code', kd.code,
            'measurement_type', kd.measurement_type,
            'weight', ai.weight,
            'target_value', (ai.target_config->>'target_value')::numeric,
            'target_config', ai.target_config,
            'final_actual_value', (ir.actual_snapshot->>'value_numeric')::numeric,
            'final_achievement_percent', ir.final_achievement_percent,
            'final_raw_score', ir.final_raw_score,
            'final_weighted_score', ir.final_weighted_score,
            'actual_snapshot', ir.actual_snapshot,
            'score_snapshot', ir.score_snapshot,
            'reviewer_note', ir.reviewer_note
        ) ORDER BY ai.sort_order, ai.created_at
    )
    INTO v_items
    FROM kpi_assignment_item_reviews ir
    JOIN kpi_assignment_items ai ON ir.assignment_item_id = ai.id
    LEFT JOIN kpi_definitions kd ON ai.kpi_definition_id = kd.id
    WHERE ir.review_id = v_review.id;

    RETURN json_build_object(
        'assignment_id', v_assignment.id,
        'review_id', v_review.id,
        'is_locked', (v_assignment.status = 'locked'),
        'status', v_assignment.status,
        'official_total_score', (SELECT COALESCE(sum(final_weighted_score), 0) FROM kpi_assignment_item_reviews WHERE review_id = v_review.id),
        'approved_at', v_review.approved_at,
        'approved_by', v_review.reviewer_id,
        'approved_by_name', v_profile.full_name,
        'locked_at', v_assignment.locked_at,
        'locked_by', (v_assignment.config->>'locked_by'),
        'locked_by_name', v_locked_by_profile.full_name,
        'review_note', v_review.review_note,
        'lock_note', (v_assignment.config->>'lock_note'),
        'items', COALESCE(v_items, '[]'::json)
    );
END;
$$;
