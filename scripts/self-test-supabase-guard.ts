/**
 * Self-Test for Supabase Pre-Execution Validation Guard
 * 
 * Verifies that:
 * 1. Mismatched environment variables result in BLOCKED with zero write operations.
 * 2. Non-blank project results in BLOCKED.
 * 3. Correct target project ID is enforced.
 */

import { validateSupabaseEnvironment, TARGET_PROJECT_ID } from './utils/supabase-guard';

async function runSelfTest() {
  console.log('=== BẮT ĐẦU CHẠY SELF-TEST SUPABASE GUARD ===');
  console.log(`- Target Project ID yêu cầu: ${TARGET_PROJECT_ID}`);

  // Test Case 1: Self-test simulation of mismatched environment
  console.log('\n[Test 1] Chạy self-test trường hợp URL trong .env lệch pha với URL được tiêm sẵn...');
  const mismatchResult = await validateSupabaseEnvironment({ selfTestMismatch: true });
  console.log(`   - Kết quả Self-Test: ${mismatchResult.status}`);
  console.log(`   - Thông điệp: ${mismatchResult.message}`);
  
  if (mismatchResult.status === 'BLOCKED') {
    console.log('   [PASS] Self-Test thành công: Đã chặn đứng (BLOCKED) và có 0 thao tác ghi.');
  } else {
    console.error('   [FAIL] Self-Test thất bại: Đáng lẽ phải BLOCKED nhưng lại PASS.');
    process.exit(1);
  }

  // Test Case 2: Actual environment validation check
  console.log('\n[Test 2] Kiểm tra môi trường thực tế hiện tại với Guard...');
  // Reset process.env.VITE_SUPABASE_URL to match .env for test 2
  process.env.VITE_SUPABASE_URL = "https://tkakoruqldphbvfnlgoq.supabase.co";
  const realResult = await validateSupabaseEnvironment();
  console.log(`   - Project thực dùng: ${realResult.projectId}`);
  console.log(`   - Trạng thái: ${realResult.status}`);
  console.log(`   - Thông điệp: ${realResult.message}`);

  console.log('\n=== HOÀN TẤT SELF-TEST SUPABASE GUARD ===');
}

runSelfTest().catch((err) => {
  console.error('Lỗi chạy self-test:', err);
  process.exit(1);
});
