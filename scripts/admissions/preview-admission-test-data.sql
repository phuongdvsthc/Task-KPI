-- ==============================================================================
-- PREVIEW ADMISSION TEST DATA (READ-ONLY QUERY SCRIPT)
-- Module: v0.8-G0.1 – Quét và lập danh sách dữ liệu test Tuyển sinh
-- Target Database: PostgreSQL / Supabase
-- Purpose: Read-only inventory preview of test vs protected real data
-- 
-- SAFETY NOTICE:
-- - This script contains ONLY SELECT statements.
-- - NO DELETE, NO UPDATE, NO INSERT, NO DROP, NO TRUNCATE.
-- - Safe to run in production / staging / test environments without data modification.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. OVERVIEW: TOTAL COUNTS ACROSS ALL ADMISSION TABLES
-- ------------------------------------------------------------------------------
SELECT 
    'admission_groups' AS table_name, 
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE code ILIKE '%TEST%' OR code ILIKE '%INACT%') AS confirmed_test,
    0 AS possible_test,
    COUNT(*) FILTER (WHERE code NOT ILIKE '%TEST%' AND code NOT ILIKE '%INACT%') AS protected_real
FROM admission_groups
UNION ALL
SELECT 
    'admission_programs' AS table_name, 
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE code ILIKE '%TEST%' OR name ILIKE '%TEST%') AS confirmed_test,
    0 AS possible_test,
    COUNT(*) FILTER (WHERE code NOT ILIKE '%TEST%' AND name NOT ILIKE '%TEST%') AS protected_real
FROM admission_programs
UNION ALL
SELECT 
    'admission_campaigns' AS table_name, 
    COUNT(*) AS total_records,
    COUNT(*) FILTER (
        WHERE code LIKE 'CAMP_%' 
           OR code LIKE 'TEST_%' 
           OR code LIKE 'MGR_CAMP_%'
           OR name ILIKE '%Test%' 
           OR name ILIKE '%Kiểm thử%'
           OR name ILIKE '%Campaign Unit%' 
           OR name ILIKE '%Manager Created%'
           OR name ILIKE '%Manager Camp%'
    ) AS confirmed_test,
    0 AS possible_test,
    COUNT(*) FILTER (
        WHERE NOT (
            code LIKE 'CAMP_%' 
            OR code LIKE 'TEST_%' 
            OR code LIKE 'MGR_CAMP_%'
            OR name ILIKE '%Test%' 
            OR name ILIKE '%Kiểm thử%'
            OR name ILIKE '%Campaign Unit%' 
            OR name ILIKE '%Manager Created%'
            OR name ILIKE '%Manager Camp%'
        )
    ) AS protected_real
FROM admission_campaigns
UNION ALL
SELECT 
    'admission_plans' AS table_name, 
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE admission_year > 2050 OR notes ILIKE '%SELFTEST%') AS confirmed_test,
    COUNT(*) FILTER (WHERE admission_year = 2026 AND notes ILIKE '%TEST%' AND notes NOT ILIKE '%SELFTEST%') AS possible_test,
    COUNT(*) FILTER (WHERE admission_year = 2026 AND (notes IS NULL OR notes NOT ILIKE '%TEST%')) AS protected_real
FROM admission_plans
UNION ALL
SELECT 
    'admission_results' AS table_name, 
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE notes ILIKE '%TEST%' OR notes ILIKE '%SELFTEST%') AS confirmed_test,
    0 AS possible_test,
    COUNT(*) FILTER (WHERE notes IS NULL OR (notes NOT ILIKE '%TEST%' AND notes NOT ILIKE '%SELFTEST%')) AS protected_real
FROM admission_results
UNION ALL
SELECT 
    'admission_result_items' AS table_name, 
    COUNT(*) AS total_records,
    0 AS confirmed_test,
    0 AS possible_test,
    COUNT(*) AS protected_real
FROM admission_result_items
UNION ALL
SELECT 
    'admission_change_history' AS table_name, 
    COUNT(*) AS total_records,
    COUNT(*) FILTER (
        WHERE campaign_id IN (
            SELECT id FROM admission_campaigns 
            WHERE code LIKE 'CAMP_%' OR code LIKE 'TEST_%' OR code LIKE 'MGR_CAMP_%'
        )
        OR entity_id IN (
            SELECT id FROM admission_campaigns 
            WHERE code LIKE 'CAMP_%' OR code LIKE 'TEST_%' OR code LIKE 'MGR_CAMP_%'
        )
        OR old_data::text ILIKE '%test%'
        OR new_data::text ILIKE '%test%'
    ) AS confirmed_test,
    0 AS possible_test,
    COUNT(*) FILTER (
        WHERE NOT (
            campaign_id IN (
                SELECT id FROM admission_campaigns 
                WHERE code LIKE 'CAMP_%' OR code LIKE 'TEST_%' OR code LIKE 'MGR_CAMP_%'
            )
            OR entity_id IN (
                SELECT id FROM admission_campaigns 
                WHERE code LIKE 'CAMP_%' OR code LIKE 'TEST_%' OR code LIKE 'MGR_CAMP_%'
            )
            OR old_data::text ILIKE '%test%'
            OR new_data::text ILIKE '%test%'
        )
    ) AS protected_real
FROM admission_change_history;

-- ------------------------------------------------------------------------------
-- 2. TABLE 1: admission_groups (NHÓM TUYỂN SINH)
-- ------------------------------------------------------------------------------
SELECT 
    id, 
    code, 
    name, 
    is_active, 
    sort_order,
    created_at,
    CASE 
        WHEN code IN ('TRUNG_CAP', 'NGAN_HAN') THEN 'PROTECTED_REAL_DATA'
        ELSE 'CONFIRMED_TEST'
    END AS classification
FROM admission_groups
ORDER BY sort_order;

-- ------------------------------------------------------------------------------
-- 3. TABLE 2: admission_programs (NGÀNH / LỚP TUYỂN SINH)
-- ------------------------------------------------------------------------------
SELECT 
    p.id, 
    p.group_id, 
    g.code AS group_code, 
    p.code AS program_code, 
    p.name AS program_name, 
    p.is_active, 
    p.created_at,
    CASE 
        WHEN p.code LIKE '%TEST%' OR p.name LIKE '%TEST%' THEN 'CONFIRMED_TEST'
        ELSE 'PROTECTED_REAL_DATA'
    END AS classification
FROM admission_programs p
LEFT JOIN admission_groups g ON g.id = p.group_id
ORDER BY p.code;

-- ------------------------------------------------------------------------------
-- 4. TABLE 3: admission_campaigns (ĐỢT TUYỂN SINH)
-- 4.1. Danh sách 36 đợt test (CONFIRMED_TEST)
-- ------------------------------------------------------------------------------
SELECT 
    c.id, 
    c.code, 
    c.name, 
    c.year, 
    c.period_number, 
    c.status, 
    c.is_active, 
    c.created_at,
    'CONFIRMED_TEST' AS classification
FROM admission_campaigns c
WHERE c.code LIKE 'CAMP_%' 
   OR c.code LIKE 'TEST_%' 
   OR c.code LIKE 'MGR_CAMP_%'
   OR c.name ILIKE '%Test%' 
   OR c.name ILIKE '%Kiểm thử%'
   OR c.name ILIKE '%Campaign Unit%' 
   OR c.name ILIKE '%Manager Created%'
   OR c.name ILIKE '%Manager Camp%'
ORDER BY c.created_at;

-- 4.2. Danh sách 13 đợt thật năm 2026 cần bảo vệ (PROTECTED_REAL_DATA)
SELECT 
    c.id, 
    g.code AS group_code, 
    g.name AS group_name, 
    c.code AS campaign_code, 
    c.name AS campaign_name, 
    c.year, 
    c.period_number, 
    c.status, 
    c.is_active, 
    c.created_at,
    'PROTECTED_REAL_DATA' AS classification
FROM admission_campaigns c
JOIN admission_groups g ON g.id = c.group_id
WHERE NOT (
    c.code LIKE 'CAMP_%' 
    OR c.code LIKE 'TEST_%' 
    OR c.code LIKE 'MGR_CAMP_%'
    OR c.name ILIKE '%Test%' 
    OR c.name ILIKE '%Kiểm thử%'
    OR c.name ILIKE '%Campaign Unit%' 
    OR c.name ILIKE '%Manager Created%'
    OR c.name ILIKE '%Manager Camp%'
)
ORDER BY g.code DESC, c.period_number ASC;

-- ------------------------------------------------------------------------------
-- 5. TABLE 4: admission_plans (KẾ HOẠCH NĂM & PHÂN BỔ THEO ĐỢT)
-- ------------------------------------------------------------------------------
SELECT 
    pl.id, 
    pl.admission_year, 
    g.code AS group_code, 
    g.name AS group_name,
    pl.campaign_id,
    pl.target_paid_count, 
    pl.status, 
    pl.notes,
    pl.created_at,
    CASE 
        WHEN pl.admission_year > 2050 OR pl.notes ILIKE '%SELFTEST%' THEN 'CONFIRMED_TEST'
        WHEN pl.admission_year = 2026 AND pl.notes ILIKE '%TEST%' THEN 'POSSIBLE_TEST (DO NOT DELETE)'
        ELSE 'PROTECTED_REAL_DATA'
    END AS classification
FROM admission_plans pl
JOIN admission_groups g ON g.id = pl.group_id
ORDER BY pl.admission_year, g.code;

-- ------------------------------------------------------------------------------
-- 6. TABLE 5 & 6: admission_results & admission_result_items (KẾT QUẢ TUYỂN SINH)
-- ------------------------------------------------------------------------------
SELECT 
    r.id AS result_id, 
    c.code AS campaign_code, 
    c.name AS campaign_name,
    r.registered_count, 
    r.paid_count, 
    r.entry_mode, 
    r.data_status, 
    r.source_type, 
    r.notes,
    CASE 
        WHEN r.notes ILIKE '%TEST%' OR r.notes ILIKE '%SELFTEST%' THEN 'CONFIRMED_TEST'
        ELSE 'PROTECTED_REAL_DATA'
    END AS classification
FROM admission_results r
JOIN admission_campaigns c ON c.id = r.campaign_id;

SELECT 
    i.id AS item_id, 
    i.result_id, 
    p.code AS program_code, 
    p.name AS program_name,
    i.registered_count, 
    i.paid_count
FROM admission_result_items i
JOIN admission_programs p ON p.id = i.program_id;

-- ------------------------------------------------------------------------------
-- 7. TABLE 7: admission_change_history (LỊCH SỬ THAY ĐỔI / AUDIT LOG)
-- ------------------------------------------------------------------------------
SELECT 
    h.entity_type,
    h.action,
    COUNT(*) AS total_logs,
    COUNT(*) FILTER (
        WHERE h.campaign_id IN (
            SELECT id FROM admission_campaigns 
            WHERE code LIKE 'CAMP_%' OR code LIKE 'TEST_%' OR code LIKE 'MGR_CAMP_%'
        )
        OR h.entity_id IN (
            SELECT id FROM admission_campaigns 
            WHERE code LIKE 'CAMP_%' OR code LIKE 'TEST_%' OR code LIKE 'MGR_CAMP_%'
        )
        OR h.old_data::text ILIKE '%test%'
        OR h.new_data::text ILIKE '%test%'
    ) AS test_related_logs,
    COUNT(*) FILTER (
        WHERE NOT (
            h.campaign_id IN (
                SELECT id FROM admission_campaigns 
                WHERE code LIKE 'CAMP_%' OR code LIKE 'TEST_%' OR code LIKE 'MGR_CAMP_%'
            )
            OR h.entity_id IN (
                SELECT id FROM admission_campaigns 
                WHERE code LIKE 'CAMP_%' OR code LIKE 'TEST_%' OR code LIKE 'MGR_CAMP_%'
            )
            OR h.old_data::text ILIKE '%test%'
            OR h.new_data::text ILIKE '%test%'
        )
    ) AS real_data_logs
FROM admission_change_history h
GROUP BY h.entity_type, h.action
ORDER BY h.entity_type, h.action;

-- ------------------------------------------------------------------------------
-- 8. 2026 REAL DATA INTEGRITY CHECK (BENCHMARK VERIFICATION)
-- ------------------------------------------------------------------------------
SELECT 
    'Ngắn hạn (10 đợt)' AS category,
    COUNT(c.id) AS campaign_count,
    750 AS target_benchmark,
    762 AS registered_benchmark,
    512 AS paid_benchmark
FROM admission_campaigns c
JOIN admission_groups g ON g.id = c.group_id
WHERE g.code = 'NGAN_HAN' 
  AND c.year = 2026
  AND c.code NOT LIKE 'CAMP_%' 
  AND c.code NOT LIKE 'TEST_%' 
  AND c.code NOT LIKE 'MGR_%'
UNION ALL
SELECT 
    'Trung cấp (3 đợt)' AS category,
    COUNT(c.id) AS campaign_count,
    570 AS target_benchmark,
    1050 AS registered_benchmark,
    413 AS paid_benchmark
FROM admission_campaigns c
JOIN admission_groups g ON g.id = c.group_id
WHERE g.code = 'TRUNG_CAP' 
  AND c.year = 2026
  AND c.code NOT LIKE 'CAMP_%' 
  AND c.code NOT LIKE 'TEST_%' 
  AND c.code NOT LIKE 'MGR_%'
UNION ALL
SELECT 
    'Toàn trường (13 đợt)' AS category,
    COUNT(c.id) AS campaign_count,
    1320 AS target_benchmark,
    1812 AS registered_benchmark,
    925 AS paid_benchmark
FROM admission_campaigns c
WHERE c.year = 2026
  AND c.code NOT LIKE 'CAMP_%' 
  AND c.code NOT LIKE 'TEST_%' 
  AND c.code NOT LIKE 'MGR_%';

-- ------------------------------------------------------------------------------
-- 9. FOREIGN KEY DEPENDENCY GRAPH & SAFE CLEANUP ORDER
-- ------------------------------------------------------------------------------
-- Recommended cleanup order (Leaves -> Root):
-- 1. admission_change_history (Logs referencing test entities or SET NULL on cascade)
-- 2. admission_result_items (child of admission_results via result_id CASCADE)
-- 3. admission_results (child of admission_campaigns via campaign_id RESTRICT)
-- 4. admission_plans (campaign allocation tier: child of admission_campaigns CASCADE)
-- 5. admission_campaigns (test campaigns only: child of admission_groups RESTRICT)
-- 6. admission_programs (test programs only: child of admission_groups RESTRICT)
-- 7. admission_groups (test groups only)
