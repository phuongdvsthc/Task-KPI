-- ============================================================================
-- Migration / Tooling Script: v0.7-H2 – Database Test Data Cleanup
-- Description: Cleans test, fixture, demo, and automated self-test operational data
-- and non-allowlist users, while preserving the 11 designated allowlist accounts
-- and all system configuration, schemas, migrations, RLS policies, and triggers.
-- ============================================================================

-- 1. Operational data cleanup (Child tables first)
DELETE FROM public.task_assignees;
DELETE FROM public.task_collaborators;
DELETE FROM public.task_comments;
DELETE FROM public.task_attachments;
DELETE FROM public.task_activities;
DELETE FROM public.notification_recipients;
DELETE FROM public.notifications;
DELETE FROM public.reminders;
DELETE FROM public.kpi_evaluations;
DELETE FROM public.kpi_actuals;
DELETE FROM public.kpi_assignments;
DELETE FROM public.metric_entries;
DELETE FROM public.daily_reports;
DELETE FROM public.work_mode_entries;
DELETE FROM public.announcement_recipients;
DELETE FROM public.announcements;
DELETE FROM public.tasks;
DELETE FROM public.self_test_logs;
DELETE FROM public.fixture_records;

-- 2. Cleanup non-allowlist organization members & profiles
DELETE FROM public.organization_members 
WHERE user_id IN (
  SELECT id FROM public.profiles 
  WHERE lower(btrim(email)) NOT IN (
    'admin@truonghoc.edu.vn',
    'doantlk@sthc.edu.vn',
    'sonmnb@sthc.edu.vn',
    'tuyenntn@sthc.edu.vn',
    'trangnth@sthc.edu.vn',
    'minhna@sthc.edu.vn',
    'vytt@sthc.edu.vn',
    'tramlnn@sthc.edu.vn',
    'baonh@sthc.edu.vn',
    'loanbtk@sthc.edu.vn',
    'phuongdv@sthc.edu.vn'
  )
);

DELETE FROM public.profiles 
WHERE lower(btrim(email)) NOT IN (
  'admin@truonghoc.edu.vn',
  'doantlk@sthc.edu.vn',
  'sonmnb@sthc.edu.vn',
  'tuyenntn@sthc.edu.vn',
  'trangnth@sthc.edu.vn',
  'minhna@sthc.edu.vn',
  'vytt@sthc.edu.vn',
  'tramlnn@sthc.edu.vn',
  'baonh@sthc.edu.vn',
  'loanbtk@sthc.edu.vn',
  'phuongdv@sthc.edu.vn'
);
