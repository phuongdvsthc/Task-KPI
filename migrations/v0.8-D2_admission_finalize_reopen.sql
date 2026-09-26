-- ==============================================================================
-- v0.8-D2: Chốt, mở lại và lịch sử kết quả tuyển sinh (Finalize & Reopen RPCs)
-- ==============================================================================

-- 1. Finalize Admission Result RPC
CREATE OR REPLACE FUNCTION finalize_admission_result(p_result_id UUID, p_note TEXT DEFAULT NULL)
RETURNS admission_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result admission_results;
    v_campaign admission_campaigns;
    v_caller_role TEXT;
    v_caller_id UUID;
    v_items_count INTEGER;
    v_sum_reg INTEGER;
    v_sum_paid INTEGER;
    v_active_items_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to finalize admission results';
    END IF;

    v_caller_role := admission_current_system_role();

    -- 1. Check permissions (Admin or Manager of the unit)
    -- Staff and Executive (without admin/manager role) cannot finalize
    IF v_caller_role = 'staff' OR (v_caller_role = 'executive' AND NOT admission_is_admin()) THEN
        RAISE EXCEPTION 'Access denied: staff and executive roles cannot finalize admission results';
    END IF;

    -- 2. Lock and fetch result
    SELECT * INTO v_result
    FROM admission_results
    WHERE id = p_result_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admission result not found: %', p_result_id;
    END IF;

    -- Fetch campaign and unit
    SELECT * INTO v_campaign
    FROM admission_campaigns
    WHERE id = v_result.campaign_id;

    -- 3. Check unit scope for manager
    IF v_caller_role = 'manager' AND NOT admission_is_admin() THEN
        IF v_campaign.unit_id IS NULL OR v_campaign.unit_id NOT IN (SELECT admission_user_unit_ids()) THEN
            RAISE EXCEPTION 'Access denied: manager can only finalize results within their assigned unit';
        END IF;
    END IF;

    -- 4. Check current status
    IF v_result.data_status = 'finalized' THEN
        RAISE EXCEPTION 'Kết quả tuyển sinh đã được chốt trước đó.';
    END IF;

    -- 5. Validate based on entry_mode
    IF v_result.entry_mode = 'detail_sum' THEN
        -- Check items exist and sum correctly
        SELECT COUNT(*), COALESCE(SUM(registered_count), 0), COALESCE(SUM(paid_count), 0)
        INTO v_items_count, v_sum_reg, v_sum_paid
        FROM admission_result_items
        WHERE result_id = p_result_id;

        IF v_items_count = 0 THEN
            RAISE EXCEPTION 'Không thể chốt đợt tuyển sinh theo chi tiết (detail_sum) khi chưa có dòng chi tiết nào.';
        END IF;

        -- Verify parent counts match sum of items
        IF v_result.registered_count IS DISTINCT FROM v_sum_reg OR v_result.paid_count IS DISTINCT FROM v_sum_paid THEN
            -- Automatically recalculate or enforce match
            UPDATE admission_results
            SET registered_count = v_sum_reg,
                paid_count = v_sum_paid,
                updated_at = NOW(),
                updated_by = v_caller_id
            WHERE id = p_result_id
            RETURNING * INTO v_result;
        END IF;

        IF v_result.paid_count > v_result.registered_count THEN
            RAISE EXCEPTION 'Số lượng đóng học phí không được lớn hơn số lượng đăng ký.';
        END IF;

    ELSIF v_result.entry_mode = 'manual_total' THEN
        IF v_result.registered_count IS NULL OR v_result.paid_count IS NULL THEN
            RAISE EXCEPTION 'Vui lòng nhập đầy đủ số lượng đăng ký và đóng học phí trước khi chốt.';
        END IF;
        IF v_result.paid_count > v_result.registered_count THEN
            RAISE EXCEPTION 'Số lượng đóng học phí không được lớn hơn số lượng đăng ký.';
        END IF;

        -- If detail items exist with numbers, verify sum matches manual total
        SELECT COUNT(*), COALESCE(SUM(registered_count), 0), COALESCE(SUM(paid_count), 0)
        INTO v_active_items_count, v_sum_reg, v_sum_paid
        FROM admission_result_items
        WHERE result_id = p_result_id AND (registered_count > 0 OR paid_count > 0);

        IF v_active_items_count > 0 THEN
            IF v_sum_reg <> v_result.registered_count OR v_sum_paid <> v_result.paid_count THEN
                RAISE EXCEPTION 'Số tổng nhập tay (ĐK: %, HP: %) không khớp với tổng dữ liệu chi tiết (ĐK: %, HP: %). Vui lòng đồng bộ hoặc chuyển sang chế độ chi tiết.',
                    v_result.registered_count, v_result.paid_count, v_sum_reg, v_sum_paid;
            END IF;
        END IF;
    ELSE
        RAISE EXCEPTION 'Chế độ nhập không hợp lệ: %', v_result.entry_mode;
    END IF;

    -- 6. Perform finalize update
    UPDATE admission_results
    SET data_status = 'finalized',
        finalized_by = v_caller_id,
        finalized_at = NOW(),
        notes = COALESCE(p_note, notes),
        updated_by = v_caller_id,
        updated_at = NOW()
    WHERE id = p_result_id
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION finalize_admission_result(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION finalize_admission_result(UUID, TEXT) TO authenticated;


-- 2. Reopen Admission Result RPC
CREATE OR REPLACE FUNCTION reopen_admission_result(p_result_id UUID, p_reason TEXT)
RETURNS admission_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result admission_results;
    v_campaign admission_campaigns;
    v_caller_role TEXT;
    v_caller_id UUID;
    v_clean_reason TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to reopen admission results';
    END IF;

    v_caller_role := admission_current_system_role();

    -- 1. Check permissions (Admin or Manager of the unit)
    IF v_caller_role = 'staff' OR (v_caller_role = 'executive' AND NOT admission_is_admin()) THEN
        RAISE EXCEPTION 'Access denied: staff and executive roles cannot reopen admission results';
    END IF;

    -- 2. Validate reason
    IF p_reason IS NULL THEN
        RAISE EXCEPTION 'Phải nhập lý do mở lại kết quả tuyển sinh.';
    END IF;

    v_clean_reason := TRIM(p_reason);
    IF LENGTH(v_clean_reason) < 5 THEN
        RAISE EXCEPTION 'Lý do mở lại phải có ít nhất 5 ký tự.';
    END IF;
    IF LENGTH(v_clean_reason) > 1000 THEN
        RAISE EXCEPTION 'Lý do mở lại không được vượt quá 1000 ký tự.';
    END IF;

    -- 3. Lock and fetch result
    SELECT * INTO v_result
    FROM admission_results
    WHERE id = p_result_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admission result not found: %', p_result_id;
    END IF;

    SELECT * INTO v_campaign
    FROM admission_campaigns
    WHERE id = v_result.campaign_id;

    -- 4. Check unit scope for manager
    IF v_caller_role = 'manager' AND NOT admission_is_admin() THEN
        IF v_campaign.unit_id IS NULL OR v_campaign.unit_id NOT IN (SELECT admission_user_unit_ids()) THEN
            RAISE EXCEPTION 'Access denied: manager can only reopen results within their assigned unit';
        END IF;
    END IF;

    -- 5. Check current status
    IF v_result.data_status = 'draft' THEN
        RAISE EXCEPTION 'Kết quả tuyển sinh đang ở trạng thái draft, không cần mở lại.';
    END IF;

    -- 6. Perform reopen update
    UPDATE admission_results
    SET data_status = 'draft',
        reopened_by = v_caller_id,
        reopened_at = NOW(),
        reopen_reason = v_clean_reason,
        updated_by = v_caller_id,
        updated_at = NOW()
    WHERE id = p_result_id
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION reopen_admission_result(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION reopen_admission_result(UUID, TEXT) TO authenticated;
