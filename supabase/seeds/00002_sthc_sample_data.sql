-- ====================================================================
-- SEED: 00002_sthc_sample_data.sql
-- PURPOSE: STHC Institution Data & Demo Fixtures (Optional / Opt-in)
-- DEPENDENCIES: 00001 - 00009 schema migrations AND 00001_core_baseline_seed.sql
-- NOTE: CHỈ CHẠY KHI ĐƯỢC CHỌN RÕ RÀNG (DEMO / STHC REPLICATION MODE).
--       KHÔNG ĐƯỢC TỰ ĐỘNG CHẠY TRONG QUY TRÌNH TRIỂN KHAI TRƯỜNG MỚI.
-- GUARANTEE: 100% Idempotent (safe to re-run)
-- ====================================================================

-- --------------------------------------------------------------------
-- SECTION 1: STHC INSTITUTION IDENTITY SETTINGS
-- --------------------------------------------------------------------
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, is_public, setting_group, label, sort_order)
VALUES
    ('organization_name', 'Trường Cao đẳng Du lịch Sài Gòn', 'text', TRUE, 'general', 'Tên cơ quan / Trường', 10),
    ('organization_short_name', 'STHC', 'text', TRUE, 'general', 'Tên viết tắt', 11),
    ('organization_address', '23/8 Hoàng Việt, Phường Tân Sơn Nhất, TP. HCM', 'text', TRUE, 'general', 'Địa chỉ trụ sở', 12),
    ('organization_phone', '1800558827', 'text', TRUE, 'general', 'Điện thoại liên hệ', 13),
    ('organization_email', 'admin@saigontourist.edu.vn', 'text', TRUE, 'general', 'Email chính thức', 14),
    ('organization_website', 'https://saigontourist.edu.vn', 'text', TRUE, 'general', 'Website', 15)
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    setting_type = EXCLUDED.setting_type,
    is_public = EXCLUDED.is_public,
    setting_group = EXCLUDED.setting_group,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order;

-- --------------------------------------------------------------------
-- SECTION 2: STHC ROOT & ORGANIZATIONAL UNITS
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_root_unit_id UUID;
BEGIN
    -- 1. Create ROOT School Unit
    INSERT INTO public.organization_units (code, name, unit_type, description, sort_order, is_active)
    VALUES ('STHC', 'Trường Saigontourist', 'school', 'Đơn vị cấp trường cao nhất', 1, TRUE)
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        unit_type = EXCLUDED.unit_type,
        is_active = EXCLUDED.is_active
    RETURNING id INTO v_root_unit_id;

    IF v_root_unit_id IS NULL THEN
        SELECT id INTO v_root_unit_id FROM public.organization_units WHERE code = 'STHC';
    END IF;

    -- 2. Create Child Functional Departments
    INSERT INTO public.organization_units (parent_id, code, name, unit_type, description, sort_order, is_active)
    VALUES
        (v_root_unit_id, 'HCNS', 'Phòng Hành chính nhân sự', 'department', 'Quản lý nhân sự, hành chính trường', 10, TRUE),
        (v_root_unit_id, 'TT-HTQT', 'Phòng Truyền thông và HTQT', 'department', 'Công tác truyền thông và hợp tác quốc tế', 20, TRUE),
        (v_root_unit_id, 'BPTS', 'Bộ phận Tuyển sinh', 'department', 'Bộ phận chuyên trách công tác tuyển sinh các hệ đào tạo', 30, TRUE)
    ON CONFLICT (code) DO UPDATE SET
        parent_id = EXCLUDED.parent_id,
        name = EXCLUDED.name,
        unit_type = EXCLUDED.unit_type,
        is_active = EXCLUDED.is_active;
END $$;

-- --------------------------------------------------------------------
-- SECTION 3: STHC 12 STANDARD TRAINING PROGRAMS
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_tc_group_id UUID;
    v_nh_group_id UUID;
BEGIN
    SELECT id INTO v_tc_group_id FROM public.admission_groups WHERE code = 'TRUNG_CAP';
    SELECT id INTO v_nh_group_id FROM public.admission_groups WHERE code = 'NGAN_HAN';

    IF v_tc_group_id IS NOT NULL THEN
        -- 8 Chương trình Trung cấp
        INSERT INTO public.admission_programs (group_id, code, name, description, training_level, duration, sort_order, is_active)
        VALUES
            (v_tc_group_id, 'QTKSDN', 'Quản trị Khách sạn', 'Đào tạo chuyên sâu về quản lý vận hành cơ sở lưu trú và khách sạn tiêu chuẩn quốc tế.', 'trung_cap', '1.5 - 2 năm', 1, TRUE),
            (v_tc_group_id, 'QTNHA', 'Quản trị Nhà hàng & Dịch vụ Ăn uống', 'Đào tạo kỹ năng quản lý kinh doanh ẩm thực, bar và chuỗi nhà hàng chuyên nghiệp.', 'trung_cap', '1.5 - 2 năm', 2, TRUE),
            (v_tc_group_id, 'KTCBMA', 'Kỹ thuật Chế biến Món ăn', 'Đào tạo đầu bếp chuyên nghiệp với kỹ năng chế biến món ăn Việt Nam, Á và Âu.', 'trung_cap', '1.5 - 2 năm', 3, TRUE),
            (v_tc_group_id, 'HDDL', 'Hướng dẫn Du lịch', 'Đào tạo hướng dẫn viên du lịch nội địa và quốc tế, thuyết minh viên điểm đến.', 'trung_cap', '1.5 - 2 năm', 4, TRUE),
            (v_tc_group_id, 'QTLH', 'Quản trị Lữ hành', 'Thiết kế, tổ chức và điều hành các chương trình du lịch chuyên nghiệp.', 'trung_cap', '1.5 - 2 năm', 5, TRUE),
            (v_tc_group_id, 'KTBLMA', 'Kỹ thuật Làm bánh và Món ăn tráng miệng', 'Nghệ thuật làm bánh Âu - Á, bánh mì và các món tráng miệng cao cấp.', 'trung_cap', '1.5 - 2 năm', 6, TRUE),
            (v_tc_group_id, 'PCBM', 'Pha chế Đồ uống (Bartender/Barista)', 'Nghệ thuật pha chế cocktail, mocktail, cà phê chuyên nghiệp.', 'trung_cap', '1.5 - 2 năm', 7, TRUE),
            (v_tc_group_id, 'LT', 'Nghiệp vụ Lễ tân Khách sạn', 'Kỹ năng giao tiếp, xử lý tình huống và vận hành tiền sảnh chuyên nghiệp.', 'trung_cap', '1.5 - 2 năm', 8, TRUE)
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            training_level = EXCLUDED.training_level,
            duration = EXCLUDED.duration,
            sort_order = EXCLUDED.sort_order,
            is_active = EXCLUDED.is_active;
    END IF;

    IF v_nh_group_id IS NOT NULL THEN
        -- 4 Khóa học Ngắn hạn
        INSERT INTO public.admission_programs (group_id, code, name, description, training_level, duration, sort_order, is_active)
        VALUES
            (v_nh_group_id, 'NVLT', 'Nghiệp vụ Lễ tân Quốc tế', 'Khóa bồi dưỡng nghiệp vụ lễ tân tiêu chuẩn khách sạn 4-5 sao.', 'ngan_han', '2 - 3 tháng', 1, TRUE),
            (v_nh_group_id, 'NVBA', 'Nghiệp vụ Bàn Á - Âu', 'Kỹ năng phục vụ bàn tiệc, hội nghị và nhà hàng cao cấp.', 'ngan_han', '2 - 3 tháng', 2, TRUE),
            (v_nh_group_id, 'NVBP', 'Nghiệp vụ Buồng phòng Khách sạn', 'Quy trình vệ sinh, bài trí buồng phòng chuẩn quốc tế.', 'ngan_han', '2 tháng', 3, TRUE),
            (v_nh_group_id, 'NVPD', 'Kỹ thuật Pha chế Đồ uống Căn bản', 'Khóa học pha chế thực hành dành cho người mới bắt đầu.', 'ngan_han', '1.5 - 3 tháng', 4, TRUE)
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            training_level = EXCLUDED.training_level,
            duration = EXCLUDED.duration,
            sort_order = EXCLUDED.sort_order,
            is_active = EXCLUDED.is_active;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- SECTION 4: STHC 2026 ADMISSION CAMPAIGNS (13 CAMPAIGNS)
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_tc_group_id UUID;
    v_nh_group_id UUID;
    v_bpts_id UUID;
BEGIN
    SELECT id INTO v_tc_group_id FROM public.admission_groups WHERE code = 'TRUNG_CAP';
    SELECT id INTO v_nh_group_id FROM public.admission_groups WHERE code = 'NGAN_HAN';
    SELECT id INTO v_bpts_id FROM public.organization_units WHERE code = 'BPTS';

    -- 5 đợt Tuyển sinh Trung cấp 2026
    IF v_tc_group_id IS NOT NULL THEN
        INSERT INTO public.admission_campaigns (group_id, code, name, year, period_number, start_date, end_date, status, is_active, description, unit_id)
        VALUES
            (v_tc_group_id, 'TC-2026-D01', 'Tuyển sinh Trung cấp 2026 - Đợt 1', 2026, 1, '2026-01-05', '2026-03-31', 'active', TRUE, 'Đợt tuyển sinh Trung cấp đầu năm 2026', v_bpts_id),
            (v_tc_group_id, 'TC-2026-D02', 'Tuyển sinh Trung cấp 2026 - Đợt 2', 2026, 2, '2026-04-01', '2026-06-30', 'active', TRUE, 'Đợt tuyển sinh Trung cấp quý II/2026', v_bpts_id),
            (v_tc_group_id, 'TC-2026-D03', 'Tuyển sinh Trung cấp 2026 - Đợt 3', 2026, 3, '2026-07-01', '2026-08-31', 'upcoming', TRUE, 'Đợt tuyển sinh Trung cấp trọng điểm hè 2026', v_bpts_id),
            (v_tc_group_id, 'TC-2026-D04', 'Tuyển sinh Trung cấp 2026 - Đợt 4', 2026, 4, '2026-09-01', '2026-10-31', 'upcoming', TRUE, 'Đợt tuyển sinh Trung cấp nhập học mùa thu 2026', v_bpts_id),
            (v_tc_group_id, 'TC-2026-D05', 'Tuyển sinh Trung cấp 2026 - Đợt 5', 2026, 5, '2026-11-01', '2026-12-31', 'upcoming', TRUE, 'Đợt tuyển sinh Trung cấp cuối năm 2026', v_bpts_id)
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            year = EXCLUDED.year,
            period_number = EXCLUDED.period_number,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            status = EXCLUDED.status,
            is_active = EXCLUDED.is_active,
            unit_id = EXCLUDED.unit_id;
    END IF;

    -- 8 đợt Tuyển sinh Đào tạo ngắn hạn 2026
    IF v_nh_group_id IS NOT NULL THEN
        INSERT INTO public.admission_campaigns (group_id, code, name, year, period_number, start_date, end_date, status, is_active, description, unit_id)
        VALUES
            (v_nh_group_id, 'NH-2026-D01', 'Tuyển sinh Ngắn hạn 2026 - Đợt 1', 2026, 1, '2026-01-05', '2026-02-15', 'active', TRUE, 'Khóa đào tạo ngắn hạn quý I/2026 - Đợt 1', v_bpts_id),
            (v_nh_group_id, 'NH-2026-D02', 'Tuyển sinh Ngắn hạn 2026 - Đợt 2', 2026, 2, '2026-02-16', '2026-03-31', 'active', TRUE, 'Khóa đào tạo ngắn hạn quý I/2026 - Đợt 2', v_bpts_id),
            (v_nh_group_id, 'NH-2026-D03', 'Tuyển sinh Ngắn hạn 2026 - Đợt 3', 2026, 3, '2026-04-01', '2026-05-15', 'upcoming', TRUE, 'Khóa đào tạo ngắn hạn quý II/2026 - Đợt 1', v_bpts_id),
            (v_nh_group_id, 'NH-2026-D04', 'Tuyển sinh Ngắn hạn 2026 - Đợt 4', 2026, 4, '2026-05-16', '2026-06-30', 'upcoming', TRUE, 'Khóa đào tạo ngắn hạn quý II/2026 - Đợt 2', v_bpts_id),
            (v_nh_group_id, 'NH-2026-D05', 'Tuyển sinh Ngắn hạn 2026 - Đợt 5', 2026, 5, '2026-07-01', '2026-08-15', 'upcoming', TRUE, 'Khóa đào tạo ngắn hạn hè 2026 - Đợt 1', v_bpts_id),
            (v_nh_group_id, 'NH-2026-D06', 'Tuyển sinh Ngắn hạn 2026 - Đợt 6', 2026, 6, '2026-08-16', '2026-09-30', 'upcoming', TRUE, 'Khóa đào tạo ngắn hạn hè 2026 - Đợt 2', v_bpts_id),
            (v_nh_group_id, 'NH-2026-D07', 'Tuyển sinh Ngắn hạn 2026 - Đợt 7', 2026, 7, '2026-10-01', '2026-11-15', 'upcoming', TRUE, 'Khóa đào tạo ngắn hạn quý IV/2026 - Đợt 1', v_bpts_id),
            (v_nh_group_id, 'NH-2026-D08', 'Tuyển sinh Ngắn hạn 2026 - Đợt 8', 2026, 8, '2026-11-16', '2026-12-31', 'upcoming', TRUE, 'Khóa đào tạo ngắn hạn quý IV/2026 - Đợt 2', v_bpts_id)
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            year = EXCLUDED.year,
            period_number = EXCLUDED.period_number,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            status = EXCLUDED.status,
            is_active = EXCLUDED.is_active,
            unit_id = EXCLUDED.unit_id;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- SECTION 5: STHC 2026 OFFICIAL ANNUAL TARGET PLANS
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_tc_group_id UUID;
    v_nh_group_id UUID;
    v_bpts_id UUID;
BEGIN
    SELECT id INTO v_tc_group_id FROM public.admission_groups WHERE code = 'TRUNG_CAP';
    SELECT id INTO v_nh_group_id FROM public.admission_groups WHERE code = 'NGAN_HAN';
    SELECT id INTO v_bpts_id FROM public.organization_units WHERE code = 'BPTS';

    -- Kế hoạch chỉ tiêu năm Trung cấp (570 chỉ tiêu)
    IF v_tc_group_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.admission_plans 
        WHERE admission_year = 2026 AND group_id = v_tc_group_id AND campaign_id IS NULL AND program_id IS NULL
    ) THEN
        INSERT INTO public.admission_plans (admission_year, group_id, unit_id, target_paid_count, status, notes)
        VALUES (2026, v_tc_group_id, v_bpts_id, 570, 'approved', 'Chỉ tiêu tuyển sinh Trung cấp chính thức năm 2026 (STHC)');
    END IF;

    -- Kế hoạch chỉ tiêu năm Ngắn hạn (750 chỉ tiêu)
    IF v_nh_group_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.admission_plans 
        WHERE admission_year = 2026 AND group_id = v_nh_group_id AND campaign_id IS NULL AND program_id IS NULL
    ) THEN
        INSERT INTO public.admission_plans (admission_year, group_id, unit_id, target_paid_count, status, notes)
        VALUES (2026, v_nh_group_id, v_bpts_id, 750, 'approved', 'Chỉ tiêu đào tạo ngắn hạn chính thức năm 2026 (STHC)');
    END IF;
END $$;
