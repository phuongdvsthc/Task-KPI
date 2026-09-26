-- ==============================================================================
-- MIGRATION v0.2.2.1: Task & Announcement Attachments
-- ==============================================================================

-- 1. Create public.task_attachments table
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NULL,
  file_size bigint NULL,
  attachment_type text NOT NULL DEFAULT 'instruction', -- 'instruction' | 'reference' | 'template'
  uploaded_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  content_version integer NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON public.task_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON public.task_attachments(created_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Users who can view the task can view its attachments
CREATE POLICY "Users can view attachments of tasks they have access to"
ON public.task_attachments
FOR SELECT
USING (
  -- System admin has full read access
  current_user_system_role() = 'admin'
  -- Task creator has read access
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
    AND t.created_by = auth.uid()
  )
  -- Active task assignees / recipients have read access
  OR EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = task_attachments.task_id
    AND ta.user_id = auth.uid()
    AND ta.is_active = true
  )
  -- Unit manager has read access
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
    AND can_manage_unit(t.organization_unit_id)
  )
);

-- Policy: INSERT - Users who can manage or contribute to the task can attach files
CREATE POLICY "Managers and authorized users can insert attachments"
ON public.task_attachments
FOR INSERT
WITH CHECK (
  current_user_system_role() = 'admin'
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
    AND (
      t.created_by = auth.uid()
      OR can_manage_unit(t.organization_unit_id)
      OR (t.task_type = 'announcement' AND can_manage_announcement(t.id))
    )
  )
);

-- Policy: DELETE - Only creator, unit manager, or admin can delete; cannot delete if published announcement
CREATE POLICY "Authorized users can delete attachments"
ON public.task_attachments
FOR DELETE
USING (
  current_user_system_role() = 'admin'
  OR (
    -- Cannot delete attachments of published announcements
    NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_attachments.task_id
      AND t.task_type = 'announcement'
      AND t.publication_status = 'published'
    )
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_attachments.task_id
      AND (
        t.created_by = auth.uid()
        OR can_manage_unit(t.organization_unit_id)
        OR task_attachments.uploaded_by = auth.uid()
      )
    )
  )
);
