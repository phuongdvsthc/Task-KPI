SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'kpi_assignment_reviews';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'kpi_assignment_item_reviews';

SELECT proname, prosrc 
FROM pg_proc 
WHERE proname LIKE 'kpi_resolve_assignment_score';
