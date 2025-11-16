import dayjs from 'dayjs';

/**
 * Format a date (string|Date|number) into MM/DD/YYYY or MM/DD/YYYY h:mm:ss A
 */
export function formatDate(d?: string | Date | number | null, includeTime = false): string {
  if (!d) return '';
  try {
    const dt = dayjs(d);
    if (!dt.isValid()) return String(d);
    return includeTime ? dt.format('MM/DD/YYYY h:mm:ss A') : dt.format('MM/DD/YYYY');
  } catch (e) {
    return String(d);
  }
}
