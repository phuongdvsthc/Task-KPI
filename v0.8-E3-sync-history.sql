-- v0.8-E3: Sync Batches and Sync Batch Sheets SQL
CREATE TABLE IF NOT EXISTS admission_sync_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('processing', 'succeeded', 'failed')),
    selected_sheet_count INTEGER NOT NULL DEFAULT 0,
    created_result_count INTEGER NOT NULL DEFAULT 0,
    updated_result_count INTEGER NOT NULL DEFAULT 0,
    unchanged_result_count INTEGER NOT NULL DEFAULT 0,
    total_registered INTEGER NOT NULL DEFAULT 0,
    total_paid INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admission_sync_batch_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES admission_sync_batches(id) ON DELETE CASCADE,
    sheet_name TEXT NOT NULL,
    sheet_hash TEXT NOT NULL,
    campaign_id UUID REFERENCES admission_campaigns(id) ON DELETE SET NULL,
    entry_mode TEXT NOT NULL CHECK (entry_mode IN ('detail_sum', 'manual_total')),
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'unchanged')),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    registered_count INTEGER NOT NULL DEFAULT 0,
    paid_count INTEGER NOT NULL DEFAULT 0,
    detail_row_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE admission_sync_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_sync_batch_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage admission sync batches" ON admission_sync_batches;
CREATE POLICY "Admins can manage admission sync batches" ON admission_sync_batches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can manage admission sync batch sheets" ON admission_sync_batch_sheets;
CREATE POLICY "Admins can manage admission sync batch sheets" ON admission_sync_batch_sheets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
        )
    );
