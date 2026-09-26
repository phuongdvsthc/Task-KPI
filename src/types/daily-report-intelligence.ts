export type DailyReportIntelligenceFeature = 'staff_daily_summary' | 'manager_team_summary' | 'manager_unit_summary';

export type DailyReportIntelligenceRequest = {
  feature: DailyReportIntelligenceFeature;
  dateFrom: string;
  dateTo: string;
  unitId?: string;
  userId?: string;
  language?: 'vi';
};

export type EvidenceRef = {
  type: 'daily_report';
  dailyReportId: string;
  reportDate?: string;
  userId?: string;
  userName?: string;
  staffName?: string;
};

export type DailyReportHighlight = {
  text: string;
  evidence: EvidenceRef[];
};

export type DailyReportIssue = {
  text: string;
  evidence: EvidenceRef[];
};

export type DailyReportAction = {
  text: string;
  actionType?: 'explicit' | 'suggested';
  evidence?: EvidenceRef[];
};

export type DailyReportIntelligenceMetadata = {
  featureKey: string;
  promptKey: string;
  promptVersion?: number;
  generatedAt: string;
  dateFrom: string;
  dateTo: string;
  truncatedContext: boolean;
  unitId?: string;
  unitName?: string;
  reportCount?: number;
  staffCount?: number;
};

export type DailyReportIntelligenceResult = {
  summary: string;
  highlights: DailyReportHighlight[];
  issues: DailyReportIssue[];
  actions: DailyReportAction[];
  metadata: DailyReportIntelligenceMetadata;
};
