/**
 * Centralized school date utilities for SIUBA (Asia/Jakarta / WIB).
 */

export const SCHOOL_TIMEZONE = 'Asia/Jakarta';

/**
 * Returns today's date in YYYY-MM-DD format using Asia/Jakarta (WIB) timezone.
 */
export function getSchoolTodayDate(date: Date = new Date()): string {
  return date.toLocaleDateString('sv-SE', {
    timeZone: SCHOOL_TIMEZONE,
  }).split(' ')[0];
}

/**
 * Validates whether a string is in YYYY-MM-DD format and represents a valid date.
 */
export function isValidDateFormat(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Checks if the given date string (YYYY-MM-DD) is in the future relative to Asia/Jakarta today.
 */
export function isFutureDate(dateStr: string, referenceDate?: Date): boolean {
  const today = getSchoolTodayDate(referenceDate);
  return dateStr > today;
}

/**
 * Formats a YYYY-MM-DD date into human-readable Indonesian format,
 * e.g., "Selasa, 15 September 2026".
 */
export function formatIndonesianDate(dateStr: string): string {
  if (!isValidDateFormat(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
