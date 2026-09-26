-- ==============================================================================
-- MIGRATION: v0.9-AI-B2_assistant_idempotency.sql
-- Description: Add additive client_request_id column and unique constraint
--              for message deduplication & idempotency on ai_messages.
-- Safe: Additive only, nullable, does not touch existing rows, no test data.
-- ==============================================================================

BEGIN;

-- 1. Add client_request_id column to ai_messages
ALTER TABLE public.ai_messages 
ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(128);

-- 2. Add unique constraint: for a given conversation and client_request_id,
--    prevent duplicate message submissions.
--    Partial unique index on non-null client_request_id ensures user messages
--    with an idempotency key cannot be duplicated.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_messages_convo_client_req 
ON public.ai_messages (conversation_id, client_request_id) 
WHERE client_request_id IS NOT NULL;

COMMIT;
