-- v0.4.3-D: KPI Manual Actual + Source Drill-down

-- 1. Submit Manual Actual
CREATE OR REPLACE FUNCTION kpi_submit_manual_actual(
  p_assignment_item_binding_id uuid,
  p_value_numeric numeric DEFAULT NULL,
  p_value_boolean boolean DEFAULT NULL,
  p_value_text text DEFAULT NULL,
  p_value_json jsonb DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_binding kpi_assignment_item_bindings%ROWTYPE;
    v_assignment_item kpi_assignment_items%ROWTYPE;
    v_assignment kpi_assignments%ROWTYPE;
    v_head_count int;
    v_head_id uuid;
    v_new_id uuid;
    v_supplied_count int := 0;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'unauthenticated';
    END IF;

    -- Find binding
    SELECT * INTO v_binding FROM kpi_assignment_item_bindings WHERE id = p_assignment_item_binding_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'binding_not_found';
    END IF;

    IF v_binding.source_type != 'manual' THEN
        RAISE EXCEPTION 'invalid_source_type';
    END IF;

    -- Verify manual actual entry allowed
    IF NOT kpi_can_enter_manual_actual(p_assignment_item_binding_id) THEN
        RAISE EXCEPTION 'access_denied';
    END IF;

    -- Check assignment status
    SELECT * INTO v_assignment_item FROM kpi_assignment_items WHERE id = v_binding.assignment_item_id;
    SELECT * INTO v_assignment FROM kpi_assignments WHERE id = v_assignment_item.assignment_id;
    IF v_assignment.status NOT IN ('assigned', 'active') THEN
        RAISE EXCEPTION 'invalid_assignment_status';
    END IF;

    -- Validate require_note
    IF (v_binding.source_config->>'require_note')::boolean = true AND (p_note IS NULL OR trim(p_note) = '') THEN
        RAISE EXCEPTION 'note_required';
    END IF;

    -- Validate exactly one typed value
    IF p_value_numeric IS NOT NULL THEN v_supplied_count := v_supplied_count + 1; END IF;
    IF p_value_boolean IS NOT NULL THEN v_supplied_count := v_supplied_count + 1; END IF;
    IF p_value_text IS NOT NULL THEN v_supplied_count := v_supplied_count + 1; END IF;
    IF p_value_json IS NOT NULL THEN v_supplied_count := v_supplied_count + 1; END IF;

    IF v_supplied_count != 1 THEN
        RAISE EXCEPTION 'exactly_one_value_required';
    END IF;

    -- Find current head
    SELECT count(*), max(id) INTO v_head_count, v_head_id
    FROM kpi_manual_actual_entries
    WHERE assignment_item_id = v_binding.assignment_item_id
    AND id NOT IN (
        SELECT supersedes_entry_id 
        FROM kpi_manual_actual_entries 
        WHERE assignment_item_id = v_binding.assignment_item_id 
        AND supersedes_entry_id IS NOT NULL
    );

    IF v_head_count > 1 THEN
        RAISE EXCEPTION 'invalid_manual_history';
    END IF;

    IF v_head_count = 0 THEN
        v_head_id := NULL;
    END IF;

    -- Insert new row
    INSERT INTO kpi_manual_actual_entries (
        assignment_item_id,
        value_numeric,
        value_boolean,
        value_text,
        value_json,
        note,
        entered_by,
        supersedes_entry_id
    ) VALUES (
        v_binding.assignment_item_id,
        p_value_numeric,
        p_value_boolean,
        p_value_text,
        p_value_json,
        p_note,
        v_user_id,
        v_head_id
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'id', v_new_id,
        'status', 'success'
    );
END;
$$;


-- 2. Source Drill-down
CREATE OR REPLACE FUNCTION kpi_get_actual_trace(p_assignment_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item kpi_assignment_items%ROWTYPE;
    v_assignment kpi_assignments%ROWTYPE;
    v_period kpi_periods%ROWTYPE;
    v_primary_binding kpi_assignment_item_bindings%ROWTYPE;
    
    v_source_type text;
    v_start_date date;
    v_end_date date;
    v_org_ids uuid[];
    
    v_result jsonb;
    v_history jsonb;
    
    v_metric_def metric_definitions%ROWTYPE;
    v_record_count int;
BEGIN
    IF NOT kpi_can_view_assignment_item(p_assignment_item_id) THEN
        RAISE EXCEPTION 'access_denied';
    END IF;

    SELECT * INTO v_item FROM kpi_assignment_items WHERE id = p_assignment_item_id;
    SELECT * INTO v_assignment FROM kpi_assignments WHERE id = v_item.assignment_id;
    SELECT * INTO v_period FROM kpi_periods WHERE id = v_assignment.period_id;

    v_start_date := GREATEST(v_period.start_date, COALESCE(v_assignment.effective_from, v_period.start_date));
    v_end_date := LEAST(v_period.end_date, COALESCE(v_assignment.effective_to, v_period.end_date));

    -- Find primary binding
    SELECT * INTO v_primary_binding
    FROM kpi_assignment_item_bindings
    WHERE assignment_item_id = p_assignment_item_id
      AND is_active = true
      AND binding_key = 'primary'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'no_binding');
    END IF;

    v_source_type := v_primary_binding.source_type;

    IF v_assignment.assignee_type = 'organization' THEN
        IF v_primary_binding.scope_mode = 'assignee_tree' THEN
            SELECT array_agg(id) INTO v_org_ids FROM kpi_get_org_descendants(v_assignment.assignee_organization_unit_id);
        ELSE
            v_org_ids := ARRAY[v_assignment.assignee_organization_unit_id];
        END IF;
    END IF;

    IF v_source_type = 'manual' THEN
        -- Return append-only history
        -- Build history from the append-only records
        -- We just return all entries for this item ordered by created_at DESC
        SELECT jsonb_agg(
            jsonb_build_object(
                'entry_id', e.id,
                'value_numeric', e.value_numeric,
                'value_boolean', e.value_boolean,
                'value_text', e.value_text,
                'value_json', e.value_json,
                'note', e.note,
                'entered_by', e.entered_by,
                'entered_by_name', u.full_name,
                'entered_at', e.created_at,
                'supersedes_entry_id', e.supersedes_entry_id
            ) ORDER BY e.created_at DESC
        ) INTO v_history
        FROM kpi_manual_actual_entries e
        LEFT JOIN users u ON e.entered_by = u.id
        WHERE e.assignment_item_id = p_assignment_item_id;

        IF v_history IS NULL THEN
            RETURN jsonb_build_object('status', 'no_data', 'source_type', 'manual');
        END IF;

        RETURN jsonb_build_object(
            'status', 'resolved',
            'source_type', 'manual',
            'history', v_history,
            'current_entry', v_history->0
        );

    ELSIF v_source_type = 'metric' THEN
        IF v_primary_binding.source_reference_id IS NULL THEN
            RETURN jsonb_build_object('status', 'invalid_config');
        END IF;

        SELECT * INTO v_metric_def FROM metric_definitions WHERE id = v_primary_binding.source_reference_id;
        
        -- Get record count
        SELECT count(*) INTO v_record_count
        FROM metric_entries e
        WHERE e.metric_definition_id = v_primary_binding.source_reference_id
        AND e.period_start >= v_start_date AND COALESCE(e.period_end, e.period_start) <= v_end_date
        AND ((v_assignment.assignee_type = 'individual' AND e.user_id = v_assignment.assignee_user_id) OR (v_assignment.assignee_type = 'organization' AND e.organization_unit_id = ANY(v_org_ids)));

        -- Get up to 100 detail rows
        SELECT jsonb_agg(row_to_json(dt)) INTO v_history
        FROM (
            SELECT 
                e.id, e.value, e.period_start, e.period_end,
                u.full_name as user_name,
                ou.name as org_name
            FROM metric_entries e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN organization_units ou ON e.organization_unit_id = ou.id
            WHERE e.metric_definition_id = v_primary_binding.source_reference_id
            AND e.period_start >= v_start_date AND COALESCE(e.period_end, e.period_start) <= v_end_date
            AND ((v_assignment.assignee_type = 'individual' AND e.user_id = v_assignment.assignee_user_id) OR (v_assignment.assignee_type = 'organization' AND e.organization_unit_id = ANY(v_org_ids)))
            ORDER BY e.period_start DESC
            LIMIT 100
        ) dt;

        RETURN jsonb_build_object(
            'status', 'resolved',
            'source_type', 'metric',
            'metric_name', v_metric_def.name,
            'metric_code', v_metric_def.code,
            'aggregation_method', v_primary_binding.aggregation_method,
            'date_from', v_start_date,
            'date_to', v_end_date,
            'total_record_count', v_record_count,
            'detail_row_count', jsonb_array_length(COALESCE(v_history, '[]'::jsonb)),
            'truncated', v_record_count > 100,
            'details', COALESCE(v_history, '[]'::jsonb)
        );

    ELSIF v_source_type = 'calculated_metric' THEN
        RETURN jsonb_build_object(
            'status', 'resolved',
            'source_type', 'calculated_metric',
            'message', 'Calculated metric breakdown uses metric engine dependencies.'
        );

    ELSIF v_source_type = 'task' THEN
        -- Task details
        SELECT count(*) INTO v_record_count
        FROM tasks t
        WHERE t.start_date >= v_start_date AND t.start_date <= v_end_date
        AND ((v_assignment.assignee_type = 'individual' AND (t.owner_id = v_assignment.assignee_user_id OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = v_assignment.assignee_user_id))) OR (v_assignment.assignee_type = 'organization' AND t.organization_unit_id = ANY(v_org_ids)));

        SELECT jsonb_agg(row_to_json(dt)) INTO v_history
        FROM (
            SELECT 
                t.id, t.title, t.status, t.due_date, t.completed_at, t.start_date
            FROM tasks t
            WHERE t.start_date >= v_start_date AND t.start_date <= v_end_date
            AND ((v_assignment.assignee_type = 'individual' AND (t.owner_id = v_assignment.assignee_user_id OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = v_assignment.assignee_user_id))) OR (v_assignment.assignee_type = 'organization' AND t.organization_unit_id = ANY(v_org_ids)))
            ORDER BY t.created_at DESC
            LIMIT 100
        ) dt;

        RETURN jsonb_build_object(
            'status', 'resolved',
            'source_type', 'task',
            'measure', v_primary_binding.source_config->>'measure',
            'date_from', v_start_date,
            'date_to', v_end_date,
            'total_record_count', v_record_count,
            'detail_row_count', jsonb_array_length(COALESCE(v_history, '[]'::jsonb)),
            'truncated', v_record_count > 100,
            'details', COALESCE(v_history, '[]'::jsonb)
        );
    ELSE
        RETURN jsonb_build_object('status', 'unsupported_source');
    END IF;
END;
$$;
