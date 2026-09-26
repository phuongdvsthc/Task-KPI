export interface SecurityLogEvent {
  requestId?: string;
  actorId?: string | null;
  endpoint?: string;
  method?: string;
  capability?: string;
  action?: string;
  result: 'ALLOW' | 'DENY' | 'ERROR';
  reason?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

const SENSITIVE_KEYS = new Set([
  'authorization',
  'token',
  'jwt',
  'password',
  'secret',
  'key',
  'apikey',
  'service_role',
  'service_role_key',
  'access_token',
  'refresh_token'
]);

export function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeLogData);

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('pass')) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeLogData(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export function logSecurityEvent(event: SecurityLogEvent): void {
  const sanitized = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
    metadata: event.metadata ? sanitizeLogData(event.metadata) : undefined
  };

  const level = event.result === 'DENY' || event.result === 'ERROR' ? 'warn' : 'info';
  const prefix = `[SECURITY_AUDIT] [${sanitized.result}]`;
  const message = `${prefix} ${sanitized.method || ''} ${sanitized.endpoint || ''} - actor=${sanitized.actorId || 'anonymous'} cap=${sanitized.capability || 'none'} reason=${sanitized.reason || 'ok'} reqId=${sanitized.requestId || '-'}`;

  if (level === 'warn') {
    console.warn(message, sanitized.metadata || '');
  } else {
    // Info log in debug/verbose or production audit stream
    console.log(message);
  }
}
