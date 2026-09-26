const fs = require('fs');
let code = fs.readFileSync('src/components/metrics/MetricEntryView.tsx', 'utf-8');

code = code.replace(/import \{ metricService \} from '\.\.\/\.\.\/services\/metric\.service';/, "import { metricService } from '../../services/metric.service';\nimport { profileService } from '../../services/profileService';");

code = code.replace(/const \[availableUnits, setAvailableUnits\] = useState<OrganizationUnit\[\]>\(\[\]\);/, "const [availableUnits, setAvailableUnits] = useState<OrganizationUnit[]>([]);\n  const [availableUsers, setAvailableUsers] = useState<any[]>([]);\n  const [selectedUserId, setSelectedUserId] = useState<string>('');");

// In useEffect for unit, fetch users
const useEffectRegex = /useEffect\(\(\) => \{\s*const fetchUnits = async \(\) => \{[\s\S]*?\}\, \[isAdmin, selectedUnitId\]\);/m;
const newUseEffect = `
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const units = await organizationService.getUnits();
        setAvailableUnits(units);
        if (isAdmin && !selectedUnitId && units.length > 0) {
          setSelectedUnitId(units[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách đơn vị:', err);
      }
    };
    fetchUnits();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && selectedUnitId) {
      profileService.getProfiles(selectedUnitId).then((users) => {
        setAvailableUsers(users.filter(u => u.is_active));
        if (users.length > 0 && !selectedUserId) {
          setSelectedUserId(users[0].id);
        }
      }).catch(console.error);
    }
  }, [isAdmin, selectedUnitId]);
`;
code = code.replace(useEffectRegex, newUseEffect.trim());

// user_id logic in loadData and handleSaveAll
code = code.replace(/user_id: isAdmin \|\| isManager \? undefined : user\.id,/g, "user_id: def.measurement_scope === 'unit' ? undefined : (isAdmin ? selectedUserId : user.id),");

// Admin UI unit selector
const unitSelectRegex = /<div className="flex items-center gap-2">\s*<Building2 className="h-4 w-4 text-slate-500" \/>[\s\S]*?<\/select>\s*<\/div>/m;
const newUnitSelect = `
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500" />
                <label htmlFor="admin-unit-select" className="text-xs font-bold text-slate-700">
                  Đơn vị:
                </label>
                <select
                  id="admin-unit-select"
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                >
                  <option value="">Tất cả đơn vị</option>
                  {availableUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="admin-user-select" className="text-xs font-bold text-slate-700">
                  Thành viên (cho Metric Cá nhân):
                </label>
                <select
                  id="admin-user-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                >
                  <option value="">-- Chọn thành viên --</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.employee_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
`;
code = code.replace(unitSelectRegex, newUnitSelect.trim());

// dependency arrays
code = code.replace(/\[user, selectedUnitId, selectedDate, isAdmin, isManager\]/g, "[user, selectedUnitId, selectedUserId, selectedDate, isAdmin, isManager]");

fs.writeFileSync('src/components/metrics/MetricEntryView.tsx', code);
