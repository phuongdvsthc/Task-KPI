-- v0.4.4-A: KPI Scoring Foundation

CREATE OR REPLACE FUNCTION kpi_score_assignment_item(p_assignment_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item kpi_assignment_items%ROWTYPE;
    v_assignment kpi_assignments%ROWTYPE;
    v_actual_res jsonb;
    v_actual_status text;
    v_target_config jsonb;
    v_scoring_config jsonb;
    v_def_snapshot jsonb;
    v_cap_percent numeric;
    v_weight numeric;
    
    v_target_numeric numeric;
    v_target_boolean boolean;
    
    v_actual_numeric numeric;
    v_actual_boolean boolean;
    v_actual_text text;
    
    v_direction text;
    v_measurement_type text;
    v_method text;
    
    v_raw_achievement_percent numeric;
    v_achievement_percent numeric;
    v_raw_score numeric;
    v_weighted_score numeric;
    
    v_result_status text;
    v_reason text;
    
    v_trace jsonb;
    v_band jsonb;
    v_band_min numeric;
    v_band_score numeric;
    v_matched_band jsonb;
    
    v_pass_score numeric;
    v_fail_score numeric;
BEGIN
    -- Security Check
    IF NOT kpi_can_view_assignment_item(p_assignment_item_id) THEN
        RETURN jsonb_build_object('assignment_item_id', p_assignment_item_id, 'status', 'not_scored', 'reason', 'access_denied');
    END IF;

    SELECT * INTO v_item FROM kpi_assignment_items WHERE id = p_assignment_item_id;
    SELECT * INTO v_assignment FROM kpi_assignments WHERE id = v_item.assignment_id;

    v_def_snapshot := v_item.definition_snapshot;
    v_direction := COALESCE(v_def_snapshot->>'direction', 'higher_is_better');
    v_measurement_type := COALESCE(v_def_snapshot->>'measurement_type', 'number');
    
    v_target_config := v_item.target_config;
    v_scoring_config := COALESCE(v_item.scoring_config, '{}'::jsonb);
    v_cap_percent := COALESCE(v_item.cap_percent, 120.0);
    v_weight := COALESCE(v_item.weight, 0.0);

    -- 1. Call Actual Resolver
    v_actual_res := kpi_resolve_assignment_item_actual(p_assignment_item_id);
    v_actual_status := v_actual_res->>'status';
    v_actual_numeric := (v_actual_res->>'value_numeric')::numeric;
    
    -- Handle booleans safely since it might be null
    IF v_actual_res->>'value_boolean' IS NOT NULL THEN
        v_actual_boolean := (v_actual_res->>'value_boolean')::boolean;
    END IF;
    
    v_actual_text := v_actual_res->>'value_text';

    IF v_actual_status != 'resolved' THEN
        RETURN jsonb_build_object(
            'assignment_item_id', p_assignment_item_id,
            'status', 'not_scored',
            'reason', 'actual_not_available',
            'actual_status', v_actual_status,
            'trace', v_actual_res->'trace'
        );
    END IF;

    -- Default Scoring Method
    v_method := COALESCE(v_scoring_config->>'method', 'linear');
    
    v_result_status := 'scored';
    v_reason := NULL;
    v_trace := jsonb_build_object(
        'actual_resolver_trace', v_actual_res->'trace',
        'scoring_method', v_method,
        'direction', v_direction,
        'cap_percent', v_cap_percent
    );

    IF v_measurement_type = 'boolean' THEN
        -- Boolean Scoring
        IF v_target_config->>'value' IS NOT NULL THEN
            v_target_boolean := (v_target_config->>'value')::boolean;
        END IF;

        v_pass_score := COALESCE((v_scoring_config->>'pass_score')::numeric, 100);
        v_fail_score := COALESCE((v_scoring_config->>'fail_score')::numeric, 0);

        IF v_target_boolean IS NULL THEN
            v_result_status := 'not_scored';
            v_reason := 'invalid_target';
        ELSIF v_actual_boolean IS NULL THEN
            v_result_status := 'not_scored';
            v_reason := 'invalid_actual';
        ELSE
            IF v_actual_boolean = v_target_boolean THEN
                v_raw_achievement_percent := 100;
                v_achievement_percent := LEAST(100.0, v_cap_percent);
                v_raw_score := v_pass_score;
            ELSE
                v_raw_achievement_percent := 0;
                v_achievement_percent := 0;
                v_raw_score := v_fail_score;
            END IF;
            
            v_trace := v_trace || jsonb_build_object(
                'target_boolean', v_target_boolean,
                'actual_boolean', v_actual_boolean,
                'pass_score', v_pass_score,
                'fail_score', v_fail_score
            );
        END IF;

    ELSE
        -- Numeric/Linear/Bands
        v_target_numeric := (v_target_config->>'value')::numeric;

        IF v_target_numeric IS NULL THEN
            v_result_status := 'not_scored';
            v_reason := 'invalid_target';
        ELSIF v_actual_numeric IS NULL THEN
            v_result_status := 'not_scored';
            v_reason := 'invalid_actual';
        ELSE
            v_trace := v_trace || jsonb_build_object(
                'target_numeric', v_target_numeric,
                'actual_numeric', v_actual_numeric
            );

            -- Calculate Raw Achievement
            IF v_direction = 'higher_is_better' THEN
                IF v_target_numeric = 0 THEN
                    IF v_actual_numeric >= 0 THEN v_raw_achievement_percent := v_cap_percent; ELSE v_raw_achievement_percent := 0; END IF;
                ELSE
                    v_raw_achievement_percent := (v_actual_numeric / v_target_numeric) * 100;
                END IF;
            ELSIF v_direction = 'lower_is_better' THEN
                IF v_actual_numeric = 0 THEN
                    v_raw_achievement_percent := v_cap_percent;
                ELSE
                    v_raw_achievement_percent := (v_target_numeric / v_actual_numeric) * 100;
                END IF;
            ELSIF v_direction = 'exact_target' THEN
                IF v_actual_numeric = v_target_numeric THEN
                    v_raw_achievement_percent := 100;
                ELSE
                    v_raw_achievement_percent := 0;
                END IF;
            ELSE
                -- Default/fallback
                IF v_target_numeric = 0 THEN
                    v_raw_achievement_percent := v_cap_percent;
                ELSE
                    v_raw_achievement_percent := (v_actual_numeric / v_target_numeric) * 100;
                END IF;
            END IF;

            v_raw_achievement_percent := ROUND(v_raw_achievement_percent, 4);
            
            -- Apply cap
            v_achievement_percent := LEAST(v_raw_achievement_percent, v_cap_percent);

            -- Apply Scoring Method
            IF v_method = 'linear' THEN
                v_raw_score := v_achievement_percent;
            ELSIF v_method = 'bands' THEN
                IF v_scoring_config->'bands' IS NOT NULL AND jsonb_typeof(v_scoring_config->'bands') = 'array' THEN
                    v_matched_band := NULL;
                    FOR v_band IN SELECT * FROM jsonb_array_elements(v_scoring_config->'bands') LOOP
                        v_band_min := (v_band->>'min_percent')::numeric;
                        v_band_score := (v_band->>'score')::numeric;
                        
                        IF v_achievement_percent >= v_band_min THEN
                            IF v_matched_band IS NULL OR v_band_min > (v_matched_band->>'min_percent')::numeric THEN
                                v_matched_band := v_band;
                            END IF;
                        END IF;
                    END LOOP;
                    
                    IF v_matched_band IS NOT NULL THEN
                        v_raw_score := (v_matched_band->>'score')::numeric;
                        v_trace := v_trace || jsonb_build_object('matched_band', v_matched_band);
                    ELSE
                        v_raw_score := 0;
                        v_trace := v_trace || jsonb_build_object('matched_band', 'none');
                    END IF;
                ELSE
                    v_result_status := 'not_scored';
                    v_reason := 'invalid_config';
                    v_trace := v_trace || jsonb_build_object('error', 'Bands config missing or invalid');
                END IF;
            ELSE
                v_result_status := 'not_scored';
                v_reason := 'unsupported_method';
            END IF;
        END IF;
    END IF;

    IF v_result_status = 'scored' THEN
        v_weighted_score := ROUND((v_raw_score * v_weight) / 100.0, 4);
    END IF;

    RETURN jsonb_build_object(
        'assignment_item_id', p_assignment_item_id,
        'status', v_result_status,
        'reason', v_reason,
        'target_config', v_target_config,
        'actual_value', COALESCE(v_actual_numeric::text, v_actual_boolean::text, v_actual_text),
        'raw_achievement_percent', v_raw_achievement_percent,
        'achievement_percent', v_achievement_percent,
        'raw_score', v_raw_score,
        'weight_percent', v_weight,
        'weighted_score', v_weighted_score,
        'trace', v_trace
    );
END;
$$;


CREATE OR REPLACE FUNCTION kpi_score_assignment(p_assignment_id uuid)
RETURNS jsonb
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
        v_result := v_result || kpi_score_assignment_item(v_item.id);
    END LOOP;

    RETURN v_result;
END;
$$;
