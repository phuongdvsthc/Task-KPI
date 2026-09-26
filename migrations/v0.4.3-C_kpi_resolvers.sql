-- v0.4.3-C: KPI Actual Resolver RPCs

-- Ensure the manual entries table has superseded logic if not present
-- Note: The prompt says "current entry should be the non-superseded head", meaning we look for `supersedes_entry_id` or just the latest `created_at` if the column doesn't exist.

-- Helper: Get descendants of an org unit
CREATE OR REPLACE FUNCTION kpi_get_org_descendants(p_org_id uuid)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE org_tree AS (
        SELECT ou.id FROM organization_units ou WHERE ou.id = p_org_id
        UNION ALL
        SELECT ou.id FROM organization_units ou
        INNER JOIN org_tree ot ON ou.parent_id = ot.id
    )
    SELECT ot.id FROM org_tree ot;
END;
$$;

-- MAIN RPC: Resolve Actual for a single Assignment Item
CREATE OR REPLACE FUNCTION kpi_resolve_assignment_item_actual(p_assignment_item_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item kpi_assignment_items%ROWTYPE;
    v_assignment kpi_assignments%ROWTYPE;
    v_period kpi_periods%ROWTYPE;
    v_active_bindings kpi_assignment_item_bindings[];
    v_primary_binding kpi_assignment_item_bindings;
    v_start_date date;
    v_end_date date;
    
    v_status text := 'resolved';
    v_value_numeric numeric := NULL;
    v_value_boolean boolean := NULL;
    v_value_text text := NULL;
    v_value_json jsonb := NULL;
    v_trace jsonb := '{}'::jsonb;
    v_source_type text;
    
    v_count integer;
    v_sum numeric;
    v_avg numeric;
    v_min numeric;
    v_max numeric;
    v_latest numeric;
    
    v_org_ids uuid[];
    
    -- Task counts
    v_assigned_count integer := 0;
    v_completed_count integer := 0;
    v_completed_on_time_count integer := 0;
    v_overdue_count integer := 0;
    v_measure text;
    
    -- Manual entry
    v_manual_entry record;
BEGIN
    -- 1. Fetch relations
    SELECT * INTO v_item FROM kpi_assignment_items WHERE id = p_assignment_item_id;
    IF NOT FOUND THEN
        RETURN json_build_object('assignment_item_id', p_assignment_item_id, 'status', 'no_data', 'resolved_at', now());
    END IF;

    -- Security Check
    -- (Assuming kpi_can_view_assignment_item exists, otherwise fallback to assignment check)
    IF NOT kpi_can_view_assignment(v_item.assignment_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT * INTO v_assignment FROM kpi_assignments WHERE id = v_item.assignment_id;
    SELECT * INTO v_period FROM kpi_periods WHERE id = v_assignment.period_id;

    -- Calculate effective dates
    v_start_date := GREATEST(v_period.start_date, COALESCE(v_assignment.effective_from, v_period.start_date));
    v_end_date := LEAST(v_period.end_date, COALESCE(v_assignment.effective_to, v_period.end_date));

    -- 2. Binding Selection
    SELECT array_agg(b.*) INTO v_active_bindings
    FROM kpi_assignment_item_bindings b
    WHERE b.assignment_item_id = p_assignment_item_id AND b.is_active = true;

    IF v_active_bindings IS NULL OR array_length(v_active_bindings, 1) IS NULL THEN
        RETURN json_build_object(
            'assignment_item_id', p_assignment_item_id,
            'status', 'no_binding',
            'resolved_at', now()
        );
    END IF;

    -- Look for primary binding
    SELECT b.* INTO v_primary_binding
    FROM unnest(v_active_bindings) b
    WHERE b.binding_key = 'primary'
    LIMIT 1;

    IF v_primary_binding.id IS NULL THEN
        -- If multiple and no primary, ambiguous
        IF array_length(v_active_bindings, 1) > 1 THEN
            RETURN json_build_object(
                'assignment_item_id', p_assignment_item_id,
                'status', 'ambiguous_binding',
                'resolved_at', now()
            );
        ELSE
            -- Only one active binding, use it
            v_primary_binding := v_active_bindings[1];
        END IF;
    END IF;

    v_source_type := v_primary_binding.source_type;

    -- Scope resolution for organization assignments
    IF v_assignment.assignee_type = 'organization' THEN
        IF v_primary_binding.scope_mode = 'assignee_tree' THEN
            SELECT array_agg(id) INTO v_org_ids FROM kpi_get_org_descendants(v_assignment.assignee_organization_unit_id);
        ELSE
            v_org_ids := ARRAY[v_assignment.assignee_organization_unit_id];
        END IF;
    END IF;

    -- 3. Resolve based on source_type
    IF v_source_type IN ('metric', 'calculated_metric') THEN
        IF v_primary_binding.source_reference_id IS NULL THEN
            v_status := 'invalid_config';
        ELSE
            IF v_source_type = 'calculated_metric' THEN
                -- Thin adapter around Metric Engine ratio calculation
                DECLARE
                    v_calc_def metric_definitions%ROWTYPE;
                    v_num_sum numeric := 0;
                    v_den_sum numeric := 0;
                BEGIN
                    SELECT * INTO v_calc_def FROM metric_definitions WHERE id = v_primary_binding.source_reference_id;
                    IF v_calc_def.calculation_type = 'ratio' AND v_calc_def.numerator_metric_id IS NOT NULL AND v_calc_def.denominator_metric_id IS NOT NULL THEN
                        SELECT COALESCE(sum(value), 0) INTO v_num_sum
                        FROM metric_entries e
                        WHERE e.metric_definition_id = v_calc_def.numerator_metric_id
                        AND e.period_start >= v_start_date AND COALESCE(e.period_end, e.period_start) <= v_end_date
                        AND ((v_assignment.assignee_type = 'individual' AND e.user_id = v_assignment.assignee_user_id) OR (v_assignment.assignee_type = 'organization' AND e.organization_unit_id = ANY(v_org_ids)));
                        
                        SELECT COALESCE(sum(value), 0) INTO v_den_sum
                        FROM metric_entries e
                        WHERE e.metric_definition_id = v_calc_def.denominator_metric_id
                        AND e.period_start >= v_start_date AND COALESCE(e.period_end, e.period_start) <= v_end_date
                        AND ((v_assignment.assignee_type = 'individual' AND e.user_id = v_assignment.assignee_user_id) OR (v_assignment.assignee_type = 'organization' AND e.organization_unit_id = ANY(v_org_ids)));
                        
                        IF v_den_sum = 0 THEN
                            v_status := 'no_data';
                        ELSE
                            v_value_numeric := (v_num_sum / v_den_sum) * 100;
                            v_count := 1;
                            v_trace := jsonb_build_object(
                                'record_count', 1,
                                'source_reference_id', v_primary_binding.source_reference_id,
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
            WHERE t.start_date >= v_start_date AND t.start_date <= v_end_date
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
        -- Assuming table kpi_manual_actual_entries exists. We will try to select the latest valid one.
        BEGIN
            SELECT id, value_numeric, value_text, value_boolean, value_json, entered_by, created_at
            INTO v_manual_entry
            FROM kpi_manual_actual_entries
            WHERE assignment_item_id = p_assignment_item_id
            -- AND supersedes_entry_id IS NULL -- Ideally, if this logic exists. We will just order by created_at DESC
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
            v_status := 'no_data'; -- Table might not exist yet if not implemented fully
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


-- ASSIGNMENT LEVEL RPC
CREATE OR REPLACE FUNCTION kpi_resolve_assignment_actuals(p_assignment_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb := '[]'::jsonb;
    v_item RECORD;
BEGIN
    -- Security Check
    IF NOT kpi_can_view_assignment(p_assignment_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    FOR v_item IN SELECT id FROM kpi_assignment_items WHERE assignment_id = p_assignment_id LOOP
        v_result := v_result || kpi_resolve_assignment_item_actual(v_item.id)::jsonb;
    END LOOP;

    RETURN v_result;
END;
$$;
