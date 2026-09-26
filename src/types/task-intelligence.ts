export type TaskIntelligenceFeature =
  | 'staff_task_summary'
  | 'manager_team_task_summary'
  | 'manager_unit_task_summary';

export type TaskIntelligenceRequest = {
  feature: TaskIntelligenceFeature;
  dateFrom?: string;
  dateTo?: string;
  unitId?: string;
  status?: string[];
  priority?: string[];
  includeCompleted?: boolean;
  language?: 'vi';
  userId?: string;
};

export type TaskEvidenceRef = {
  type: 'task';
  taskId: string;
  taskTitle?: string;
  dueDate?: string;
  status?: string;
  userId?: string;
};

export type TaskInsightItem = {
  text: string;
  evidence: TaskEvidenceRef[];
  riskType?: 'overdue' | 'attention';
};

export type TaskActionItem = {
  text: string;
  actionType?: 'explicit' | 'suggested';
  evidence?: TaskEvidenceRef[];
};

export type TaskIntelligenceResult = {
  summary: string;
  highlights: TaskInsightItem[];
  issues: TaskInsightItem[];
  actions: TaskActionItem[];
  metadata: {
    featureKey: string;
    promptKey: string;
    promptVersion?: number;
    generatedAt: string;
    dateFrom?: string;
    dateTo?: string;
    taskCount: number;
    staffCount?: number;
    openCount?: number;
    inProgressCount?: number;
    overdueCount?: number;
    completedCount?: number;
    truncatedContext: boolean;
    unitId?: string;
    scopeLabel?: string;
  };
};
