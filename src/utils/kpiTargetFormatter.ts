/**
 * KPI Target Formatter Utility
 * Renders human-readable target strings according to definition metadata and configuration
 */
export function formatTargetConfig(
  targetConfig: any,
  measurementType?: string,
  direction?: string,
  unitCode?: string | null
): string {
  if (!targetConfig || typeof targetConfig !== 'object') return '-';

  const unit = unitCode ? ` ${unitCode}` : '';

  if (direction === 'target_range' || targetConfig.min !== undefined || targetConfig.max !== undefined) {
    const min = targetConfig.min ?? '?';
    const max = targetConfig.max ?? '?';
    return `${min} – ${max}${unit}`;
  }

  if (measurementType === 'boolean' || typeof targetConfig.value === 'boolean') {
    return targetConfig.value ? 'Đạt (Có)' : 'Không đạt (Không)';
  }

  if (measurementType === 'milestone' || targetConfig.due_date) {
    if (!targetConfig.due_date) return '-';
    try {
      const parts = targetConfig.due_date.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return targetConfig.due_date;
    } catch {
      return targetConfig.due_date;
    }
  }

  if (measurementType === 'rating' || targetConfig.scale !== undefined) {
    const tgt = targetConfig.target ?? targetConfig.value ?? '?';
    const scl = targetConfig.scale ?? 5;
    return `${tgt} / ${scl} điểm`;
  }

  if (measurementType === 'percentage') {
    return targetConfig.value !== undefined ? `${targetConfig.value}%` : '-';
  }

  if (measurementType === 'currency') {
    return targetConfig.value !== undefined
      ? `${Number(targetConfig.value).toLocaleString('vi-VN')}${unit || ' VNĐ'}`
      : '-';
  }

  if (targetConfig.value !== undefined) {
    return `${targetConfig.value}${unit}`;
  }

  return JSON.stringify(targetConfig);
}
