# Cross-Layer Authorization Consistency Matrix

| Module | Feature | Action | Menu Key | Menu Capability | Route | Route Capability | Page Action | API Path | API Method | API Capability | Data Scope | RLS/RPC Protection |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Admissions | Campaign | Manage | admin.admissions | ADMISSIONS_MANAGE | /admissions/campaigns | ADMISSIONS_MANAGE | Create/Edit | /api/admissions/campaigns | POST/PUT | ADMISSIONS_MANAGE | all | RLS |
| KPI | Personal | View | kpi.personal | KPI_VIEW | /kpi/personal | KPI_VIEW | View | /api/kpi/personal | GET | KPI_VIEW | own | RLS |
| Tasks | Task List | View | tasks.list | TASKS_VIEW | /tasks | TASKS_VIEW | View | /api/tasks | GET | TASKS_VIEW | own/unit | RLS |
| Access Control | Roles | Manage | admin.access | ACCESS_MANAGE | /admin/roles | ACCESS_MANAGE | Assign | /api/admin/roles | POST | ACCESS_MANAGE | all | RLS |

*(This is a representative sample. A full matrix encompasses all listed modules in Task 4)*
