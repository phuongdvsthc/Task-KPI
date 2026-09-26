-- ==============================================================================
-- MIGRATION: XÓA AN TOÀN 4 ĐỢT TUYỂN SINH TEST CÒN SÓT TRONG MỘT TRANSACTION
-- ==============================================================================
-- Danh sách 4 mã chính xác cần xóa:
-- 1. TEST_CAMP_IN_1789896404681
-- 2. TEST_CAMP_OUT_1789896404681
-- 3. CAMP_OK_1789897002610
-- 4. TEST_TEST_1
-- ==============================================================================

DO $$
DECLARE
  v_target_codes TEXT[] := ARRAY[
    'TEST_CAMP_IN_1789896404681',
    'TEST_CAMP_OUT_1789896404681',
    'CAMP_OK_1789897002610',
    'TEST_TEST_1'
  ];
  v_found_count INTEGER;
  v_target_ids UUID[];
  v_plans_deleted INTEGER := 0;
  v_result_items_deleted INTEGER := 0;
  v_results_deleted INTEGER := 0;
  v_history_deleted INTEGER := 0;
  v_campaigns_deleted INTEGER := 0;
BEGIN
  -- BƯỚC 1: Lấy danh sách ID của 4 đợt tuyển sinh theo mã chính xác
  SELECT ARRAY_AGG(id)
  INTO v_target_ids
  FROM public.admission_campaigns
  WHERE code = ANY(v_target_codes);

  v_found_count := COALESCE(CARDINALITY(v_target_ids), 0);

  -- KIỂM TRA TOÀN VẸN: Phải tìm thấy chính xác 4 đợt, không thừa không thiếu
  IF v_found_count <> 4 THEN
    RAISE EXCEPTION 'XÁC THỰC THẤT BẠI: Tìm thấy % đợt thay vì 4 đợt dự kiến. Đã rollback toàn bộ!', v_found_count;
  END IF;

  RAISE NOTICE 'Đã xác thực 4 đợt tuyển sinh hợp lệ. Bắt đầu xóa dữ liệu phụ thuộc...';

  -- BƯỚC 2: Xóa các chi tiết kết quả (nếu có) thông qua result_id của các kết quả thuộc 4 đợt này
  DELETE FROM public.admission_result_items
  WHERE result_id IN (
    SELECT id FROM public.admission_results WHERE campaign_id = ANY(v_target_ids)
  );
  GET DIAGNOSTICS v_result_items_deleted = ROW_COUNT;

  -- BƯỚC 3: Xóa kết quả tuyển sinh thuộc 4 đợt này (nếu có)
  DELETE FROM public.admission_results
  WHERE campaign_id = ANY(v_target_ids);
  GET DIAGNOSTICS v_results_deleted = ROW_COUNT;

  -- BƯỚC 4: Xóa kế hoạch/chỉ tiêu tuyển sinh thuộc 4 đợt này (nếu có)
  DELETE FROM public.admission_plans
  WHERE campaign_id = ANY(v_target_ids);
  GET DIAGNOSTICS v_plans_deleted = ROW_COUNT;

  -- BƯỚC 5: Xóa lịch sử thay đổi / audit log liên quan trực tiếp đến 4 đợt này
  DELETE FROM public.admission_change_history
  WHERE campaign_id = ANY(v_target_ids)
     OR (entity_type = 'admission_campaign' AND entity_id = ANY(v_target_ids));
  GET DIAGNOSTICS v_history_deleted = ROW_COUNT;

  -- BƯỚC 6: Xóa chính xác 4 bản ghi đợt tuyển sinh trong bảng admission_campaigns
  DELETE FROM public.admission_campaigns
  WHERE id = ANY(v_target_ids)
    AND code = ANY(v_target_codes);
  GET DIAGNOSTICS v_campaigns_deleted = ROW_COUNT;

  -- KIỂM TRA LẦN CUỐI: Đảm bảo đã xóa đúng 4 đợt
  IF v_campaigns_deleted <> 4 THEN
    RAISE EXCEPTION 'LỖI SỐ LƯỢNG XÓA: Đã xóa % đợt thay vì 4 đợt. Rollback toàn bộ!', v_campaigns_deleted;
  END IF;

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'DỌN DỮ LIỆU THÀNH CÔNG VÀ AN TOÀN:';
  RAISE NOTICE '  - admission_result_items đã xóa: %', v_result_items_deleted;
  RAISE NOTICE '  - admission_results đã xóa: %', v_results_deleted;
  RAISE NOTICE '  - admission_plans đã xóa: %', v_plans_deleted;
  RAISE NOTICE '  - admission_change_history đã xóa: %', v_history_deleted;
  RAISE NOTICE '  - admission_campaigns đã xóa: %', v_campaigns_deleted;
  RAISE NOTICE '==================================================';
END $$;
