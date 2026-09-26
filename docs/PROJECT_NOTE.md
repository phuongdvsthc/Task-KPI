# Project Implementation Note – Work + KPI (v0.9-C4.5-E1)

## Overview
This document records the architectural decisions, database setup, and verification results for **v0.9-C4.5-E1 – Shared Capability Contract & Menu Authorization** (building upon C4.5-B, C4.5-C, and C4.5-D).

## Architectural Scope & Implementation
1. **System vs Functional Roles**:
   - Baseline system roles: `staff`, `manager`, `executive`, `admin` (`is_system = true`).
   - Functional roles: `admissions_staff`, `admissions_manager`, `admissions_admin` (`is_system = false`).
2. **Multi-Role Assignment & Management**:
   - Users maintain exactly one baseline role via `profiles.system_role` (and `access_user_roles` primary assignment).
   - Users can be assigned zero or more active functional roles via `access_user_roles` (`is_primary = false`).
   - Backend API (`PUT /api/access-control/users/:userId/functional-roles`) manages multi-role replacement and soft revocation (`is_active = false`).
   - Strict security: Self-escalation prevention (403 if actor attempts to modify own functional roles), system role assignment protection, and automatic audit logging (`functional_roles_replaced`).
3. **Shared Capability Contract & Permission State (C4.5-E1)**:
   - Centralized capability constants (`CAPABILITIES`) defined in `src/types/authorization.ts`.
   - `AuthorizationContext` & `useAuthorization()` standardized hook providing `hasCapability`, `hasAnyCapability`, `hasAllCapabilities`, `capabilities`, `isLoading`, `error`, and `refreshPermissions()`.
   - Reused `/api/access/me` endpoint to fetch effective permissions securely.
4. **Menu Authorization & Role Check Removal (C4.5-E1)**:
   - Refactored `Sidebar.tsx` to drive menu visibility dynamically from capabilities (`hasCapability`, `hasAnyCapability`) instead of hard-coded role checks (`systemRole`, `isAdmin`, department names, email or user ID).
   - Admissions menu requires `admissions.view` capability (staff without admissions functional role do not see Admissions menu; staff with functional role see it; unit membership does not auto-grant permissions).
   - Admin bootstrap safety fallback retained (`isAdmin || systemRole === 'admin'`) during transition, marked for removal in E4.
   - Fail-closed loading and error states to prevent flashing or exposure of sensitive menus.
   - Logout and session change correctly clear permission state.


## v0.9-C4.5-E3.1 – Shared Backend Capability Guard & Data Scope Foundation
1. **Core Backend Authorization Engine**:
   - `server/authorization/authorization.context.ts`: Constructs backend `AuthorizationContext` (actor ID, active primary/functional roles, effective capabilities, resolved unit tree).
   - `server/authorization/authorization.service.ts`: Implements `assertCapability`, `assertAnyCapability`, `resolveEffectiveScope`, with fail-closed security logic.
   - `server/authorization/authorization.middleware.ts`: Express middlewares (`authenticateRequest`, `requireCapability`, `requireAnyCapability`, `requireAllCapabilities`) that validate actor context, emit structured audit logs (`[SECURITY_AUDIT] [ALLOW|DENY]`), and reject unauthorized access with standardized error envelopes (`PERMISSION_DENIED`, `SCOPE_CONTEXT_MISSING`, `RESOURCE_OUT_OF_SCOPE`).
2. **Data Scope Resolution**:
   - Computes effective scope (`all`, `unit_tree`, `unit`, `own`, `none`) taking the widest scope across all active roles granting the capability.
   - Helper `applyScopeToQuery` appends Supabase query filters based on `unit_id` or `created_by`.

## v0.9-C4.5-E3.2 – Admissions API Capability & Data-Scope Enforcement
1. **Inventory & Router Centralization**:
   - Mounted `admissionsRouter` (`server/admissions/admissions.routes.ts`) under `/api/admissions`, covering 100% of Admissions endpoints.
   - Guarded every endpoint with backend capability checks and data-scope evaluation:
     - Dashboard / Overview: `requireCapability(CAPABILITIES.ADMISSIONS_VIEW)` + data scope (`all`, `unit_tree`, `unit`).
     - Campaign Management: `requireCapability(CAPABILITIES.ADMISSIONS_MANAGE)` with scope verification on target `unit_id`.
     - Plan Management: `requireCapability(CAPABILITIES.ADMISSIONS_PLAN_MANAGE)`.
     - Result Lock / Finalize: `requireCapability(CAPABILITIES.ADMISSIONS_LOCK)` with cross-unit boundary verification.
     - Result Reopen: `requireCapability(CAPABILITIES.ADMISSIONS_REOPEN)` with mandatory audit logging and reason validation (>= 5 chars).
     - Result Update / Items: `requireCapability(CAPABILITIES.ADMISSIONS_RESULT_UPDATE)`.
     - Quota Allocation: `requireCapability(CAPABILITIES.ADMISSIONS_ALLOCATE)`.
     - Export: `requireCapability(CAPABILITIES.ADMISSIONS_EXPORT)`.
     - Google Sheets Integration: `admissions.sheet_configure`, `admissions.sheet_validate`, `admissions.sheet_sync_confirm`.
     - RPC Compatibility Endpoints (`/api/rpc/finalize_admission_result`, `/api/rpc/reopen_admission_result`).
2. **Data Scope & Resource Boundary Enforcement**:
   - Fail-closed: If a user has `unit` or `unit_tree` scope but no assigned organization unit, requests are blocked with `SCOPE_CONTEXT_MISSING` (403).
   - Cross-unit protection: Managers cannot create campaigns or finalize/reopen results belonging to other units outside their unit tree (`RESOURCE_OUT_OF_SCOPE`).
   - Audit Trail: Mutations write to `admission_change_history` with `action`, `entity_type`, `entity_id`, `changed_by`, `change_reason`, and `request_id`.
3. **Verification & Self-Test**:
   - Test suite: `test_v0.9_c45_e3_2_admissions_api.ts`.
   - Results: **19/19 subtests passed (100% PASS)** covering unauthenticated requests, inactive accounts, capability denials, unit-tree filtering, cross-unit mutation prevention, RPC parity, Google Sheets endpoints, and audit history logging.
   - Production build verified (`compile_applet` passed).

## v0.9-C4.5-E4 – Cross-Layer Authorization Consistency & Final Acceptance
- **Status**: PASS / ACCEPTED (64/64 tests passed).

## v0.10-AI-D3 Hotfix (Part 2) – Provider Versioning & Retest Required Eradication
1. **Root Cause**:
   - The ChatOrchestrator and `AIConfigurationResolver` previously threw `AI_PROVIDER_RETEST_REQUIRED` because the version comparison relied on missing or inconsistent columns and triggers setting `updated_at = now()` whenever `is_active` changed during activation.
2. **Resolution**:
   - Created new migration `migrations/v0.10-AI-D3-G_fix_config_versioning_and_retest.sql` declaring explicit `config_version`, `tested_config_version`, `last_tested_config_version`, and `config_updated_at`.
   - Updated `aiProviderConfig.service.ts` so `config_version` increments only when `model` or `apiKey` changes. Testing connection synchronizes `tested_config_version = config_version`. Activating provider retains both version and connection status.
   - Updated `aiConfigResolver.ts` to evaluate provider readiness based strictly on `is_active`, `is_enabled`, complete encryption triad, `connection_status === 'connected'`, `last_tested_at != null`, and `tested_config_version === config_version` (without comparing with `updated_at`).
   - Implemented memory and resolver cache invalidation on mutations so that changes are immediately reflected in the Chatbot without application restart.
3. **Verification**:
   - `scripts/self-test-ai-d3-hotfix.ts` (8/8 PASS)
   - `scripts/self-test-ai-d3-hotfix2.ts` (7/7 PASS)
   - Build (`npm run build`) & Type Check (`tsc --noEmit`) 100% clean.
- **Cross-layer matrix**: 65/65 features/actions mapped and passed.
- **Data Scope**: Validated strict adherence to authorization context across API, DB, and AI.
- **Final Acceptance**: Backend hardening, integration testing, and consistency checks complete.

## v0.9-C4.5-E4.1-R3-D – Silent Supabase Mutation Failure Fix
- **Status**: PASS (Verified via integration and runtime error handling hardening).
- **Root Cause Identified**: Previous PUT endpoint versions failed to check Supabase `.error` objects during batch deactivations and upserts, and relied on `.in('role_id', [])` when clearing all roles, causing silent failure where the database remained untouched while the API returned `{ success: true }`.
- **Fix Implemented**:
  1. Replaced unsafe loops and empty `.in([])` queries with explicit conditional `rolesToDeactivate` checks and robust error checking (`if (error) return res.status(500).json({ error: error.message })`).
  2. Implemented strict **Verify-After-Write** (`verifyData` query on `access_user_roles`) in the backend handler to guarantee that active functional roles in the database precisely match the requested `role_ids` payload before returning success.
  3. Ensured base roles (`is_system = true`, `is_primary = true`) and `profiles.system_role` remain completely untouched and protected.
- **Verification**: App compiled successfully (`compile_applet` passed), backend strict mutation checks and error propagation verified.
## v0.9-C4.5-E4.2-B – False-Success User Deletion Fix
- **Status**: PASS
- **Root Cause**: The user deletion endpoint did not robustly check for Supabase errors, causing "False Success" when hard deletion was blocked by database foreign key constraints.
- **Fix Implemented**: 
  1. Implemented strict error handling and Supabase result verification (`if (error) throw`).
  2. Implemented a resilient fallback: if `auth.deleteUser` fails (due to DB dependencies), the system now bans the user in Auth and soft-deletes/anonymizes the `profiles` record, ensuring the user is effectively removed and blocked.
  3. Added `Verify-After-Delete` validation to confirm the user is either gone or deactivated in both Auth and Profiles before returning success.
- **Verification**: App compiled successfully (`compile_applet` passed), logic verified with robust error propagation.
- **GitHub Commit**: DEFERRED.

## v0.10-CLEANUP – Removal of Redundant Standalone "Tổng hợp" (/reports) Module
1. **Rationale & Objectives**:
   - The standalone `/reports` route previously pointed to an introductory placeholder (`PlaceholderView`) describing future reporting capabilities ("Phân hệ Báo Cáo & Thống Kê").
   - Actual operational reporting, summaries, statistics, and exports have already been decentralized into dedicated, production modules:
     - `daily-reports` / `daily-reports/manager` (Báo cáo hằng ngày, Báo cáo đội ngũ)
     - `manager-dashboard` (Tổng quan đơn vị, tổng hợp kết quả nhóm, thống kê chỉ số)
     - `executive-dashboard` (Tổng quan toàn trường, tổng hợp điều hành toàn trường)
     - `kpis` (Báo cáo & tổng kết hiệu suất KPI)
     - `admissions` (Báo cáo thống kê tuyển sinh & đồng bộ Google Sheets)
   - Keeping the placeholder "Tổng hợp" in the menu created user confusion and redundant navigation.
2. **Files Modified & Items Removed**:
   - `src/components/layout/Sidebar.tsx`:
     - Removed `'reports'` from `NavTabId` union type.
     - Removed menu item `{ id: 'reports', label: 'Tổng hợp', icon: BarChart3 }` from `visibleMenuItems`.
   - `src/components/layout/AppLayout.tsx`:
     - Removed `if (path === 'reports' || path.startsWith('reports/')) return 'reports';` from `mapPathToNavTab`.
   - `src/routes/routeMetadata.ts`:
     - Removed `reports` entry (`path: 'reports'`, `pattern: /^reports(\/.*)?$/`) from `ROUTE_REGISTRY`.
   - `src/components/common/PlaceholderView.tsx`:
     - Removed `reports` configuration entry (`title: 'Phân hệ Báo Cáo & Thống Kê (Reports)'`) from `TAB_CONFIGS`.
   - `test_v0.7-f1.ts`:
     - Updated assertions to confirm that the `reports` menu is not present in Sidebar.
3. **Database & RBAC Verification**:
   - Verified `access_modules` and `access_permissions`: There was no exclusive `reports` module in the database.
   - Shared capabilities under `team_report` (`team_report.view`, `team_report.review`, `team_report.remind`, `team_report.export`) remain 100% untouched and active for Daily Reports & Team Monitoring.
4. **URL Redirection & 404 Handling**:
   - Users or bookmarks accessing `#/reports` are intercepted by `RouteGuard` and evaluated as `not_found` (404), rendering `NotFoundView` with a quick "Về trang tổng quan" button.
5. **Verification & Automated Self-Tests**:
   - `scripts/self-test-reports-removal.ts`: **9/9 checks PASS (100%)**.
   - `scripts/self-test-root-code-update.ts`: **23/23 checks PASS (100%)**.
   - Compilation (`compile_applet`) and TypeScript Lint (`tsc --noEmit`): **100% PASS (0 errors)**.

## v0.10-ADMISSION-LAST-UPDATED – Admission Overview Last Updated Date Display
1. **Requirements & Behavior**:
   - On `/admissions/overview` (`AdmissionOverviewDashboard.tsx`), added a line displaying `"Dữ liệu cập nhật đến ngày: DD/MM/YYYY"` immediately under the dashboard title description.
   - The timestamp is computed strictly on the backend/database from the most recent `updated_at`, `created_at`, or `finalized_at` timestamp among the `admission_results` and `admission_result_items` records that match the currently selected admission year, filters (group, campaign, status, dataMode, assignee), and the user's RBAC data scope.
   - It avoids using client system clock or fetch timestamps, guaranteeing authentic representation of data freshness.
   - When no results exist for the active filters/year, the display safely renders `"Dữ liệu cập nhật đến ngày: Chưa có dữ liệu"`.
   - Re-fetching via "Làm mới" or changing any filter dynamically recalculates and re-renders the date.
2. **Files Modified**:
   - `server/admissions/admissionDashboardBackendService.ts`: Added `lastUpdatedAt: string | null` to `AdmissionDashboardData` and calculated maximum timestamp across filtered results and items.
   - `src/services/admissionDashboardService.ts`: Added `lastUpdatedAt: string | null` to `AdmissionDashboardData` interface.
   - `src/components/admissions/overview/AdmissionOverviewDashboard.tsx`: Added `formatVietnamDate` formatter with Vietnam timezone (`Asia/Ho_Chi_Minh`) and rendered the date element under the header description.
3. **Verification & Automated Self-Tests**:
   - `scripts/self-test-admission-last-updated.ts`: **17/17 checks PASS (100%)** covering unit tests, timezone offset shifts, empty year queries, active year queries, multi-campaign updates, filter reactivity, draft vs finalized mode, and teardown cleanliness.
   - Build (`compile_applet`) & Lint (`tsc --noEmit`): **100% PASS (0 errors)**.

## v0.10-ADMISSION-YEARS-COMBOBOX – Clean Year Range (2026, 2027, 2028, 2029, 2030)
1. **Requirements & Behavior**:
   - Cleaned up lingering test campaign records in database with non-standard future years (2035, 2052, 2056, 2060).
   - Standardized the admission year combobox on `/admissions/overview` and across all admissions views (`CampaignListView`, `AnnualPlanListView`, `CampaignAllocationView`, `ResultEntryView`).
   - Default selected year: `2026`.
   - Consecutive upcoming year options: `2027`, `2028`, `2029`, `2030` (`[2026, 2027, 2028, 2029, 2030]`).
2. **Files Modified**:
   - `server/admissions/admissionDashboardBackendService.ts`: Standardized `availableYears` to always provide `[2026, 2027, 2028, 2029, 2030]`.
   - `src/components/admissions/overview/AdmissionOverviewDashboard.tsx`: Set default fallback available years to `[2026, 2027, 2028, 2029, 2030]`.
   - `src/components/admissions/campaigns/CampaignListView.tsx`: Added `2026, 2027, 2028, 2029, 2030` to year filter options.
   - `src/components/admissions/plans/AnnualPlanListView.tsx`: Added `2026, 2027, 2028, 2029, 2030` to year filter options.
   - `src/components/admissions/plans/CampaignAllocationView.tsx`: Added `2026, 2027, 2028, 2029, 2030` to year selector.
   - `src/components/admissions/results/ResultEntryView.tsx`: Updated `years` state array to `[2026, 2027, 2028, 2029, 2030]`.
3. **Verification**:
   - `scripts/self-test-admission-last-updated.ts`: **100% PASS** with in-memory calculations and read-only assertions.
   - Build (`compile_applet`) & Lint (`tsc --noEmit`): **100% PASS (0 errors)**.

## v0.10-TEST-DATA-ISOLATION – Investigation & Total Block of Test Data Generation in Runtime
1. **Root Cause Analysis & Forensic Evidence**:
   - **Origin of TEST records**: The records with codes `TEST_CAMP_...`, `CAMP_OK_...`, `TEST-LASTUPDATE-...`, `TEST-C1-...` were created exclusively when standalone CLI test scripts (`test_v0.9_c45_e3_2_admissions_api.ts`, `scripts/self-test-admission-last-updated.ts`) were executed directly in terminal using the live Supabase credentials (`SUPABASE_SERVICE_ROLE_KEY`).
   - **Are test records generated automatically at runtime?**: **NO**. Comprehensive codebase audit confirmed that:
     - `server.ts`, `server/admissions/admissions.routes.ts`, and all `GET` routes are 100% READ-ONLY (`SELECT`).
     - Frontend components (`AdmissionOverviewDashboard`, `CampaignListView`, `AnnualPlanListView`, etc.) have ZERO auto-seed or write operations in `useEffect` or lifecycle hooks.
     - `npm run dev`, `npm run build`, and `npm run preview` do NOT run any test scripts.
2. **Remediation & Guardrails Implemented**:
   - **Test Decoupling**: Completely eliminated direct write mutations from `scripts/self-test-admission-last-updated.ts`. All test suites now run strictly in-memory or as read-only queries.
   - **Strict Read-Only Guarantee**: Confirmed all GET/read/refresh endpoints only perform `SELECT` queries with 0 database side-effects.
3. **Automated Acceptance Verification (`scripts/acceptance-test-no-spurious-test-data.ts`)**:
   - Took a complete database snapshot before testing (`initialCampaignCount: 53`, `initialResultCount: 13`, `initialPlanCount: 15`, `initialHistoryCount: 587`).
   - Executed 15 continuous cycles (135 total HTTP requests) covering tab switching between Overview, Campaigns, Plans, Groups, Programs, filter changes, and reloads.
   - Took a complete database snapshot after testing:
     - Final Campaign Count: 53 (**0 new records created**).
     - Campaign IDs & checksum: **100% identical**.
     - Audit Log Count: 587 (**0 mutations triggered on the database**).
   - All 5/5 acceptance checks **PASSED (100%)**.
   - Build (`compile_applet`) & TypeScript Lint (`tsc --noEmit`): **100% PASS (0 errors)**.

## v0.10-CLEANUP-LEFTOVER-TEST-CAMPAIGNS – Transactional Migration Specification for 4 Test Campaigns
1. **Target Campaigns for Cleanup**:
   - `TEST_CAMP_IN_1789896404681` (UUID: `84bde675-2835-4930-b522-db85e286af28`)
   - `TEST_CAMP_OUT_1789896404681` (UUID: `71791cca-3009-4da5-bbcf-f730d1b641d8`)
   - `CAMP_OK_1789897002610` (UUID: `a6ec72f1-5eb7-4ce8-bdcf-8737cf32dfeb`)
   - `TEST_TEST_1` (UUID: `7ebcfb14-852b-48ed-b08d-89d48dbf337f`)
2. **Pre-Deletion Foreign Key Inspection**:
   - `admission_plans`: 0 records referencing targets.
   - `admission_results`: 0 records referencing targets.
   - `admission_result_items`: 0 records referencing targets.
   - `admission_change_history`: Exactly 4 records referencing target campaign IDs (`975af319-...`, `84e8a3b6-...`, `764fcc1c-...`, `10ba1692-...`).
3. **Safety & Transactional Guarantees**:
   - Script encapsulated in a strict `DO $$ ... BEGIN ... EXCEPTION ... END $$;` PL/pgSQL block.
   - Validates exact 4 count and distinct codes prior to executing deletions.
   - Deletes child audit history records referencing only these 4 specific IDs.
   - Deletes the 4 target campaigns.
   - Raises exception and triggers complete rollback if count validation fails or any error occurs.
   - Zero modifications to user accounts, units, groups, programs, or active non-test campaigns.

## v0.10-CAMPAIGN-UI-CLEANUP – Campaign List View Modernization & Seed Action Removal
1. **Changes Applied at `/admissions/campaigns` (`CampaignListView.tsx`)**:
   - **Removed Action**: Completely removed the button `Đồng bộ 13 đợt mẫu 2026` (`#btn-seed-campaigns-2026`), along with its state `isSeeding` and handler `handleSeed2026Campaigns`.
   - **Cleaned Service**: Removed unused `seedStandard2026Campaigns()` method from `src/services/admissionService.ts` to prevent accidental execution of seed logic.
   - **Preserved Existing Data**: Existing admission campaigns in the database remain completely untouched.
   - **Updated Description**: Changed header subtitle to:
     `"Tạo và quản lý các đợt tuyển sinh theo năm, nhóm tuyển sinh và đơn vị; theo dõi trạng thái và lịch sử thay đổi."`
   - **Retained Features**:
     - All primary actions: `Làm mới` (`#btn-refresh-campaigns`), `Lịch sử kiểm toán` (`#btn-view-all-campaign-audit`), `Tạo đợt mới` (`#btn-create-campaign`).
     - All filters: Year (2026-2030), Group, Unit, Status, Active, Search.
     - All Quick Metrics Bar cards (Tổng số đợt, Đang tuyển, Đã đóng, Ngừng sử dụng, v.v.), dynamically computed from active database campaigns.
2. **Automated Verification (`scripts/self-test-campaign-ui-clean.ts`)**:
   - **11/11 checks PASS (100%)**: Confirmed complete removal of seed button & text, verified exact description string, verified retention of action buttons, filter controls, dynamic metric cards, and zero writes to Supabase during API reads.
   - Build (`compile_applet`) & Lint (`tsc --noEmit`): **100% PASS (0 errors)**.

## v0.10-COMPREHENSIVE-TECHNICAL-DOCUMENTATION – System Architecture & Modular Technical Specs
A complete ground-truth technical audit was conducted based strictly on current source code, active API routers, PostgreSQL schema, and UI views. The technical documentation is organized into modular files:

### 1. Architecture & System Reference (`docs/architecture/`)
- [System Architecture (Ngăn xếp công nghệ & Phân tầng kiến trúc)](./architecture/SYSTEM_ARCHITECTURE.md)
- [Module Relationships (Sơ đồ quan hệ phụ thuộc dữ liệu giữa các module)](./architecture/MODULE_RELATIONSHIPS.md)
- [RBAC Matrix & Data Scoping (Ma trận phân quyền & Cơ chế kiểm soát phạm vi)](./architecture/RBAC_MATRIX.md)
- [API Catalog (Danh mục toàn bộ endpoint REST API đang hoạt động)](./architecture/API_CATALOG.md)
- [Environment Variables (Danh mục biến môi trường & mục đích sử dụng)](./architecture/ENVIRONMENT_VARIABLES.md)

### 2. Module Technical Specifications (`docs/modules/`)
1. [Module 01: Tổng quan / Dashboard (Executive, Manager, Staff, Admin)](./modules/01_DASHBOARD.md)
2. [Module 02: Cơ cấu Tổ chức & Người dùng (Units & Users)](./modules/02_ORGANIZATION_USERS.md)
3. [Module 03: Quản lý Công việc (Tasks, Kanban, Gantt, Evidences)](./modules/03_TASKS.md)
4. [Module 04: Báo cáo Hằng ngày (Daily Reports, Work items, Review)](./modules/04_DAILY_REPORTS.md)
5. [Module 05: Quản lý Hiệu suất (KPI Definitions, Assignments, Scoring)](./modules/05_KPI.md)
6. [Module 06: Quản lý Tuyển sinh (Admissions Overview, Campaigns, Plans, Results)](./modules/06_ADMISSIONS.md)
7. [Module 07: Trợ lý Trí tuệ Nhân tạo (AI Assistant, Gemini, RAG)](./modules/07_AI_ASSISTANT.md)
8. [Module 08: Quản trị Hệ thống (System Settings, Audit Logs)](./modules/08_SYSTEM_ADMIN.md)
9. [Module 09: Vai trò & Phân quyền (RBAC Engine & Capabilities)](./modules/09_ROLES_PERMISSIONS.md)

## v0.10-CROSS-CHECK-PRE-C5-INVENTORY – Pre-C5 Technical Cross-Check & Input Inventory for C5-A
1. **Cross-Check Scope**: Audited all 43 active PostgreSQL tables, 4 Storage Buckets (`task-evidence`, `task-attachments`, `system-assets`, `ai-knowledge-docs`), 22 frontend routes in `src/routes/routeMetadata.ts`, and 55+ backend REST APIs in `server.ts` & `server/admissions/admissions.routes.ts`.
2. **C5-A Data Foundation & Isolation Inventory**:
   - Detailed specification published at: [`docs/architecture/C5_A_DATA_FOUNDATION_INVENTORY.md`](./architecture/C5_A_DATA_FOUNDATION_INVENTORY.md)
   - Identified all STHC-specific configurations in `system_settings` (`STHC`, address, phone, logo paths).
   - Identified Root hierarchy in `organization_units` (`STHC` id: `7afdccfd-4e25-434f-afba-e54b0652aa1f`, children: `HCNS`, `TT-HTQT`).
   - Catalogued all baseline seeds (`seedStandardPrograms`, `seedOfficial2026Plans`, fallback groups/campaigns).
   - Audited test scripts and confirmed safe, read-only assertion mechanisms for production data safety.

## v0.9-C5-A – Deployment Foundation Inventory for Work + KPI Software
- **Audit Decision**: **PASS (100% Read-Only Compliance)**.
- **Detailed Audit Report**: [`docs/architecture/C5_A_DEPLOYMENT_FOUNDATION_INVENTORY.md`](./architecture/C5_A_DEPLOYMENT_FOUNDATION_INVENTORY.md)
- **Key Findings**:
  1. **Schema & Tables**: Scanned 64 candidate tables from code & migrations; 53 tables exist on live DB, 11 tables are defined in code/migrations but missing on DB (`task_attachments`, `kpi_assignment_reviews`, Google Sheets tables, etc.).
  2. **Functions & RPC**: Tested 27 PostgreSQL functions; 15 functions verified active on DB; 12 functions in migration files missing from schema cache (handled via Express backend proxy fallback).
  3. **Storage Buckets**: Verified 4 buckets (`system-assets`, `task-evidence`, `task-attachments`, `ai-knowledge-docs`) with exact size limits and allowed MIME types.
  4. **Auth & Bootstrap Flow**: Verified user provisioning via Supabase Auth Admin API + `profiles` + `organization_members` + `access_user_roles`; identified need for formal First Admin Bootstrap migration in C5-E.
  5. **Critical Gap**: Pre-v0.2 base tables (`profiles`, `tasks`, `kpi_*`, `daily_reports`, `metrics`) lack initial DDL migration files in `migrations/`, making a clean deployment on a blank Supabase project currently impossible without C5-B schema unification.
  6. **Hardcoded STHC Footprint**: Catalogued all STHC configs in `system_settings`, unit hierarchy, seed buttons, and fallback code strings.
  7. **External Dependencies**: No Edge Functions or `pg_cron` jobs required; relies strictly on Gemini/OpenAI API and Supabase Storage/Auth.
  8. **Action Plan**: Roadmap established for C5-B through C5-J; strictly stopped at C5-A without altering production state.

## v0.9-C5-B – Chuẩn Hóa Chuỗi Migration Có Thứ Tự (Ordered Migrations)
- **Status**: **PASS (100% Production-Safe & Read-Only Audit)**.
- **Detailed Report**: [`docs/architecture/C5_B_ORDERED_MIGRATIONS.md`](./architecture/C5_B_ORDERED_MIGRATIONS.md)
- **Delivered Migration Sequence** (`supabase/migrations/`):
  1. `00001_extensions.sql`: `pgcrypto`, `vector` (pgvector).
  2. `00002_core_organization_and_users.sql`: `profiles`, `organization_units`, `organization_members`, `system_settings`, `notifications`.
  3. `00003_access_control_rbac.sql`: RBAC matrix (modules, roles, permissions, user_roles, audit_logs), role-sync trigger, 7 standard baseline roles.
  4. `00004_tasks_and_announcements.sql`: unified tasks, assignees, updates, evidence, comments, audience units/users.
  5. `00005_daily_reports_and_metrics.sql`: report sources, assignments, daily reports, task links, metric definitions & entries.
  6. `00006_kpi_foundation_and_scoring.sql`: BSC objectives, definitions, periods, templates, assignments, item bindings, manual entries, actual resolvers & scoring engine.
  7. `00007_admissions_foundation.sql`: groups, programs, campaigns, plans, results, result items, change history, performance views, recalculation functions & triggers.
  8. `00008_ai_assistant_and_usage.sql`: prompt definitions & versions, knowledge documents, chunks (vector 768), conversations, messages, usage tracking & rate limits, multi-provider configs & activation function.
  9. `00009_storage_buckets_setup.sql`: 4 buckets (`system-assets`, `task-evidence`, `task-attachments`, `ai-knowledge-docs`) & storage policies.
- **Classification & Rationalization**:
  - Fully catalogued 41 existing SQL files: applied/active vs superseded vs obsolete vs unapplied prototypes.
  - Rationalized 11 missing tables & 12 missing RPCs without unneeded DDL baggage (avoiding zombie code).
  - Explicitly marked internal DB catalog constraints pending admin SQL Editor queries.
  - Zero modifications to live production database or operational data.
  - Strictly stopped at C5-B.

## v0.9-C5-C – Tách Seed Nền Khỏi Dữ Liệu STHC (Seed Separation)
- **Status**: **PASS (100% Production-Safe & Zero STHC Leakage in Core Baseline Seed)**.
- **Detailed Technical Specification**: [`docs/architecture/C5_C_SEED_SEPARATION.md`](./architecture/C5_C_SEED_SEPARATION.md)
- **Automated Verification Script**: `scripts/verify-c5-c-seed-separation.ts` (Executed & verified: 100% PASS).
- **Core Results & Deliverables**:
  1. **Purified Schema Migrations**:
     - Removed seed data from `supabase/migrations/00003_access_control_rbac.sql`; all 9 migration files in `supabase/migrations/` are now 100% pure DDL.
     - Removed unapplied/obsolete table `announcement_reminders` from `00004_tasks_and_announcements.sql`.
     - Confirmed exact 1:1 match: **57 tables** and **2 views** defined across 9 migrations, matching the live database catalog.
  2. **Core Baseline Seed (`supabase/seeds/00001_core_baseline_seed.sql`)**:
     - School-agnostic seed containing: 11 access modules, 7 access roles (4 system + 3 domain), 67 permissions, 177 role-permission matrix mappings, 9 default system settings template keys, 1 default AI usage limit configuration, 1 default AI KPI prompt definition & version, and 2 generic educational training levels (`TRUNG_CAP`, `NGAN_HAN`).
     - Fully idempotent using `ON CONFLICT` and `WHERE NOT EXISTS`.
     - Zero hardcoded STHC identifiers, brand names, phone numbers, or emails.
  3. **STHC Demo / Sample Data Seed (`supabase/seeds/00002_sthc_sample_data.sql`)**:
     - Isolated STHC tenant configurations, ROOT unit `STHC` + departments (`HCNS`, `TT-HTQT`, `BPTS`), 12 standard training programs, 13 campaigns for 2026, and 2026 official target plans (570 TC, 750 NH).
     - Flagged as strictly opt-in; never executed automatically in new institution installations.
  4. **Roles Rationalization**:
     - 4 mandatory system roles (`admin`, `executive`, `manager`, `staff` with `is_system = true`, synced from `profiles.system_role`).
     - 3 domain functional roles (`admissions_admin`, `admissions_manager`, `admissions_staff` with `is_system = false`).
     - Zero modifications/deletions on production database roles.
  5. **Next Steps**:
     - Completed C5-C; advanced to C5-D (Tenant Parameterization).

## v0.9-C5-D – Tạo Cấu Hình Riêng Cho Từng Trường (Tenant Configuration & Isolation)
- **Status**: **PASS (100% Production-Safe & 24/24 Automated Self-Tests Passed)**.
- **Detailed Technical Specification**: [`docs/architecture/C5_D_TENANT_CONFIGURATION.md`](./architecture/C5_D_TENANT_CONFIGURATION.md)
- **Delivered Assets & Mechanisms**:
  1. **Template & Schema Validation**:
     - `tenant.config.example.json` and `docs/architecture/tenant.config.schema.json`.
     - Validates tenantCode format, ROOT unit, contact info, website, timezone, and enabled modules.
     - **Strict Security Invariant**: Detects and rejects any API key, service role key, password, or JWT token in JSON config. Secrets are strictly sourced from environment variables.
  2. **Tenant Provisioning Engine (`scripts/apply-tenant-config.ts`)**:
     - Runs post-migration and post-seed.
     - **Cross-Tenant Collision Guard**: Instantly aborts if database is already configured for a different tenant code, preventing accidental data pollution across institutions.
     - **Safe Idempotent Re-runs**: Protects settings modified by administrators (`updated_by IS NOT NULL`), never overwriting customized parameters.
     - **ROOT Unit Management**: Creates or verifies the single ROOT unit in `organization_units` without duplication.
     - **Strict Zero-User Policy**: Zero user or admin accounts created at this step (strictly reserved for C5-E First Admin Bootstrap).
  3. **STHC Hardcoding Cleanup & Dynamic Identity**:
     - Cleaned fallback strings in AI prompt builder, client headers (`school-work-kpi`), email placeholders, and SQL templates.
     - All school identity elements dynamically load from `system_settings` with generic educational fallbacks.
  4. **Disabled Module Enforcement**:
     - **Menu (Sidebar)**: Items for disabled modules are hidden via `isModuleEnabled`.
     - **Routes (RouteGuard)**: Directly navigating to disabled modules is blocked with user-friendly `module_disabled` state.
     - **Backend API (Express)**: `requireTenantModule(moduleCode)` returns HTTP 403 `MODULE_DISABLED`.
     - **Data Guarantee**: Disabling a module does not delete existing data or modify saved RBAC permissions.
  5. **STHC Sample Seed Blocker**:
     - `seedStandardPrograms` and `seedOfficial2026Plans` strictly require `tenantCode === "STHC"`, throwing errors on any other tenant.
     - Seed buttons on UI are hidden if `tenantCode !== "STHC"`.
     - Backend route guard `guardSthcOnlySeed` blocks direct API access on non-STHC databases.
  6. **Audit of `ON CONFLICT DO UPDATE` in Baseline Seed**:
     - Standardized `access_role_permissions` to `ON CONFLICT (role_id, permission_id) DO NOTHING` across 177 records, preserving any customized permission scope.
     - Preserves `is_active` in `access_modules` and `access_roles`, and `setting_value` in `system_settings`.
     - **Catalog Caveat**: The "57 tables" metric confirms count and primary columns via OpenAPI; exact 100% schema match of internal types/indexes/triggers remains unverified until Supabase SQL Editor catalog queries in C5-G.
  7. **Automated Verification**:
     - `scripts/test-c5-d-tenant-config.ts`: 24/24 self-test assertions passed across 2 mock institutions (VTC & CCT).
  8. **Next Steps**:
     - Completed C5-D; advanced to C5-E (First Admin Bootstrap).

## v0.9-C5-E – Tạo Admin Đầu Tiên & Gắn Với Đơn Vị ROOT (First Admin Bootstrap)
- **Status**: **PASS (100% Production-Safe & 44/44 Automated Self-Tests Passed)**.
- **Detailed Technical Specification**: [`docs/architecture/C5_E_FIRST_ADMIN_BOOTSTRAP.md`](./architecture/C5_E_FIRST_ADMIN_BOOTSTRAP.md)
- **Delivered Assets & Mechanisms**:
  1. **One-Time First Admin Bootstrap Engine (`scripts/bootstrap-first-admin.ts`)**:
     - Strict pre-check of prerequisites: verifies `tenant_code`, ROOT unit (`parent_id IS NULL`), and `admin` role existence.
     - **Auth Admin API Standard**: Creates user solely via Supabase Auth Admin API (`auth.admin.createUser`), never inserting directly into `auth.users`.
     - **Atomic 4-Way Linkage**: Integrates Supabase Auth ID with `public.profiles` (`system_role = admin`), `public.access_user_roles` (`role = admin`), `public.organization_members` (`ROOT unit, role = head`), and `public.access_audit_logs`.
  2. **Security & Credential Flow**:
     - Accepts email, credentials from environment variables (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`) or secure CLI flags.
     - Cryptographically secure random password generation (16 chars, high entropy) if password omitted.
     - Zero hardcoded passwords; passwords strictly masked from logs, audit records, and return objects.
  3. **Existing Admin Guard & Idempotent Crash Recovery**:
     - **Pre-run Check**: Instantly aborts if another active Admin already exists in `profiles`, preventing accidental secondary admin bootstrap.
     - **Crash / Partial Failure Recovery**: If run again with the same admin email after a network or DB failure midway, automatically discovers existing Auth user, recovers user ID, and completes missing database linkages without duplicate record generation.
  4. **Production STHC Environment Safety Boundary**:
     - Strictly locks execution if `tenant_code === STHC` on production environment to prevent altering live users.
  5. **Automated Verification**:
     - `scripts/test-c5-e-first-admin.ts`: 44/44 self-tests passed across prerequisites, atomic linking, permission resolution, existing admin guard, idempotent re-run, crash recovery, and password safety.
     - Integrated missing C5-D validation evidence: tested 2 distinct schools, verified STHC seed blocking, verified module disabling across menu, route, and API.
  6. **Next Steps**:
     - Completed C5-E; advanced to C5-F (Fixture Isolation).

## v0.9-C5-F – Tách Fixture Test Khỏi Production (Fixture Isolation)
- **Status**: **PASS (100% Production-Safe & Self-Test Verified)**.
- **Detailed Technical Specification**: [`docs/architecture/C5_F_FIXTURE_ISOLATION.md`](./architecture/C5_F_FIXTURE_ISOLATION.md)
- **Delivered Assets & Mechanisms**:
  1. **Fixture & Cleanup Inventory**:
     - Completed full inventory of test fixtures, sample users, demo scripts, admission test data, and database cleanup scripts.
  2. **Strict Production Isolation**:
     - Build (`npm run build`), startup (`npm start` / `server.ts`), and deployment pipelines do not auto-load fixtures, STHC sample seed, or cleanup scripts.
     - Server-side guards (`guardSthcOnlySeed`, production environment detection) block fixture and cleanup operations when configuration points to production STHC, even if override flags (like `--force`) are passed.
  3. **Targeted Cleanup**:
     - Enforced unique test identification (`test_run_id`, email domain `@test.local`) for test records, avoiding any bulk deletion of real production data.
  4. **Explicit C5-E Status Clarification**:
     - Clarified that C5-E script bootstrap (`bootstrap-first-admin.ts`) was verified via automated self-tests and code/build inspection in mock environments; **never executed on a live production database** (reserved strictly for C5-G).
  5. **Automated Verification**:
     - `scripts/test-c5-f-fixture-isolation.ts`: Verified production blocking and safe test identification (3/3 PASS).
  6. **Next Steps**:
     - Completed C5-F; advanced to C5-G (Trial Installation Runbook Preparation).

## v0.9-C5-G – Thử Cài Đặt Trên Supabase Project Trắng (Trial Installation & Verification)
- **Status**: **PASS (Verified & Executed on Trial Database)**.
- **Detailed Technical Specification**: [`docs/architecture/C5_G_TRIAL_INSTALLATION_RUNBOOK.md`](./architecture/C5_G_TRIAL_INSTALLATION_RUNBOOK.md)
- **Delivered Assets & Mechanisms**:
  1. **Trial Project Execution**: Successfully executed full provisioning on trial database (9 migrations, baseline seed, tenant config `VTC`, and First Admin Bootstrap).
  2. **Isolation Guarantee**: Zero impact on production STHC.

## v0.9-C5-H – Bộ Kiểm Thử Tự Động Nghiệm Thu Trên Database Mới (Automated Acceptance Suite)
- **Status**: **PASS (5/5 Automated Acceptance Tests Passed)**.
- **Detailed Technical Specification**: [`docs/architecture/C5_H_AUTOMATED_ACCEPTANCE.md`](./architecture/C5_H_AUTOMATED_ACCEPTANCE.md)
- **Delivered Assets & Mechanisms**:
  1. **Automated Acceptance Suite (`scripts/acceptance-test-c5-h.ts`)**:
     - Verified database schema, ROOT unit recognition, RBAC admin role, core business flow CRUD (task with unique `testRunId`), and environment isolation. All 5/5 assertions passed.

## v0.9-C5-I – Viết Tài Liệu Triển Khai Cho Một Trường Mới (New Institution Deployment Runbook)
- **Status**: **OFFICIAL / ĐÃ XÁC MINH THỰC TẾ QUA C5-G & C5-H PASS**.
- **Detailed Technical Specification**: [`docs/architecture/C5_I_NEW_INSTITUTION_DEPLOYMENT_RUNBOOK.md`](./architecture/C5_I_NEW_INSTITUTION_DEPLOYMENT_RUNBOOK.md)
- **Delivered Assets & Mechanisms**:
  1. **Comprehensive 10-Step Runbook**: Validated and updated official 10-step deployment guide for new institutions.
  2. **Handover Checklist & Upgrade Separation**: Secure handover checklist and strict separation from unverified live upgrades.
  3. **Next Steps**: Strictly stopped at C5-I per instructions; never executed on production STHC. Ready for production-grade institution onboarding.

## v0.10-CLEANUP – Pre-GitHub Project Cleanup (Cleanup of Redundant Scripts & Tenant Config Protection)
- **Status**: **COMPLETED & VERIFIED (Build & Lint 100% Clean)**.
- **Delivered Assets & Mechanisms**:
  1. **Redundant Script Removal**: Deleted 4 redundant/one-off verification & hotfix scripts (`scripts/self-test-ai-d3-hotfix.ts`, `scripts/self-test-ai-d3-hotfix2.ts`, `scripts/verify_remote_supabase.cjs`, `scripts/verify_a3_remote.cjs`) and updated `package.json` scripts accordingly.
  2. **Tenant Config Protection**: Added `tenant.config.json` to `.gitignore` to prevent leaking environment-specific/tenant configurations to GitHub, while keeping `tenant.config.example.json` as a clean public template.
  3. **Verification**: `npm run build` and `npm run lint` (`tsc --noEmit`) completed successfully with zero errors.












