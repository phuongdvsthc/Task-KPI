-- ====================================================================
-- MIGRATION: 00001_extensions.sql
-- PURPOSE: Initialize required PostgreSQL extensions
-- DEPENDENCIES: None
-- VERIFICATION: Verified on live Supabase database
-- ====================================================================

-- Extension for UUID generation and cryptographic hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Extension for AI Vector Embeddings (768 dimensions for Gemini/RAG)
CREATE EXTENSION IF NOT EXISTS "vector";
