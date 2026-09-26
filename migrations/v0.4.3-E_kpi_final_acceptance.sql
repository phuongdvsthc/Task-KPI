-- Final Acceptance fixes

-- 1. Fix Task Resolver Date Filtering
CREATE OR REPLACE FUNCTION kpi_resolve_assignment_item_actual(p_assignment_item_id uuid)
RETURNS json
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
    
    v_status text := 'resolved';
    v_value_numeric numeric;
    v_value_boolean boolean;
    v_value_text text;
    v_value_json jsonb;
    v_trace jsonb;
    
    v_count int;
    v_sum numeric;
    v_avg numeric;
    v_min numeric;
    v_max numeric;
    v_latest numeric;
    
    v_measure text;
    v_assigned_count int;
    v_completed_count int;
    v_completed_on_time_count int;
    v_overdue_count int;
    
    v_manual_entry RECORD;
    v_num_sum numeric;
    v_den_sum numeric;
BEGIN
    -- Security Check
    IF NOT kpi_can_view_assignment_item(p_assignment_item_id) THEN
        RETURN json_build_object('assignment_item_id', p_assignment_item_id, 'status', 'access_denied');
    END IF;

    -- Load core records
    SELECT * INTO v_item FROM kpi_assignment_items WHERE id = p_assignment_item_id;
    SELECT * INTO v_assignment FROM kpi_assignments WHERE id = v_item.assignment_id;
    SELECT * INTO v_period FROM kpi_periods WHERE id = v_assignment.period_id;

    -- Determine effective period
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
        RETURN json_build_object(
            'assignment_item_id', p_assignment_item_id,
            'status', 'no_binding',
            'resolved_at', now()
        );
    END IF;

    v_source_type := v_primary_binding.source_type;

    -- Pre-calculate org descendants if assignee is organization and scope_mode is tree
    IF v_assignment.assignee_type = 'organization' THEN
        IF v_primary_binding.scope_mode = 'assignee_tree' THEN
            SELECT array_agg(id) INTO v_org_ids FROM kpi_get_org_descendants(v_assignment.assignee_organization_unit_id);
        ELSE
            v_org_ids := ARRAY[v_assignment.assignee_organization_unit_id];
        END IF;
    END IF;

    IF v_source_type = 'metric' THEN
        IF v_primary_binding.source_reference_id IS NULL THEN
            v_status := 'invalid_config';
        ELSE
            IF v_primary_binding.aggregation_method = 'rate' THEN
                -- Rate Resolver
                DECLARE
                    v_num_def uuid;
                    v_den_def uuid;
                BEGIN
                    v_num_def := (v_primary_binding.source_config->>'numerator_metric_id')::uuid;
                    v_den_def := (v_primary_binding.source_config->>'denominator_metric_id')::uuid;
                    
                    IF v_num_def IS NOT NULL AND v_den_def IS NOT NULL THEN
                        SELECT sum(value) INTO v_num_sum FROM metric_entries e WHERE e.metric_definition_id = v_num_def AND e.period_start >= v_start_date AND COALESCE(e.period_end, e.period_start) <= v_end_date AND ((v_assignment.assignee_type = 'individual' AND e.user_id = v_assignment.assignee_user_id) OR (v_assignment.assignee_type = 'organization' AND e.organization_unit_id = ANY(v_org_ids)));
                        SELECT sum(value) INTO v_den_sum FROM metric_entries e WHERE e.metric_definition_id = v_den_def AND e.period_start >= v_start_date AND COALESCE(e.period_end, e.period_start) <= v_end_date AND ((v_assignment.assignee_type = 'individual' AND e.user_id = v_assignment.assignee_user_id) OR (v_assignment.assignee_type = 'organization' AND e.organization_unit_id = ANY(v_org_ids)));
                        
                        IF COALESCE(v_den_sum, 0) = 0 THEN
                            v_status := 'no_data';
                        ELSE
                            v_value_numeric := (COALESCE(v_num_sum, 0) / v_den_sum) * 100;
                            v_trace := jsonb_build_object(
                                'numerator_sum', v_num_sum,
                                'denominator_sum', v_den_sum,
                                'date_from', v_start_date,
                                'date_to', v_end_date
                            );
                        END IF;
                    ELSE
                        v_status := 'invalid_config';
                    END IF;
                END;
            ELSE
                -- Metric Resolver
                SELECT 
                    count(*),
                    sum(value),
                    avg(value),
                    min(value),
                    max(value),
                    (SELECT value FROM metric_entries e2 
                     WHERE e2.metric_definition_id = v_primary_binding.source_reference_id 
                     AND e2.period_start >= v_start_date AND COALESCE(e2.period_end, e2.period_start) <= v_end_date
                     AND (v_assignment.assignee_type = 'individual' AND e2.user_id = v_assignment.assignee_user_id 
                          OR v_assignment.assignee_type = 'organization' AND e2.organization_unit_id = ANY(v_org_ids))
                     ORDER BY e2.period_start DESC LIMIT 1)
                INTO v_count, v_sum, v_avg, v_min, v_max, v_latest
                FROM metric_entries e
                WHERE e.metric_definition_id = v_primary_binding.source_reference_id
                AND e.period_start >= v_start_date 
                AND COALESCE(e.period_end, e.period_start) <= v_end_date
                AND (
                    (v_assignment.assignee_type = 'individual' AND e.user_id = v_assignment.assignee_user_id)
                    OR 
                    (v_assignment.assignee_type = 'organization' AND e.organization_unit_id = ANY(v_org_ids))
                );

                IF v_count = 0 THEN
                    v_status := 'no_data';
                ELSE
                    CASE v_primary_binding.aggregation_method
                        WHEN 'sum' THEN v_value_numeric := v_sum;
                        WHEN 'avg' THEN v_value_numeric := v_avg;
                        WHEN 'min' THEN v_value_numeric := v_min;
                        WHEN 'max' THEN v_value_numeric := v_max;
                        WHEN 'latest' THEN v_value_numeric := v_latest;
                        WHEN 'count' THEN v_value_numeric := v_count;
                        ELSE v_value_numeric := v_sum; -- default
                    END CASE;
                    
                    v_trace := jsonb_build_object(
                        'record_count', v_count,
                        'source_reference_id', v_primary_binding.source_reference_id,
                        'aggregation_method', v_primary_binding.aggregation_method,
                        'scope_mode', v_primary_binding.scope_mode,
                        'date_from', v_start_date,
                        'date_to', v_end_date
                    );
                END IF;
            END IF;
        END IF;
    ELSIF v_source_type = 'task' THEN
        v_measure := v_primary_binding.source_config->>'measure';
        IF v_measure IS NULL THEN
            v_status := 'invalid_config';
        ELSE
            -- Task Resolver
            SELECT 
                count(*),
                count(*) FILTER (WHERE status = 'completed'),
                count(*) FILTER (WHERE status = 'completed' AND COALESCE(completed_at::date, updated_at::date) <= due_date),
                count(*) FILTER (WHERE status != 'completed' AND current_date > due_date OR status = 'completed' AND COALESCE(completed_at::date, updated_at::date) > due_date)
            INTO v_assigned_count, v_completed_count, v_completed_on_time_count, v_overdue_count
            FROM tasks t
            WHERE t.due_date >= v_start_date AND t.due_date <= v_end_date
            AND (
                (v_assignment.assignee_type = 'individual' AND (
                    t.owner_id = v_assignment.assignee_user_id 
                    OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = v_assignment.assignee_user_id)
                ))
                OR 
                (v_assignment.assignee_type = 'organization' AND t.organization_unit_id = ANY(v_org_ids))
            );

            CASE v_measure
                WHEN 'assigned_count' THEN v_value_numeric := v_assigned_count;
                WHEN 'completed_count' THEN v_value_numeric := v_completed_count;
                WHEN 'completion_rate' THEN 
                    IF v_assigned_count > 0 THEN v_value_numeric := (v_completed_count::numeric / v_assigned_count) * 100; ELSE v_status := 'no_data'; END IF;
                WHEN 'completed_on_time_count' THEN v_value_numeric := v_completed_on_time_count;
                WHEN 'on_time_completion_rate' THEN 
                    IF v_assigned_count > 0 THEN v_value_numeric := (v_completed_on_time_count::numeric / v_assigned_count) * 100; ELSE v_status := 'no_data'; END IF;
                WHEN 'overdue_count' THEN v_value_numeric := v_overdue_count;
                WHEN 'overdue_rate' THEN 
                    IF v_assigned_count > 0 THEN v_value_numeric := (v_overdue_count::numeric / v_assigned_count) * 100; ELSE v_status := 'no_data'; END IF;
                ELSE v_status := 'invalid_config';
            END CASE;

            IF v_status = 'resolved' AND v_assigned_count = 0 THEN
                v_status := 'no_data';
            END IF;

            v_trace := jsonb_build_object(
                'measure', v_measure,
                'assigned_count', v_assigned_count,
                'completed_count', v_completed_count,
                'completed_on_time_count', v_completed_on_time_count,
                'overdue_count', v_overdue_count,
                'date_from', v_start_date,
                'date_to', v_end_date
            );
        END IF;
    ELSIF v_source_type = 'manual' THEN
        -- Check if there are any manual actual entries.
        BEGIN
            SELECT id, value_numeric, value_text, value_boolean, value_json, entered_by, created_at
            INTO v_manual_entry
            FROM kpi_manual_actual_entries
            WHERE assignment_item_id = p_assignment_item_id
            ORDER BY created_at DESC
            LIMIT 1;
            
            IF NOT FOUND THEN
                v_status := 'no_data';
            ELSE
                v_value_numeric := v_manual_entry.value_numeric;
                v_value_text := v_manual_entry.value_text;
                v_value_boolean := v_manual_entry.value_boolean;
                v_value_json := v_manual_entry.value_json;
                v_trace := jsonb_build_object(
                    'entry_id', v_manual_entry.id,
                    'entered_by', v_manual_entry.entered_by,
                    'entered_at', v_manual_entry.created_at
                );
            END IF;
        EXCEPTION WHEN undefined_table THEN
            v_status := 'no_data';
        END;
    ELSIF v_source_type IN ('formula', 'external') THEN
        v_status := 'unsupported_source';
    ELSE
        v_status := 'unsupported_source';
    END IF;

    RETURN json_build_object(
        'assignment_item_id', p_assignment_item_id,
        'status', v_status,
        'value_numeric', v_value_numeric,
        'value_boolean', v_value_boolean,
        'value_text', v_value_text,
        'value_json', v_value_json,
        'source_type', v_source_type,
        'resolved_at', now(),
        'trace', v_trace
    );
END;
$$;


-- 2. Fix Task Drill-down Query
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
        WHERE t.due_date >= v_start_date AND t.due_date <= v_end_date
        AND ((v_assignment.assignee_type = 'individual' AND (t.owner_id = v_assignment.assignee_user_id OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = v_assignment.assignee_user_id))) OR (v_assignment.assignee_type = 'organization' AND t.organization_unit_id = ANY(v_org_ids)));

        SELECT jsonb_agg(row_to_json(dt)) INTO v_history
        FROM (
            SELECT 
                t.id, t.title, t.status, t.due_date, t.completed_at, t.start_date
            FROM tasks t
            WHERE t.due_date >= v_start_date AND t.due_date <= v_end_date
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
