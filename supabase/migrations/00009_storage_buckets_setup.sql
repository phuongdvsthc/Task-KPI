-- ====================================================================
-- MIGRATION: 00009_storage_buckets_setup.sql
-- PURPOSE: Supabase Storage buckets provisioning and access policies
-- DEPENDENCIES: 00001_extensions.sql, 00002_core_organization_and_users.sql
-- ====================================================================

-- 1. PROVISION BUCKETS IDEMPOTENTLY
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'system-assets',
        'system-assets',
        true,
        5242880,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']::text[]
    ),
    (
        'task-evidence',
        'task-evidence',
        false,
        52428800,
        NULL
    ),
    (
        'task-attachments',
        'task-attachments',
        false,
        20971520,
        NULL
    ),
    (
        'ai-knowledge-docs',
        'ai-knowledge-docs',
        false,
        20971520,
        ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'text/markdown']::text[]
    )
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. STORAGE OBJECT POLICIES
-- System Assets (Public read, admin write)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Public can view system assets" ON storage.objects;
    CREATE POLICY "Public can view system assets" ON storage.objects
        FOR SELECT USING (bucket_id = 'system-assets');
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Task Evidence (Authenticated access)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated users can upload task evidence" ON storage.objects;
    CREATE POLICY "Authenticated users can upload task evidence" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'task-evidence' AND auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Authenticated users can view task evidence" ON storage.objects;
    CREATE POLICY "Authenticated users can view task evidence" ON storage.objects
        FOR SELECT USING (bucket_id = 'task-evidence' AND auth.role() = 'authenticated');
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Task Attachments (Authenticated access)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;
    CREATE POLICY "Authenticated users can upload task attachments" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Authenticated users can view task attachments" ON storage.objects;
    CREATE POLICY "Authenticated users can view task attachments" ON storage.objects
        FOR SELECT USING (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- AI Knowledge Docs (Restricted / Service Role & Admin)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can upload to ai-knowledge-docs bucket" ON storage.objects;
    CREATE POLICY "Admins can upload to ai-knowledge-docs bucket" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'ai-knowledge-docs' AND auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Admins can read from ai-knowledge-docs bucket" ON storage.objects;
    CREATE POLICY "Admins can read from ai-knowledge-docs bucket" ON storage.objects
        FOR SELECT USING (bucket_id = 'ai-knowledge-docs' AND auth.role() = 'authenticated');
EXCEPTION WHEN undefined_table THEN NULL; END $$;
