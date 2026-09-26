const fs = require('fs');
let code = fs.readFileSync('src/services/taskService.ts', 'utf8');

const additionalMethods = `
  /**
   * Lấy danh sách các đơn vị người dùng được phép chọn để tạo task
   */
  async getAvailableOrganizations(role: SystemRole, userId: string, allUnits: OrganizationUnit[], userUnitIds: string[]): Promise<OrganizationUnit[]> {
    if (role === 'admin') {
      return allUnits.filter(u => u.is_active);
    }
    if (role === 'manager' || role === 'staff') {
      return allUnits.filter(u => u.is_active && userUnitIds.includes(u.id));
    }
    return [];
  },

  /**
   * Lấy danh sách thành viên thuộc một đơn vị (Gọi API)
   */
  async getTaskMembers(orgId: string): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return [];

    try {
      const response = await fetch(\`/api/task-members?organization_unit_id=\${orgId}\`, {
        headers: {
          'Authorization': \`Bearer \${session.access_token}\`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch task members');
      }
      return await response.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },
`;

if (!code.includes('getAvailableOrganizations')) {
  code = code.replace('export const taskService = {', 'export const taskService = {' + additionalMethods);
  fs.writeFileSync('src/services/taskService.ts', code);
}
