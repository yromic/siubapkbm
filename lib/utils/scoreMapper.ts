/**
 * scoreMapper.ts
 * Centralized source of truth for translating daily culture indicator scores
 * between Database representation (0 or 0.00 = Unset/Not Assessed)
 * and UI/React state representation (null = Unset/Not Assessed).
 */

/**
 * Translates a database score value (e.g. 0, "0.00", null, undefined)
 * to a UI state value (1-4 or null).
 */
export function dbScoreToUi(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  if (isNaN(num) || num <= 0) return null;
  return Math.floor(num);
}

/**
 * Translates a UI state value (1-4 or null)
 * to a database-safe payload score (1-4 or null).
 */
export function uiScoreToDb(val: number | null): number | null {
  if (val === undefined || val === null || val <= 0) return null;
  return val;
}
