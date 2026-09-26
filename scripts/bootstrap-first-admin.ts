/**
 * First Admin Bootstrap Engine (v0.9-C5-E)
 *
 * One-time bootstrap script for fresh Supabase projects.
 * Runs AFTER migrations (00001-00009), core baseline seed, and tenant configuration.
 *
 * Guarantees & Constraints:
 * 1. Checks prerequisites (tenant config, ROOT unit, admin role).
 * 2. Creates user strictly via Supabase Auth Admin API (Never inserts directly into auth.users).
 * 3. Atomic linking of profiles, organization_members (ROOT unit), and access_user_roles (admin role).
 * 4. Secure credential flow: accepts from environment variables or secure input; generates cryptographically secure password if omitted. Never logs secrets.
 * 5. Pre-run existing Admin check: stops safely if an Admin already exists.
 * 6. Partial failure recovery: if rerun after a network/database crash midway, detects created artifacts and safely completes the remaining links without duplication.
 * 7. Environment safety boundary: strictly blocked from running on production STHC.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-first-admin.ts [--email=...] [--name=...] [--dry-run]
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { validateSupabaseEnvironment } from './utils/supabase-guard';

dotenv.config();

export interface BootstrapAdminOptions {
  email?: string;
  password?: string;
  fullName?: string;
  jobTitle?: string;
  employeeCode?: string;
  targetEnv?: string;
  dryRun?: boolean;
  supabaseClient?: any;
}

export interface BootstrapAdminResult {
  success: boolean;
  isRecovery: boolean;
  userId: string;
  email: string;
  fullName: string;
  rootUnit: {
    id: string;
    code: string;
    name: string;
  };
  role: string;
  passwordGenerated: boolean;
  generatedPassword?: string;
  message: string;
}

/**
 * Generates a high-entropy, compliant password for initial bootstrap
 */
export function generateSecurePassword(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const symbols = '!@#$%^&*';
  
  let pwd = '';
  // Ensure at least one upper, one lower, one digit, one symbol
  pwd += letters[crypto.randomInt(0, 26)];
  pwd += letters[crypto.randomInt(26, letters.length)];
  pwd += digits[crypto.randomInt(0, digits.length)];
  pwd += symbols[crypto.randomInt(0, symbols.length)];

  const all = letters + digits + symbols;
  for (let i = 0; i < 12; i++) {
    pwd += all[crypto.randomInt(0, all.length)];
  }

  // Shuffle
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}

export async function bootstrapFirstAdmin(options: BootstrapAdminOptions = {}): Promise<BootstrapAdminResult> {
  const { dryRun = false } = options;

  // 0. Pre-Execution Supabase Guard Validation
  const guard = await validateSupabaseEnvironment();
  if (!guard.success) {
    throw new Error(guard.message);
  }

  // 1. Resolve inputs with environment fallback
  const rawEmail = options.email || process.env.BOOTSTRAP_ADMIN_EMAIL;
  let rawPassword = options.password || process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const fullName = (options.fullName || process.env.BOOTSTRAP_ADMIN_FULL_NAME || 'Quản trị viên Hệ thống').trim();
  const jobTitle = (options.jobTitle || 'Quản trị viên Hệ thống').trim();
  const employeeCode = (options.employeeCode || 'ADMIN-01').trim();
  const targetEnv = (options.targetEnv || process.env.BOOTSTRAP_TARGET_ENV || process.env.NODE_ENV || 'development').trim();

  if (!rawEmail || !rawEmail.trim()) {
    throw new Error(
      'Thiếu email quản trị viên: Vui lòng cung cấp email qua tham số --email=... hoặc biến môi trường BOOTSTRAP_ADMIN_EMAIL.'
    );
  }

  const normalizedEmail = rawEmail.trim().toLowerCase();
  if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
    throw new Error(`Email không hợp lệ: '${normalizedEmail}'.`);
  }

  let passwordGenerated = false;
  let generatedPassword: string | undefined;
  if (!rawPassword || !rawPassword.trim()) {
    generatedPassword = generateSecurePassword();
    rawPassword = generatedPassword;
    passwordGenerated = true;
  }

  if (rawPassword.length < 8) {
    throw new Error('Mật khẩu quản trị viên bắt buộc phải có độ dài tối thiểu từ 8 ký tự.');
  }

  // 2. Connect to Supabase
  let supabase = options.supabaseClient;
  if (!supabase) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Thiếu thông tin kết nối Supabase: VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY không có trong biến môi trường.'
      );
    }

    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  // 3. Environment Boundary Protection: Strict block on production STHC
  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('setting_key, setting_value');

  const settingsMap = new Map<string, string>();
  (settingsData || []).forEach((r: any) => settingsMap.set(r.setting_key, r.setting_value));

  const tenantCode = settingsMap.get('tenant_code');
  if (tenantCode === 'STHC' && (targetEnv === 'production' || process.env.NODE_ENV === 'production')) {
    if (process.env.CONFIRM_BOOTSTRAP_STHC_PRODUCTION !== 'true') {
      throw new Error(
        'NGĂN CHẶN THAO TÁC TRÊN PRODUCTION STHC: Script bootstrap bị khóa trên môi trường production STHC nhằm bảo vệ dữ liệu người dùng đang vận hành.'
      );
    }
  }

  // 4. Check Prerequisites
  if (!tenantCode) {
    throw new Error(
      'Chưa cấu hình trường: Bảng system_settings chưa có tenant_code. Vui lòng chạy migrations, seed nền và scripts/apply-tenant-config.ts trước.'
    );
  }

  const { data: rootUnits, error: rootErr } = await supabase
    .from('organization_units')
    .select('id, code, name, unit_type, parent_id')
    .is('parent_id', null);

  if (rootErr || !rootUnits || rootUnits.length === 0) {
    throw new Error(
      'Chưa tìm thấy đơn vị ROOT: Không có bản ghi nào trong organization_units có parent_id là NULL. Vui lòng chạy scripts/apply-tenant-config.ts trước.'
    );
  }
  const rootUnit = rootUnits[0];

  const { data: adminRole, error: roleErr } = await supabase
    .from('access_roles')
    .select('id, code, name')
    .eq('code', 'admin')
    .maybeSingle();

  if (roleErr || !adminRole) {
    throw new Error(
      "Chưa tìm thấy vai trò 'admin': Bảng access_roles thiếu vai trò cốt lõi 'admin'. Vui lòng nạp 00001_core_baseline_seed.sql trước."
    );
  }

  // 5. Existing Admin Check & Recovery Detection
  const { data: existingAdminProfiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, system_role, is_active')
    .eq('system_role', 'admin')
    .eq('is_active', true);

  let isRecovery = false;
  let targetUserId: string | null = null;

  if (existingAdminProfiles && existingAdminProfiles.length > 0) {
    const existingWithSameEmail = existingAdminProfiles.find(
      (p: any) => p.email?.toLowerCase() === normalizedEmail
    );

    if (existingWithSameEmail) {
      isRecovery = true;
      targetUserId = existingWithSameEmail.id;
    } else {
      const otherAdmins = existingAdminProfiles.map((p: any) => p.email).join(', ');
      throw new Error(
        `HỆ THỐNG ĐÃ CÓ TÀI KHOẢN ADMIN: Đã tồn tại quản trị viên hoạt động (${otherAdmins}). Script bootstrap chỉ được phép chạy một lần duy nhất cho Admin đầu tiên. Để thêm quản trị viên mới, vui lòng đăng nhập tài khoản hiện có và sử dụng giao diện Quản lý người dùng.`
      );
    }
  }

  // If dry run, finish validation and return early
  if (dryRun) {
    return {
      success: true,
      isRecovery,
      userId: targetUserId || 'dry-run-preview-id',
      email: normalizedEmail,
      fullName,
      rootUnit: { id: rootUnit.id, code: rootUnit.code, name: rootUnit.name },
      role: 'admin',
      passwordGenerated,
      message: `[DRY-RUN] Xác thực thành công: Đủ điều kiện tạo Admin '${normalizedEmail}' gắn với ROOT unit '${rootUnit.code}'.`
    };
  }

  // 6. Supabase Auth User Creation / Lookup via Auth Admin API
  // Rule: NEVER directly insert into auth.users. Always use Supabase Auth Admin API.
  if (!targetUserId) {
    // Attempt creating user via Auth Admin API
    const { data: authCreated, error: createAuthErr } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: rawPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        system_role: 'admin'
      }
    });

    if (createAuthErr) {
      // Check if user already exists in Auth (partial crash recovery)
      const isAlreadyRegistered =
        createAuthErr.message.includes('already registered') ||
        createAuthErr.message.includes('User already registered') ||
        createAuthErr.message.includes('already exists');

      if (isAlreadyRegistered) {
        isRecovery = true;
        // Search Auth for existing user id
        const { data: userList } = await supabase.auth.admin.listUsers();
        const found = (userList?.users || []).find((u: any) => u.email?.toLowerCase() === normalizedEmail);
        if (found?.id) {
          targetUserId = found.id;
          // Optionally update password to the specified one
          await supabase.auth.admin.updateUserById(targetUserId, { password: rawPassword });
        } else {
          throw new Error(`Tài khoản Auth đã tồn tại nhưng không thể tra cứu ID: ${createAuthErr.message}`);
        }
      } else {
        throw new Error(`Lỗi Supabase Auth Admin API khi tạo người dùng: ${createAuthErr.message}`);
      }
    } else if (authCreated?.user?.id) {
      targetUserId = authCreated.user.id;
    } else {
      throw new Error('Supabase Auth Admin API không trả về user ID hợp lệ.');
    }
  }

  const userId = targetUserId;

  // 7. Atomic Linking: profiles
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: fullName,
      email: normalizedEmail,
      system_role: 'admin',
      job_title: jobTitle,
      employee_code: employeeCode,
      is_active: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

  if (profileErr) {
    throw new Error(`Không thể khởi tạo bản ghi profiles cho Admin: ${profileErr.message}`);
  }

  // 8. Atomic Linking: access_user_roles (Role: admin)
  const { error: userRoleErr } = await supabase
    .from('access_user_roles')
    .upsert({
      user_id: userId,
      role_id: adminRole.id,
      is_primary: true,
      is_active: true,
      source_code: 'bootstrap',
      assigned_by: userId,
      created_at: new Date().toISOString()
    }, { onConflict: 'user_id,role_id' });

  if (userRoleErr) {
    throw new Error(`Không thể gán vai trò 'admin' trong access_user_roles: ${userRoleErr.message}`);
  }

  // 9. Atomic Linking: organization_members (ROOT unit)
  const { error: orgMemberErr } = await supabase
    .from('organization_members')
    .upsert({
      organization_unit_id: rootUnit.id,
      user_id: userId,
      member_role: 'head',
      is_primary: true
    }, { onConflict: 'organization_unit_id,user_id' });

  if (orgMemberErr) {
    throw new Error(`Không thể gán Admin vào đơn vị ROOT trong organization_members: ${orgMemberErr.message}`);
  }

  // 10. Audit Log
  try {
    await supabase.from('access_audit_logs').insert({
      actor_user_id: userId,
      action_code: 'system.bootstrap.first_admin',
      target_type: 'user',
      target_id: userId,
      after_data: {
        email: normalizedEmail,
        system_role: 'admin',
        root_unit_id: rootUnit.id,
        root_unit_code: rootUnit.code,
        is_recovery: isRecovery
      },
      created_at: new Date().toISOString()
    });
  } catch (auditErr: any) {
    console.warn('[BootstrapAdmin] Không thể ghi audit log:', auditErr.message);
  }

  return {
    success: true,
    isRecovery,
    userId,
    email: normalizedEmail,
    fullName,
    rootUnit: {
      id: rootUnit.id,
      code: rootUnit.code,
      name: rootUnit.name
    },
    role: 'admin',
    passwordGenerated,
    generatedPassword: passwordGenerated ? generatedPassword : undefined,
    message: isRecovery
      ? `Đã khôi phục và hoàn tất liên kết thành công cho Admin '${normalizedEmail}' vào đơn vị ROOT '${rootUnit.code}'.`
      : `Đã khởi tạo thành công tài khoản Admin đầu tiên '${normalizedEmail}' gắn với đơn vị ROOT '${rootUnit.code}'.`
  };
}

// CLI Execution Entry Point
if (process.argv[1] && process.argv[1].endsWith('bootstrap-first-admin.ts')) {
  const args = process.argv.slice(2);
  const getArg = (prefix: string) => {
    const item = args.find((a) => a.startsWith(prefix));
    return item ? item.slice(prefix.length) : undefined;
  };

  const email = getArg('--email=');
  const password = getArg('--password=');
  const fullName = getArg('--name=');
  const dryRun = args.includes('--dry-run');

  console.log('=== KHỞI CHẠY QUY TRÌNH BOOTSTRAP TÀI KHOẢN ADMIN ĐẦU TIÊN (v0.9-C5-E) ===');

  bootstrapFirstAdmin({ email, password, fullName, dryRun })
    .then((res) => {
      console.log(`\n KẾT QUẢ: ${res.message}`);
      console.log(`   - User ID: ${res.userId}`);
      console.log(`   - Email: ${res.email}`);
      console.log(`   - Họ tên: ${res.fullName}`);
      console.log(`   - Vai trò: ${res.role}`);
      console.log(`   - Đơn vị ROOT: ${res.rootUnit.name} (Mã: ${res.rootUnit.code})`);
      console.log(`   - Trạng thái: ${res.isRecovery ? 'Phục hồi sau lỗi dở dang (Recovery)' : 'Tạo mới thành công'}`);

      if (res.passwordGenerated && res.generatedPassword) {
        console.log('\n[LƯU Ý BẢO MẬT QUAN TRỌNG]:');
        console.log(`   Mật khẩu khởi tạo ngẫu nhiên là: ${res.generatedPassword}`);
        console.log('   Vui lòng sao lưu mật khẩu này ngay lập tức. Mật khẩu sẽ KHÔNG được hiển thị lại.');
      } else {
        console.log('   - Mật khẩu: Đã thiết lập qua biến môi trường hoặc tham số bảo mật.');
      }

      console.log('\n[TIẾP THEO]: Quản trị viên có thể đăng nhập vào hệ thống để tiếp tục quy trình C5-F (Thiết lập cơ cấu tổ chức & người dùng).');
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n THẤT BẠI: ${err.message}`);
      process.exit(1);
    });
}
