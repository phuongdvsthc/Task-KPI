export interface AIUsageSettings {
  ai_service_enabled: boolean;
  user_daily_request_limit: number;
  user_daily_token_limit: number;
  system_monthly_token_limit: number;
  system_monthly_budget_limit: number | null;
  per_user_minute_request_limit: number;
  per_user_concurrent_limit: number;
  warning_threshold_pct: number;
  timezone: string;
  reservation_timeout_seconds: number;
  updated_at: string;
}

export interface AIReservationResult {
  allowed: boolean;
  requestId?: string;
  errorCode?: string;
  message?: string;
  resetsAt?: string;
}

export interface AIUsageLogEntity {
  id: string;
  request_id: string;
  correlation_id?: string;
  user_id?: string;
  task_type: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  embedding_tokens: number;
  total_tokens: number;
  is_estimated: boolean;
  duration_ms?: number;
  status: string;
  error_code?: string;
  estimated_cost?: number;
  created_at: string;
}
