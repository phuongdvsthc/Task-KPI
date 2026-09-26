-- v0.4.5-A KPI Review Database + Lifecycle

-- Create enum for review status
CREATE TYPE kpi_review_status AS ENUM ('not_started', 'in_review', 'returned', 'approved');

-- 1. Review Header Table
CREATE TABLE kpi_assignment_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL REFERENCES kpi_assignments(id) ON DELETE CASCADE,
    status kpi_review_status NOT NULL DEFAULT 'not_started',
    reviewer_id uuid REFERENCES auth.users(id), -- Nullable initially, populated on action
    review_note text, -- Note attached to the overall review action (e.g. return reason)
    
    -- Lifecycle Tracking
    started_at timestamptz,
    returned_at timestamptz,
    approved_at timestamptz,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_assignment_review UNIQUE (assignment_id)
);

-- 2. Item-Level Review Snapshot Table
CREATE TABLE kpi_assignment_item_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_item_id uuid NOT NULL REFERENCES kpi_assignment_items(id) ON DELETE CASCADE,
    review_id uuid NOT NULL REFERENCES kpi_assignment_reviews(id) ON DELETE CASCADE,
    
    -- Immutable Snapshot Data saved upon Approval
    actual_snapshot jsonb, -- Output of actual resolver at approval
    score_snapshot jsonb,  -- Output of score resolver at approval
    
    -- Highly queried flat fields derived from score_snapshot
    final_raw_score numeric,
    final_weighted_score numeric,
    final_achievement_percent numeric,
    
    -- Granular Note
    reviewer_note text,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_item_review UNIQUE (assignment_item_id, review_id)
);

-- Indexes for performance
CREATE INDEX idx_kpi_assignment_reviews_assignment_id ON kpi_assignment_reviews(assignment_id);
CREATE INDEX idx_kpi_assignment_item_reviews_review_id ON kpi_assignment_item_reviews(review_id);
CREATE INDEX idx_kpi_assignment_item_reviews_item_id ON kpi_assignment_item_reviews(assignment_item_id);

-- Triggers for updated_at
CREATE TRIGGER update_kpi_assignment_reviews_updated_at
    BEFORE UPDATE ON kpi_assignment_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kpi_assignment_item_reviews_updated_at
    BEFORE UPDATE ON kpi_assignment_item_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE kpi_assignment_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_assignment_item_reviews ENABLE ROW LEVEL SECURITY;

-- Security Policies (Review inherits assignment view permissions)
CREATE POLICY "View assignment reviews if view assignment"
    ON kpi_assignment_reviews FOR SELECT
    USING (kpi_can_view_assignment(assignment_id));

CREATE POLICY "View item reviews if view item"
    ON kpi_assignment_item_reviews FOR SELECT
    USING (kpi_can_view_assignment_item(assignment_item_id));

-- Note: Mutating operations (UPDATE/DELETE) on these tables will be handled via SECURITY DEFINER RPCs 
-- instead of raw RLS policies to enforce business lifecycle rules (immutability after approval, etc.).
-- We intentionally DO NOT create generic INSERT/UPDATE policies for standard users.
