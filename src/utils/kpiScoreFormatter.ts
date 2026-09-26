export function formatScoreStatus(status: string, reason?: string | null): string {
  if (status === 'scored') return 'Đã tính';
  if (status === 'not_scored' && reason === 'actual_not_available') return 'Chưa có dữ liệu Actual';
  if (status === 'not_scored' && reason === 'assignment_draft') return 'Bản nháp';
  if (status === 'not_scored' && reason === 'access_denied') return 'Không có quyền truy cập';
  if (reason === 'invalid_target') return 'Target không hợp lệ';
  if (reason === 'invalid_config') return 'Cấu hình tính điểm không hợp lệ';
  if (reason === 'unsupported_method') return 'Phương pháp tính điểm chưa được hỗ trợ';
  return status;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${Number(value).toFixed(2).replace(/\.00$/, '')}%`;
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return Number(value).toFixed(2).replace(/\.00$/, '');
}
