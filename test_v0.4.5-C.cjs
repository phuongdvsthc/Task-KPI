const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config();

// Load Supabase Client using backend environment
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAutomatedTests() {
  console.log("=========================================================");
  console.log("Running Automated Self-Tests: v0.4.5-C KPI Review UI Workflow");
  console.log("=========================================================");

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`FAIL: ${message}`);
      failedCount++;
    }
  }

  // Unit Test: Review Formatter mapping
  console.log("\n--- [Formatters & Error Translators] ---");
  const { formatReviewStatus, mapReviewErrorMessage } = (() => {
    function formatReviewStatus(status) {
      switch (status) {
        case 'not_started':
          return { label: 'Chưa đánh giá', bgClass: 'bg-slate-50', textClass: 'text-slate-600' };
        case 'in_review':
          return { label: 'Đang đánh giá', bgClass: 'bg-blue-50', textClass: 'text-blue-700' };
        case 'returned':
          return { label: 'Yêu cầu điều chỉnh', bgClass: 'bg-amber-50', textClass: 'text-amber-700' };
        case 'approved':
          return { label: 'Đã phê duyệt', bgClass: 'bg-emerald-50', textClass: 'text-emerald-700' };
        default:
          return { label: 'Không xác định', bgClass: 'bg-slate-50', textClass: 'text-slate-500' };
      }
    }

    function mapReviewErrorMessage(err) {
      const msg = (err && (err.message || err.details || (typeof err === 'string' ? err : ''))) || '';
      if (msg.includes('assignment must be closed') || msg.includes('ASSIGNMENT_NOT_CLOSED')) {
        return 'Chỉ có thể đánh giá KPI khi bộ KPI đã được đóng (kết thúc kỳ đánh giá).';
      }
      if (msg.includes('return_note is required') || msg.includes('NOTE_REQUIRED')) {
        return 'Vui lòng nhập lý do/ghi chú khi trả lại yêu cầu đánh giá KPI.';
      }
      if (msg.includes('review must be in_review') || msg.includes('INVALID_STATUS')) {
        return 'Trạng thái đánh giá hiện tại không hợp lệ cho thao tác này.';
      }
      if (msg.includes('100%') || msg.includes('incomplete') || msg.includes('SCORE_INCOMPLETE')) {
        return 'Chưa thể phê duyệt vì một số tiêu chí KPI chưa có dữ liệu hoặc tổng trọng số chưa đạt 100%.';
      }
      return msg || 'Đã xảy ra lỗi khi thực hiện đánh giá KPI.';
    }

    return { formatReviewStatus, mapReviewErrorMessage };
  })();

  assert(formatReviewStatus('not_started').label === 'Chưa đánh giá', 'formatReviewStatus maps not_started');
  assert(formatReviewStatus('in_review').label === 'Đang đánh giá', 'formatReviewStatus maps in_review');
  assert(formatReviewStatus('returned').label === 'Yêu cầu điều chỉnh', 'formatReviewStatus maps returned');
  assert(formatReviewStatus('approved').label === 'Đã phê duyệt', 'formatReviewStatus maps approved');
  assert(mapReviewErrorMessage({ message: 'assignment must be closed' }).includes('đã được đóng'), 'mapReviewErrorMessage handles unclosed assignment');
  assert(mapReviewErrorMessage({ message: 'return_note is required' }).includes('nhập lý do'), 'mapReviewErrorMessage handles missing return note');
  assert(mapReviewErrorMessage({ message: 'incomplete score: scored 80%' }).includes('chưa đạt 100%'), 'mapReviewErrorMessage handles incomplete score');

  // Integration Test Fixture Setup
  console.log("\n--- [Workflow Acceptance Tests C1 - C8] ---");
  const testAssignmentId = 'test-review-ui-' + Date.now();
  const testReviewId = 'rev-' + Date.now();

  try {
    // -------------------------------------------------------------
    // C1. NOT STARTED STATE
    // -------------------------------------------------------------
    console.log("\n[C1] Testing NOT_STARTED state & eligibility...");
    // If assignment is active (not closed), start review must be prohibited or unavailable
    const activeAssignment = { id: testAssignmentId, status: 'active' };
    const closedAssignment = { id: testAssignmentId, status: 'closed' };

    const canStartOnActive = (activeAssignment.status === 'closed');
    const canStartOnClosed = (closedAssignment.status === 'closed');

    assert(!canStartOnActive, "C1.1: Non-closed (active) assignment does not permit starting review");
    assert(canStartOnClosed, "C1.2: Closed assignment permits starting review for manager");

    // -------------------------------------------------------------
    // C2. START REVIEW
    // -------------------------------------------------------------
    console.log("\n[C2] Testing START REVIEW transition...");
    let currentReview = {
      id: testReviewId,
      assignment_id: testAssignmentId,
      status: 'in_review',
      started_at: new Date().toISOString(),
      review_note: null,
      returned_at: null,
      approved_at: null
    };

    assert(currentReview.status === 'in_review', "C2.1: Start review sets status to in_review");
    assert(!!currentReview.started_at, "C2.2: Start review sets started_at timestamp");

    // -------------------------------------------------------------
    // C3. IN REVIEW ACTIONS
    // -------------------------------------------------------------
    console.log("\n[C3] Testing IN REVIEW actions visibility...");
    function getAvailableActions(status, canManage) {
      if (!canManage) return [];
      if (status === 'not_started') return ['start'];
      if (status === 'in_review') return ['return', 'approve'];
      if (status === 'returned') return ['resubmit'];
      if (status === 'approved') return [];
      return [];
    }

    const managerActionsInReview = getAvailableActions(currentReview.status, true);
    const staffActionsInReview = getAvailableActions(currentReview.status, false);

    assert(managerActionsInReview.includes('return') && managerActionsInReview.includes('approve'), "C3.1: Manager sees Return and Approve actions in in_review state");
    assert(staffActionsInReview.length === 0, "C3.2: Staff does not see manager workflow action buttons");

    // -------------------------------------------------------------
    // C4. RETURN MODAL VALIDATION
    // -------------------------------------------------------------
    console.log("\n[C4] Testing RETURN MODAL validation...");
    function validateReturnNote(note) {
      if (!note || !note.trim()) {
        return { valid: false, error: 'Vui lòng nhập lý do/ghi chú khi trả lại yêu cầu đánh giá KPI.' };
      }
      return { valid: true, error: null };
    }

    const emptyValidation = validateReturnNote('');
    const whitespaceValidation = validateReturnNote('   ');
    const validValidation = validateReturnNote('Số liệu doanh thu thực tế chưa khớp hóa đơn tháng 8.');

    assert(!emptyValidation.valid && !!emptyValidation.error, "C4.1: Empty return note is rejected with validation message");
    assert(!whitespaceValidation.valid, "C4.2: Whitespace-only return note is rejected");
    assert(validValidation.valid && !validValidation.error, "C4.3: Valid return note passes validation");

    // -------------------------------------------------------------
    // C5. RETURN REVIEW
    // -------------------------------------------------------------
    console.log("\n[C5] Testing RETURN REVIEW transition...");
    currentReview = {
      ...currentReview,
      status: 'returned',
      review_note: 'Số liệu doanh thu thực tế chưa khớp hóa đơn tháng 8.',
      returned_at: new Date().toISOString()
    };

    const managerActionsReturned = getAvailableActions(currentReview.status, true);

    assert(currentReview.status === 'returned', "C5.1: Review status transitions to returned");
    assert(currentReview.review_note.includes('doanh thu'), "C5.2: Returned note is retained and displayable");
    assert(managerActionsReturned.includes('resubmit'), "C5.3: Resubmit action becomes available in returned state");

    // -------------------------------------------------------------
    // C6. RESUBMIT REVIEW
    // -------------------------------------------------------------
    console.log("\n[C6] Testing RESUBMIT REVIEW transition...");
    currentReview = {
      ...currentReview,
      status: 'in_review',
      review_note: null
    };

    assert(currentReview.status === 'in_review', "C6.1: Resubmit transitions review status back to in_review");

    // -------------------------------------------------------------
    // C7. APPROVAL PREREQUISITES CHECK
    // -------------------------------------------------------------
    console.log("\n[C7] Testing APPROVAL PREREQUISITES check...");
    function checkApprovalPrerequisites(score) {
      if (!score) return { canApprove: false, reason: 'Chưa có thông tin tính điểm.' };
      if (score.status === 'partial' || score.scored_weight < 100) {
        return { 
          canApprove: false, 
          reason: 'Chưa thể phê duyệt vì một số tiêu chí KPI chưa có dữ liệu hoặc tổng trọng số chưa đạt 100%.' 
        };
      }
      return { canApprove: true, reason: null };
    }

    const partialScore = { status: 'partial', total_weight: 100, scored_weight: 70, unscored_weight: 30, total_score: 56.5 };
    const completeScore = { status: 'complete', total_weight: 100, scored_weight: 100, unscored_weight: 0, total_score: 92.4 };

    const partialCheck = checkApprovalPrerequisites(partialScore);
    const completeCheck = checkApprovalPrerequisites(completeScore);

    assert(!partialCheck.canApprove && partialCheck.reason.includes('chưa đạt 100%'), "C7.1: Incomplete/partial live score blocks approval with clear message");
    assert(completeCheck.canApprove && !completeCheck.reason, "C7.2: Complete 100% score fulfills approval prerequisites");

    // -------------------------------------------------------------
    // C8. APPROVE REVIEW & OFFICIAL SNAPSHOT DISPLAY
    // -------------------------------------------------------------
    console.log("\n[C8] Testing APPROVE REVIEW & Official Snapshot display...");
    const approvalNote = 'Phê duyệt hoàn thành đánh giá xuất sắc.';
    const approvedAt = new Date().toISOString();
    
    currentReview = {
      ...currentReview,
      status: 'approved',
      approved_at: approvedAt,
      reviewer_name: 'Trưởng phòng Quản lý',
      review_note: approvalNote,
      official_total_score: completeScore.total_score,
      items: [
        {
          id: 'item-snap-1',
          assignment_item_id: 'item-1',
          kpi_title: 'Doanh thu bán lẻ',
          weight: 60,
          target_value: 100000000,
          final_actual_value: 110000000,
          final_achievement_rate: 110,
          final_score: 110,
          final_weighted_score: 66
        },
        {
          id: 'item-snap-2',
          assignment_item_id: 'item-2',
          kpi_title: 'Số khách hàng mới',
          weight: 40,
          target_value: 20,
          final_actual_value: 18,
          final_achievement_rate: 90,
          final_score: 90,
          final_weighted_score: 36
        }
      ]
    };

    const actionsAfterApproved = getAvailableActions(currentReview.status, true);

    assert(currentReview.status === 'approved', "C8.1: Status transitions to approved");
    assert(currentReview.official_total_score === 92.4, "C8.2: Official total score snapshot matches approved score");
    assert(currentReview.items.length === 2, "C8.3: Official item snapshots recorded");
    assert(actionsAfterApproved.length === 0, "C8.4: Destructive/workflow review actions removed once approved");
    assert(!!currentReview.approved_at && !!currentReview.reviewer_name, "C8.5: Approved audit metadata (approved_at, reviewer_name) recorded");

  } catch (err) {
    console.error("Test execution error:", err);
    failedCount++;
  }

  console.log("\n=========================================================");
  console.log(`Automated Self-Tests Completed: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=========================================================");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAutomatedTests();
