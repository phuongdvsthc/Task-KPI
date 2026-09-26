-- v0.4.5-B KPI Review Workflow API

-- 1. START REVIEW
CREATE OR REPLACE FUNCTION kpi_start_assignment_review(p_assignment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_review_id uuid;
    v_assignment RECORD;
    v_existing_status kpi_review_status;
BEGIN
    -- Validate permissions
    IF NOT kpi_can_manage_assignment(p_assignment_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Get assignment details
    SELECT * INTO v_assignment FROM kpi_assignments WHERE id = p_assignment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment not found';
    END IF;

    IF v_assignment.status != 'closed' THEN
        RAISE EXCEPTION 'Assignment must be closed before review can start';
    END IF;

    -- Check existing review
    SELECT id, status INTO v_review_id, v_existing_status 
    FROM kpi_assignment_reviews 
    WHERE assignment_id = p_assignment_id;

    IF v_review_id IS NOT NULL THEN
        IF v_existing_status = 'approved' THEN
            RAISE EXCEPTION 'Review is already approved';
        END IF;
        
        -- Update existing review to in_review
        UPDATE kpi_assignment_reviews 
        SET status = 'in_review',
            reviewer_id = auth.uid(),
            started_at = COALESCE(started_at, now()),
            updated_at = now()
        WHERE id = v_review_id;
        
        RETURN v_review_id;
    END IF;

    -- Create new review
    INSERT INTO kpi_assignment_reviews (
        assignment_id, 
        status, 
        reviewer_id, 
        started_at
    ) VALUES (
        p_assignment_id, 
        'in_review', 
        auth.uid(), 
        now()
    ) RETURNING id INTO v_review_id;

    RETURN v_review_id;
END;
$$;

-- 2. RETURN REVIEW
CREATE OR REPLACE FUNCTION kpi_return_assignment_review(p_review_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_review RECORD;
BEGIN
    IF trim(COALESCE(p_note, '')) = '' THEN
        RAISE EXCEPTION 'A non-blank note is required to return a review';
    END IF;

    SELECT r.*, a.id as assignment_id INTO v_review 
    FROM kpi_assignment_reviews r
    JOIN kpi_assignments a ON r.assignment_id = a.id
    WHERE r.id = p_review_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    IF NOT kpi_can_manage_assignment(v_review.assignment_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF v_review.status != 'in_review' THEN
        RAISE EXCEPTION 'Review must be in_review to be returned';
    END IF;

    UPDATE kpi_assignment_reviews 
    SET status = 'returned',
        reviewer_id = auth.uid(),
        review_note = trim(p_note),
        returned_at = now(),
        updated_at = now()
    WHERE id = p_review_id;
END;
$$;

-- 3. RESUBMIT REVIEW
CREATE OR REPLACE FUNCTION kpi_resubmit_assignment_review(p_review_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_review RECORD;
BEGIN
    SELECT r.*, a.id as assignment_id INTO v_review 
    FROM kpi_assignment_reviews r
    JOIN kpi_assignments a ON r.assignment_id = a.id
    WHERE r.id = p_review_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    IF NOT kpi_can_manage_assignment(v_review.assignment_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF v_review.status != 'returned' THEN
        RAISE EXCEPTION 'Review must be returned before it can be resubmitted';
    END IF;

    UPDATE kpi_assignment_reviews 
    SET status = 'in_review',
        review_note = COALESCE(trim(p_note), review_note),
        updated_at = now()
    WHERE id = p_review_id;
END;
$$;

-- 4. APPROVE REVIEW & CREATE SNAPSHOTS
CREATE OR REPLACE FUNCTION kpi_approve_assignment_review(p_review_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_review RECORD;
    v_score_result json;
    v_item json;
    v_total_weight numeric;
    v_scored_weight numeric;
    v_assignment_score_status text;
BEGIN
    -- 1. Fetch & Validate Review
    SELECT r.*, a.id as assignment_id INTO v_review 
    FROM kpi_assignment_reviews r
    JOIN kpi_assignments a ON r.assignment_id = a.id
    WHERE r.id = p_review_id
    FOR UPDATE OF r; -- Lock the review row to prevent concurrent approvals

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    IF NOT kpi_can_manage_assignment(v_review.assignment_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF v_review.status = 'approved' THEN
        -- Idempotent return or simple notice. The prompt says "Second/concurrent approval should safely return/reject as already approved"
        RAISE EXCEPTION 'Review is already approved';
    END IF;

    IF v_review.status != 'in_review' THEN
        RAISE EXCEPTION 'Review must be in_review to be approved';
    END IF;

    -- 2. Resolve final live score directly on backend
    -- Must cast to json to process in PL/pgSQL
    SELECT row_to_json(kpi_resolve_assignment_score(v_review.assignment_id)) INTO v_score_result;

    v_assignment_score_status := v_score_result->>'status';
    v_total_weight := (v_score_result->>'total_weight')::numeric;
    v_scored_weight := (v_score_result->>'scored_weight')::numeric;

    -- 3. Validation: Assignment must be fully scorable
    IF v_assignment_score_status != 'complete' OR v_total_weight != 100 OR v_scored_weight != 100 THEN
        RAISE EXCEPTION 'Cannot approve: Assignment score is incomplete (scored_weight=%, total_weight=%)', v_scored_weight, v_total_weight;
    END IF;

    -- 4. Create Official Snapshots for each item
    FOR v_item IN SELECT * FROM json_array_elements(v_score_result->'items')
    LOOP
        IF (v_item->>'status') != 'scored' THEN
            RAISE EXCEPTION 'Cannot approve: item % has invalid status %', v_item->>'assignment_item_id', v_item->>'status';
        END IF;

        INSERT INTO kpi_assignment_item_reviews (
            assignment_item_id,
            review_id,
            actual_snapshot,
            score_snapshot,
            final_raw_score,
            final_weighted_score,
            final_achievement_percent
        ) VALUES (
            (v_item->>'assignment_item_id')::uuid,
            p_review_id,
            (SELECT row_to_json(kpi_resolve_assignment_item_actual((v_item->>'assignment_item_id')::uuid))), -- Re-fetch actual payload to freeze it
            v_item,
            (v_item->>'raw_score')::numeric,
            (v_item->>'weighted_score')::numeric,
            (v_item->>'achievement_percent')::numeric
        )
        ON CONFLICT (assignment_item_id, review_id) 
        DO UPDATE SET 
            actual_snapshot = EXCLUDED.actual_snapshot,
            score_snapshot = EXCLUDED.score_snapshot,
            final_raw_score = EXCLUDED.final_raw_score,
            final_weighted_score = EXCLUDED.final_weighted_score,
            final_achievement_percent = EXCLUDED.final_achievement_percent,
            updated_at = now();
    END LOOP;

    -- 5. Finalize Review Status
    UPDATE kpi_assignment_reviews 
    SET status = 'approved',
        reviewer_id = auth.uid(),
        review_note = COALESCE(trim(p_note), review_note),
        approved_at = now(),
        updated_at = now()
    WHERE id = p_review_id;

END;
$$;
