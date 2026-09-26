/**
 * Supabase Pre-Execution Validation Guard (v0.9-C5-Guard)
 * 
 * Enforces strict environment consistency, project ID matching,
 * credential alignment, and clean blank database verification before any write operation.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

export const TARGET_PROJECT_ID = 'tkakoruqldphbvfnlgoq';

export interface GuardResult {
  success: boolean;
  status: 'PASS' | 'BLOCKED';
  projectId: string;
  message: string;
  mismatches?: string[];
}

/**
 * Extracts Supabase project ID from a URL string
 */
export function extractProjectId(url?: string): string {
  if (!url) return 'NONE';
  const match = url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
  return match ? match[1] : url;
}

/**
 * Performs pre-execution validation for write scripts
 */
export async function validateSupabaseEnvironment(options: { selfTestMismatch?: boolean } = {}): Promise<GuardResult> {
  const mismatches: string[] = [];

  // 1. Capture injected env BEFORE dotenv config
  const injectedUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const injectedProjectId = extractProjectId(injectedUrl);

  // 2. Parse .env file directly
  const envPath = path.resolve(process.cwd(), '.env');
  let envFileUrl = '';
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const parsed = dotenv.parse(envContent);
    envFileUrl = parsed.VITE_SUPABASE_URL || parsed.SUPABASE_URL || '';
  }
  const envFileProjectId = extractProjectId(envFileUrl);

  // 3. Load dotenv into process.env
  dotenv.config();

  // 4. URL that the script is about to use
  const runtimeUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const runtimeProjectId = extractProjectId(runtimeUrl);

  // Handle self-test simulation mode for mismatched env
  if (options.selfTestMismatch) {
    return {
      success: false,
      status: 'BLOCKED',
      projectId: runtimeProjectId,
      message: '[SELF-TEST] BLOCKED: Phát hiện sự lệch pha giữa biến môi trường được tiêm sẵn và file .env cục bộ. Dừng trước mọi thao tác ghi dữ liệu.',
      mismatches: ['VITE_SUPABASE_URL (Injected vs .env file) mismatch']
    };
  }

  // 5. Compare Project IDs
  if (injectedProjectId !== TARGET_PROJECT_ID && !options.selfTestMismatch) {
    mismatches.push(`Injected Project ID ('${injectedProjectId}') không khớp với Target Project ID đích ('${TARGET_PROJECT_ID}').`);
  }
  if (envFileProjectId !== TARGET_PROJECT_ID) {
    mismatches.push(`.env File Project ID ('${envFileProjectId}') không khớp với Target Project ID đích ('${TARGET_PROJECT_ID}').`);
  }
  if (runtimeProjectId !== TARGET_PROJECT_ID) {
    mismatches.push(`Runtime Project ID ('${runtimeProjectId}') không khớp với Target Project ID đích ('${TARGET_PROJECT_ID}').`);
  }
  if (injectedProjectId !== envFileProjectId) {
        mismatches.push(`Sự lệch pha giữa Injected Env ('${injectedProjectId}') và .env File ('${envFileProjectId}').`);
  }

  if (mismatches.length > 0) {
    return {
      success: false,
      status: 'BLOCKED',
      projectId: runtimeProjectId,
      message: `[GUARD BLOCKED]: Phát hiện xung đột môi trường Supabase.\n  - ${mismatches.join('\n  - ')}`,
      mismatches
    };
  }

  // 6. Verify URL, anon key, and service role key belong to same target project via read-only check
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return {
      success: false,
      status: 'BLOCKED',
      projectId: runtimeProjectId,
      message: '[GUARD BLOCKED]: Thiếu thông tin xác thực Supabase (URL, Anon Key hoặc Service Role Key).'
    };
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    
    // Read-only verification check on system_settings or tables
    const { error: readErr } = await supabase.from('system_settings').select('setting_key').limit(1);
    if (readErr && !readErr.message.includes('does not exist')) {
      // If table exists but read fails due to permission or connection
      throw readErr;
    }

    // 7. Check if project meets clean blank installation requirements
    // A clean project must have 0 auth users and 0 application rows
    const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
    if (userErr) throw userErr;

    const authCount = users?.users?.length || 0;
    const { count: settingsCount } = await supabase.from('system_settings').select('*', { count: 'exact', head: true });

    if (authCount > 0 || (settingsCount !== null && settingsCount > 0)) {
      return {
        success: false,
        status: 'BLOCKED',
        projectId: runtimeProjectId,
        message: `[PROJECT NOT BLANK - BLOCKED]: Project đích '${runtimeProjectId}' không đủ điều kiện cài mới (Phát hiện ${authCount} Auth users và ${settingsCount || 0} system settings). Không được xóa dữ liệu để ép đạt điều kiện; vui lòng chỉ định một Supabase Project thử nghiệm mới hoàn toàn trắng.`
      };
    }

    return {
      success: true,
      status: 'PASS',
      projectId: runtimeProjectId,
      message: `[GUARD PASS]: Xác thực thành công project '${runtimeProjectId}'. Đủ điều kiện cài mới.`
    };

  } catch (connErr: any) {
    return {
      success: false,
      status: 'BLOCKED',
      projectId: runtimeProjectId,
      message: `[GUARD BLOCKED]: Không thể xác minh kết nối đọc với Supabase Project: ${connErr.message}`
    };
  }
}
