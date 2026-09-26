# RBAC Technical Guide

## 1. Overview
The RBAC system follows a capability-based model where permissions are not directly assigned to users but grouped into roles. Users are assigned one or more roles.

## 2. Architecture
- **Foundational Roles**: `system_role` (e.g., 'admin', 'executive', 'manager', 'staff') stored in `profiles`. Used for initial system state.
- **Functional Roles**: Custom roles defined in `access_roles` table, providing granular `capabilities`.
- **Capability Contract**: Centralized list of actions (`access_permissions`).
- **Data Scope**: `own`, `unit`, `unit_tree`, `all`.

## 3. Implementation Checklist for New Modules
1. Define Capability in `access_permissions`.
2. Add capability constant.
3. Protect Frontend Route (middleware).
4. Protect Backend API (`requirePermission`, `applyScopeToQuery`).
5. Verify RLS.
6. Add Audit Log.
7. Run regression tests.
