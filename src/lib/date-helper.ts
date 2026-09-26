import { PublicSettings } from '../services/system-settings.service';

export function formatAppDate(date: string | Date | null | undefined, settings?: PublicSettings | null): string {
  if (!date) return '---';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '---';

  const locale = settings?.locale || 'vi-VN';
  const timeZone = settings?.timezone || 'Asia/Ho_Chi_Minh';
  
  // Custom parsing could be implemented here based on settings.dateFormat 
  // but toLocaleDateString handles locale-specific formatting safely.
  try {
    return d.toLocaleDateString(locale, { timeZone });
  } catch (err) {
    return d.toLocaleDateString('vi-VN');
  }
}

export function formatAppDateTime(date: string | Date | null | undefined, settings?: PublicSettings | null): string {
  if (!date) return '---';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '---';

  const locale = settings?.locale || 'vi-VN';
  const timeZone = settings?.timezone || 'Asia/Ho_Chi_Minh';

  try {
    return d.toLocaleString(locale, { timeZone });
  } catch (err) {
    return d.toLocaleString('vi-VN');
  }
}
