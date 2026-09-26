import { AIContextData, AIContextRequest } from '../../types/ai';
import { AIContextError } from '../../types/ai_errors';

export const aiTaskContextService = {
  async buildTaskContext(supabaseAdmin: any, req: AIContextRequest, envelope: AIContextData): Promise<void> {
    const { actor, scope } = envelope;
    const AI_CONTEXT_MAX_RECORDS = 50;

    // 1. Build Query
    let query = supabaseAdmin
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        created_at,
        due_date,
        completed_at,
        owner_id,
        created_by,
        organization_unit_id,
        task_type,
        profiles!tasks_owner_id_fkey ( full_name ),
        organization_units ( name ),
        task_assignees (
          user_id,
          role,
          profiles ( full_name )
        ),
        task_evidence ( count )
      `)
      .neq('task_type', 'announcement')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    // Date filters - assume filtering on created_at or due_date 
    // We will use created_at as standard unless they specify a strict due_date filter.
    // Let's filter on due_date if dateFrom/dateTo is provided to match Task feature expectations, 
    // or we can use an OR condition if needed. For B3, matching `getTasks` which uses due_date:
    // query.gte('due_date', filters.date_range.from)
    if (req.entityIds && req.entityIds.length > 0) {
      query = query.in('id', req.entityIds);
    }
    if (req.dateFrom) query = query.gte('due_date', req.dateFrom);
    if (req.dateTo) query = query.lte('due_date', req.dateTo);

    // Status / priority filters if provided in req
    if (req.status && Array.isArray(req.status)) {
      query = query.in('status', req.status);
    } else if (req.status && typeof req.status === 'string') {
      query = query.eq('status', req.status);
    }
    
    if (req.priority && Array.isArray(req.priority)) {
      query = query.in('priority', req.priority);
    } else if (req.priority && typeof req.priority === 'string') {
      query = query.eq('priority', req.priority);
    }
    
    if (req.includeCompleted === false) {
      query = query.neq('status', 'completed');
    }

    // 2. Apply Scope Authorization (Replicating taskService.getTasks)
    if (scope.scopeType === 'unit_descendants') {
       if (scope.unitIds.length > 0) {
         query = query.in('organization_unit_id', scope.unitIds);
       } else {
         query = query.eq('id', 'forced-empty-id'); // fallback
       }
    } else if (scope.scopeType === 'system' || scope.scopeType === 'read_only_system') {
       if (scope.unitIds && scope.unitIds.length > 0) {
         query = query.in('organization_unit_id', scope.unitIds);
       } else if (req.unitId) {
         query = query.eq('organization_unit_id', req.unitId);
       }
    }

    const { data: tasks, error } = await query;
    if (error) {
       console.error("AI Task context error:", error);
       throw new AIContextError('AI_CONTEXT_SOURCE_UNAVAILABLE', 'Failed to fetch tasks');
    }

    let results = tasks || [];
    if (req.entityIds && req.entityIds.length > 0) {
      // Need to post-filter check for staff scope, so we do it after staff filtering.
    }

    // 3. Post-filter for Staff scope exactly like taskService
    if (scope.scopeType === 'self') {
      const targetUserId = actor.userId;
      const { data: assigneeRows } = await supabaseAdmin
          .from('task_assignees')
          .select('task_id')
          .eq('user_id', targetUserId);
      const assignedTaskIds = new Set((assigneeRows || []).map((r: any) => r.task_id));

      results = results.filter((t: any) => 
          t.owner_id === targetUserId || 
          t.created_by === targetUserId || 
          assignedTaskIds.has(t.id)
      );
    }
    
    // Support user filter for manager/admin
    if (req.userId && scope.scopeType !== 'self') {
      results = results.filter((t: any) => {
         if (t.owner_id === req.userId) return true;
         if (t.created_by === req.userId) return true;
         if (t.task_assignees?.some((a: any) => a.user_id === req.userId)) return true;
         return false;
      });
    }
    
    if (req.entityIds && req.entityIds.length > 0) {
      if (results.length !== req.entityIds.length) {
        throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'One or more requested entity IDs are unauthorized or not found.');
      }
    }

    // 4. Truncation
    let processedTasks = results;
    if (processedTasks.length > AI_CONTEXT_MAX_RECORDS) {
      processedTasks = processedTasks.slice(0, AI_CONTEXT_MAX_RECORDS);
      envelope.metadata.truncated = true;
      envelope.metadata.warnings.push('TASK_CONTEXT_TRUNCATED');
    }

    // 5. Normalize
    const summary = {
      taskCount: 0,
      openCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      overdueCount: 0,
      staffCount: 0
    };

    const uniqueStaff = new Set<string>();

    const truncateText = (text: string | null) => {
         if (!text) return text;
         return text.length > 500 ? text.substring(0, 500) + '...' : text;
    };

    const now = new Date();

    const normalizedTasks = processedTasks.map((t: any) => {
      summary.taskCount++;
      if (t.owner_id) uniqueStaff.add(t.owner_id);
      
      const assignees = (t.task_assignees || []).map((a: any) => {
        uniqueStaff.add(a.user_id);
        return {
          userId: a.user_id,
          role: a.role,
          name: a.profiles?.full_name
        };
      });

      if (t.status === 'todo' || t.status === 'waiting') summary.openCount++;
      else if (t.status === 'in_progress') summary.inProgressCount++;
      else if (t.status === 'completed') summary.completedCount++;

      let isOverdue = false;
      if (t.due_date && t.status !== 'completed' && t.status !== 'cancelled') {
         if (new Date(t.due_date) < now) {
            isOverdue = true;
            summary.overdueCount++;
         }
      }

      return {
        taskId: t.id,
        title: t.title,
        description: truncateText(t.description),
        status: t.status,
        priority: t.priority,
        createdAt: t.created_at,
        dueDate: t.due_date,
        completedAt: t.completed_at,
        owner: {
          userId: t.owner_id,
          name: t.profiles?.full_name
        },
        assignees,
        unitId: t.organization_unit_id,
        unitName: t.organization_units?.name,
        isOverdue,
        evidenceCount: t.task_evidence?.[0]?.count || 0
      };
    });

    summary.staffCount = uniqueStaff.size;

    envelope.data.tasks = {
      summary,
      tasks: normalizedTasks
    };

    envelope.metadata.recordCounts['tasks'] = summary.taskCount;
  }
};
