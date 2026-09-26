-- ==============================================================================
-- MIGRATION v0.2.2: Broadcast / Announcement + Viewed / Acknowledged + Send All
-- ==============================================================================

-- 1. Extend tasks table for Announcements
ALTER TABLE IF EXISTS tasks
  ADD COLUMN IF NOT EXISTS task_type text DEFAULT 'task',
  ADD COLUMN IF NOT EXISTS acknowledgement_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS content_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS publication_status text DEFAULT 'published';

-- Backfill legacy tasks
UPDATE tasks 
SET task_type = 'task',
    publication_status = 'published',
    content_version = COALESCE(content_version, 1),
    acknowledgement_required = COALESCE(acknowledgement_required, false)
WHERE task_type IS NULL OR task_type = '' OR task_type NOT IN ('task', 'announcement');

-- 2. Extend task_assignees / task_recipients table for View and Ack Tracking
ALTER TABLE IF EXISTS task_assignees
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_viewed_version integer NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_version integer NULL,
  ADD COLUMN IF NOT EXISTS organization_unit_id_snapshot uuid NULL;

-- 3. Extend notifications table if needed
ALTER TABLE IF EXISTS notifications
  ADD COLUMN IF NOT EXISTS notification_type text NULL,
  ADD COLUMN IF NOT EXISTS entity_type text NULL,
  ADD COLUMN IF NOT EXISTS entity_id text NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid NULL;

-- 4. Create Performance & Scope Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_type_status ON tasks(task_type, publication_status, published_at);
CREATE INDEX IF NOT EXISTS idx_task_assignees_lookup ON task_assignees(task_id, user_id, assignment_role);
CREATE INDEX IF NOT EXISTS idx_task_assignees_viewed_version ON task_assignees(task_id, last_viewed_version);
CREATE INDEX IF NOT EXISTS idx_task_assignees_ack_version ON task_assignees(task_id, acknowledged_version);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- 5. Announcement reminders tracking table for 60-minute cooldown
CREATE TABLE IF NOT EXISTS announcement_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  reminder_type text NOT NULL, -- 'view_reminder' | 'ack_reminder'
  content_version integer NOT NULL DEFAULT 1,
  reminded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcement_reminders_cooldown 
  ON announcement_reminders(announcement_id, target_user_id, reminder_type, content_version, created_at);

