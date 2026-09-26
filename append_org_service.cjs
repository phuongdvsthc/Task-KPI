const fs = require('fs');

let code = fs.readFileSync('src/services/organizationService.ts', 'utf-8');

// Insert our Admin API functions before the final closing brace of the object
const adminFunctions = `
  // ---------------------------------------------------------
  // ADMIN API CALLS (Express)
  // ---------------------------------------------------------

  async getAdminUnits(): Promise<OrganizationUnit[]> {
    const token = await this._getAuthToken();
    const response = await fetch('/api/admin/organization-units', {
      headers: { 'Authorization': \`Bearer \${token}\` }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Lỗi khi tải danh sách đơn vị');
    }
    return response.json();
  },

  async createOrganizationUnit(payload: Partial<OrganizationUnit>): Promise<OrganizationUnit> {
    const token = await this._getAuthToken();
    const response = await fetch('/api/admin/organization-units', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Lỗi khi tạo đơn vị');
    }
    return response.json();
  },

  async updateOrganizationUnit(id: string, payload: Partial<OrganizationUnit>): Promise<OrganizationUnit> {
    const token = await this._getAuthToken();
    const response = await fetch(\`/api/admin/organization-units/\${id}\`, {
      method: 'PUT',
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Lỗi khi cập nhật đơn vị');
    }
    return response.json();
  },

  async deactivateOrganizationUnit(id: string): Promise<OrganizationUnit> {
    // Just calls update with is_active: false
    return this.updateOrganizationUnit(id, { is_active: false });
  },

  async activateOrganizationUnit(id: string): Promise<OrganizationUnit> {
    return this.updateOrganizationUnit(id, { is_active: true });
  },

  async deleteOrganizationUnit(id: string): Promise<void> {
    const token = await this._getAuthToken();
    const response = await fetch(\`/api/admin/organization-units/\${id}\`, {
      method: 'DELETE',
      headers: { 'Authorization': \`Bearer \${token}\` }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Lỗi khi xóa đơn vị');
    }
  },

  async _getAuthToken(): Promise<string> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa sẵn sàng');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Chưa đăng nhập');
    return session.access_token;
  },
`;

code = code.replace(/};\s*$/, adminFunctions + '\n};');
fs.writeFileSync('src/services/organizationService.ts', code);
