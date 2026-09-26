/**
 * Supabase Client Initialization & Configuration
 * Re-exports the centralized client implementation from src/lib/supabase/client.ts
 */
export {
  supabase,
  getSupabase,
  getSupabaseClient,
  getSupabaseConfig,
  isSupabaseConfigured,
  saveSupabaseConfig,
  clearCustomSupabaseConfig,
  isValidSupabaseUrl,
  isValidSupabaseAnonKey,
  testSupabaseConnection,
  maskKey,
  type SupabaseConfigStatus,
  type ConnectionTestResult,
} from '../lib/supabase/client';
export { default } from '../lib/supabase/client';
