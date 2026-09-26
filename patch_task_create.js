const fs = require('fs');
let file = fs.readFileSync('src/components/tasks/TaskCreate.tsx', 'utf8');

const effectCode = `
  // Load draft data if editing
  useEffect(() => {
    if (editTaskId) {
      const loadDraft = async () => {
        try {
          const task = await taskService.getTaskById(editTaskId);
          if (task && task.task_type === 'announcement' && task.publication_status === 'draft') {
            setCreateMode('announcement');
            setTitle(task.title);
            setDescription(task.description || '');
            setPriority(task.priority);
            setAcknowledgementRequired(task.acknowledgement_required || false);
            setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
            
            // Need to fetch audience mode and selections
            const supabase = (window as any).supabaseClient; // Or import it
            const { data: taskRow } = await supabase.from('tasks').select('audience_mode').eq('id', editTaskId).single();
            if (taskRow && taskRow.audience_mode) {
              setAudienceMode(taskRow.audience_mode);
            }
            
            const { data: units } = await supabase.from('task_announcement_audience_units').select('organization_unit_id').eq('task_id', editTaskId);
            if (units) setSelectedUnitIds(units.map(u => u.organization_unit_id));
            
            const { data: users } = await supabase.from('task_announcement_audience_users').select('user_id').eq('task_id', editTaskId);
            if (users) setSelectedUserIds(users.map(u => u.user_id));
          }
        } catch (e) {
          console.error('Error loading draft', e);
        }
      };
      loadDraft();
    }
  }, [editTaskId]);
`;

file = file.replace('// Fetch available units\n  useEffect(() => {', effectCode + '\n  // Fetch available units\n  useEffect(() => {');
// import getSupabaseClient
if (!file.includes('getSupabaseClient')) {
  file = file.replace("import { useAuth } from '../../contexts/AuthContext';", "import { useAuth } from '../../contexts/AuthContext';\nimport { getSupabaseClient } from '../../services/supabaseClient';");
  file = file.replace("const supabase = (window as any).supabaseClient; // Or import it", "const supabase = getSupabaseClient();");
} else {
  file = file.replace("const supabase = (window as any).supabaseClient; // Or import it", "const supabase = getSupabaseClient();");
}

fs.writeFileSync('src/components/tasks/TaskCreate.tsx', file);
