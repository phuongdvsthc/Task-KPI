const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const sql = `
CREATE OR REPLACE FUNCTION kpi_resolve_assignment_score_admin(p_assignment_id uuid)
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
    SELECT * INTO v_assignment FROM kpi_assignments WHERE id = p_assignment_id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    FOR v_item IN 
        SELECT ai.id as item_id, ai.kpi_definition_id, ai.target_value, ai.weight,
               d.code, d.name, d.measurement_unit, d.scoring_type, d.direction
        FROM kpi_assignment_items ai
        JOIN kpi_definitions d ON ai.kpi_definition_id = d.id
        WHERE ai.assignment_id = p_assignment_id
    LOOP
        v_item_score := kpi_calculate_item_score(v_item.item_id);
        
        v_items_jsonb := v_items_jsonb || jsonb_build_object(
            'item_id', v_item.item_id,
            'kpi_definition_id', v_item.kpi_definition_id,
            'code', v_item.code,
            'name', v_item.name,
            'weight', v_item.weight,
            'target_value', v_item.target_value,
            'actual_value', v_item_score->>'actual_value',
            'score', v_item_score->>'score',
            'status', v_item_score->>'status',
            'last_updated', v_item_score->>'last_updated',
            'history', v_item_score->'history'
        );

        v_total_weight := v_total_weight + v_item.weight;
        IF (v_item_score->>'status') = 'scored' THEN
            v_scored_weight := v_scored_weight + v_item.weight;
            v_total_score := v_total_score + (COALESCE((v_item_score->>'score')::numeric, 0) * v_item.weight / 100);
        ELSIF (v_item_score->>'status') = 'partial' THEN
            v_status := 'partial';
            v_scored_weight := v_scored_weight + v_item.weight;
            v_total_score := v_total_score + (COALESCE((v_item_score->>'score')::numeric, 0) * v_item.weight / 100);
        ELSE
            v_unscored_weight := v_unscored_weight + v_item.weight;
            IF v_status != 'partial' THEN
                v_status := 'no_data';
            END IF;
        END IF;
    END LOOP;

    IF v_total_weight > 0 AND v_scored_weight > 0 THEN
        v_total_score := v_total_score * (100 / v_scored_weight);
    END IF;

    IF v_scored_weight = 0 THEN
        v_status := 'no_data';
        v_total_score := 0;
    ELSIF v_unscored_weight > 0 THEN
        v_status := 'partial';
    END IF;

    RETURN jsonb_build_object(
        'assignment_id', p_assignment_id,
        'status', v_status,
        'total_score', ROUND(v_total_score, 2),
        'items', v_items_jsonb,
        'metrics', jsonb_build_object(
            'total_weight', v_total_weight,
            'scored_weight', v_scored_weight,
            'unscored_weight', v_unscored_weight
        ),
        'calculated_at', CURRENT_TIMESTAMP
    );
END;
$$;
`;

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Creating kpi_resolve_assignment_score_admin...");
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apiKey': process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    // We cannot run raw SQL via the REST API easily unless we use the Postgres interface.
  });
  // Wait, I can just write it to a migration file and run it?
}
run();
