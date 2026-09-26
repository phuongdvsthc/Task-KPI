CREATE OR REPLACE FUNCTION kpi_resolve_assignments_score_batch(p_assignment_ids uuid[])
RETURNS jsonb AS $$
DECLARE
    v_res jsonb := '[]'::jsonb;
    v_id uuid;
    v_score jsonb;
BEGIN
    FOR v_id IN SELECT unnest(p_assignment_ids) LOOP
        v_score := kpi_resolve_assignment_score(v_id);
        v_res := v_res || jsonb_build_object('assignment_id', v_id, 'score_result', v_score);
    END LOOP;
    RETURN v_res;
END;
$$ LANGUAGE plpgsql STABLE;
