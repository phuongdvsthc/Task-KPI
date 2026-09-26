CREATE OR REPLACE FUNCTION kpi_resolve_assignment_score(p_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignment kpi_assignments%ROWTYPE;
    v_items_jsonb jsonb := '[]'::jsonb;
    v_item RECORD;
    v_item_score jsonb;
    v_total_weight numeric := 0;
    v_scored_weight numeric := 0;
    v_unscored_weight numeric := 0;
    v_total_score numeric := 0;
    v_status text := 'complete';
BEGIN
    -- Security Check
    IF (auth.role() IS NULL OR auth.role() = 'service_role' OR current_setting('request.jwt.claims', true) IS NULL) THEN
        -- Allow service_role to bypass RLS
    ELSE
        IF NOT kpi_can_view_assignment(p_assignment_id) THEN
            RAISE EXCEPTION 'access_denied';
        END IF;
    END IF;

    SELECT * INTO v_assignment FROM kpi_assignments WHERE id = p_assignment_id;

    -- Iterate over assignment items
    FOR v_item IN
        SELECT * FROM kpi_assignment_items WHERE assignment_id = p_assignment_id
    LOOP
        v_item_score := kpi_resolve_assignment_item_score(v_item.id);
        
        v_total_weight := v_total_weight + v_item.weight;
        IF v_item_score->>'status' = 'scored' THEN
            v_scored_weight := v_scored_weight + v_item.weight;
            v_total_score := v_total_score + (v_item_score->>'weighted_score')::numeric;
        ELSE
            v_unscored_weight := v_unscored_weight + v_item.weight;
            v_status := 'partial';
        END IF;

        v_items_jsonb := v_items_jsonb || jsonb_build_object(
            'assignment_item_id', v_item.id,
            'kpi_definition_id', v_item.kpi_definition_id,
            'weight', v_item.weight,
            'score_result', v_item_score
        );
    END LOOP;

    RETURN jsonb_build_object(
        'assignment_id', p_assignment_id,
        'status', v_status,
        'total_weight', v_total_weight,
        'scored_weight', v_scored_weight,
        'unscored_weight', v_unscored_weight,
        'total_score', v_total_score,
        'items', v_items_jsonb
    );
END;
$$;
