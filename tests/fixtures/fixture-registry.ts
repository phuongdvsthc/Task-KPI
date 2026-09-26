/**
 * Test Fixture Registry (v0.9-C5-F)
 *
 * Centralized, isolated test data definitions for testing across modules.
 *
 * STRICT INVARIANTS:
 * 1. All fixture entities MUST use the deterministic prefix `TEST_FIXTURE_`.
 * 2. All fixture emails MUST use the `@test.local` domain.
 * 3. Never use real institution names, real staff names, or production emails.
 * 4. Deterministic IDs enable safe, targeted teardown without risking production data.
 */

export interface FixtureUser {
  id: string;
  email: string;
  fullName: string;
  systemRole: 'admin' | 'manager' | 'staff' | 'executive';
  jobTitle: string;
  employeeCode: string;
}

export interface FixtureUnit {
  id: string;
  code: string;
  name: string;
  unitType: 'department' | 'division' | 'center';
  description: string;
}

export interface FixtureTask {
  id: string;
  code: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
}

export interface FixtureKpi {
  id: string;
  code: string;
  name: string;
  targetValue: number;
  unit: string;
}

export interface FixtureAdmissionPlan {
  id: string;
  year: number;
  targetCount: number;
  notes: string;
}

export const TEST_FIXTURE_USERS: Record<string, FixtureUser> = {
  ADMIN: {
    id: '00000000-0000-4000-a000-000000000001',
    email: 'test_fixture_admin@test.local',
    fullName: 'Test Fixture Admin',
    systemRole: 'admin',
    jobTitle: 'Quản trị viên Kiểm thử',
    employeeCode: 'TEST_EMP_001'
  },
  MANAGER: {
    id: '00000000-0000-4000-a000-000000000002',
    email: 'test_fixture_manager@test.local',
    fullName: 'Test Fixture Manager',
    systemRole: 'manager',
    jobTitle: 'Trưởng bộ phận Kiểm thử',
    employeeCode: 'TEST_EMP_002'
  },
  STAFF: {
    id: '00000000-0000-4000-a000-000000000003',
    email: 'test_fixture_staff@test.local',
    fullName: 'Test Fixture Staff',
    systemRole: 'staff',
    jobTitle: 'Chuyên viên Kiểm thử',
    employeeCode: 'TEST_EMP_003'
  }
};

export const TEST_FIXTURE_UNITS: Record<string, FixtureUnit> = {
  DEPT_TECH: {
    id: '00000000-0000-4000-b000-000000000001',
    code: 'TEST_FIXTURE_UNIT_TECH',
    name: 'Phòng Kỹ thuật Kiểm thử',
    unitType: 'department',
    description: 'Đơn vị kiểm thử phần mềm tự động'
  },
  DIV_QA: {
    id: '00000000-0000-4000-b000-000000000002',
    code: 'TEST_FIXTURE_UNIT_QA',
    name: 'Bộ phận Đảm bảo Chất lượng',
    unitType: 'division',
    description: 'Bộ phận kiểm thử trực thuộc đơn vị kỹ thuật'
  }
};

export const TEST_FIXTURE_TASKS: Record<string, FixtureTask> = {
  TASK_SAMPLE_1: {
    id: '00000000-0000-4000-c000-000000000001',
    code: 'TEST_FIXTURE_TASK_01',
    title: 'Nhiệm vụ kiểm thử hồi quy phân quyền',
    description: 'Kiểm tra tính toàn vẹn của RBAC trong môi trường test',
    priority: 'high',
    status: 'in_progress'
  }
};

export const TEST_FIXTURE_KPIS: Record<string, FixtureKpi> = {
  KPI_SAMPLE_1: {
    id: '00000000-0000-4000-d000-000000000001',
    code: 'TEST_FIXTURE_KPI_01',
    name: 'Tỷ lệ hoàn thành công việc kiểm thử',
    targetValue: 100,
    unit: '%'
  }
};

export const TEST_FIXTURE_ADMISSIONS: Record<string, FixtureAdmissionPlan> = {
  PLAN_SAMPLE_1: {
    id: '00000000-0000-4000-e000-000000000001',
    year: 2026,
    targetCount: 50,
    notes: 'TEST_FIXTURE_ADMISSION_PLAN_2026'
  }
};
