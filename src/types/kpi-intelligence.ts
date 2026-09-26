export type KPIIntelligenceFeature = 
  | 'staff_kpi_summary'
  | 'manager_team_kpi_summary'
  | 'manager_unit_kpi_summary';

export type KPIIntelligenceRequest = {
  feature: KPIIntelligenceFeature;
  periodId?: string;
  assignmentId?: string;
  unitId?: string;
  status?: string[];
  includeLocked?: boolean;
  language?: 'vi';
};

export type KPIEvidenceRef = {
  type: 'kpi_assignment' | 'kpi_item';
  assignmentId: string;
  assignmentItemId?: string;
  kpiDefinitionId?: string;
  kpiName?: string;
  periodId?: string;
  periodLabel?: string;
  assigneeLabel?: string;
  unitLabel?: string;
  scoreMode?: 'live' | 'official';
  target?: number | string | null;
  actual?: number | string | null;
  score?: number | string | null;
  status?: string;
  scoringStatus?: string;
  attainmentState?: string;
};

export type KPIInsightItem = {
  text: string;
  evidence: KPIEvidenceRef[];
};

export type KPIActionItem = {
  text: string;
  actionType?: 'explicit' | 'suggested';
  evidence?: KPIEvidenceRef[];
};

export type KPIIntelligenceResult = {
  summary: string;
  highlights: KPIInsightItem[];
  issues: KPIInsightItem[];
  actions: KPIActionItem[];
  metadata: {
    featureKey: string;
    promptKey: string;
    promptVersion?: number;
    generatedAt: string;
    periodId?: string;
    periodLabel?: string;
    unitId?: string;
    unitName?: string;
    scopeLabel?: string;
    assignmentCount?: number;
    itemCount?: number;
    scoredCount?: number;
    unscoredCount?: number;
    lockedCount?: number;
    liveCount?: number;
    individualAssignmentCount?: number;
    organizationAssignmentCount?: number;
    truncatedContext: boolean;
  };
};
