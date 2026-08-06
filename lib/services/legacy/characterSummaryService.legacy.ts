/**
 * LEGACY SERVICE
 *
 * Replaced by:
 * - utsmanCalculationService
 * - fitrahSummary API
 *
 * Kept for historical reference.
 */
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import { Decimal } from 'decimal.js';

/**
 * @deprecated
 * This function queries character_semester_summaries, character_weekly_summaries, and
 * character_monthly_summaries — all of which were DROPPED in migration 20260805220000.
 *
 * DO NOT CALL THIS FUNCTION. It will throw immediately.
 * Use utsmanCalculationService.calculateAndSaveUTSMAN() instead.
 */
export async function calculateAndGetSemesterSummary(
  studentId: string,
  academicYearId: string,
  semesterId: string,
  refresh = false
) {
  throw new AppError(
    'calculateAndGetSemesterSummary is deprecated. Use utsmanCalculationService.calculateAndSaveUTSMAN().',
    'ERR_DEPRECATED',
    500
  );
}

export function calculateSummaryFromScores(scores: any[]) {
  let sss_sum = new Decimal(0);
  let sss_count = 0;
  let am_sum = new Decimal(0);
  let am_count = 0;
  let hb_sum = new Decimal(0);
  let hb_count = 0;
  let asm_sum = new Decimal(0);
  let asm_count = 0;
  let br_sum = new Decimal(0);
  let br_count = 0;
  let ak_sum = new Decimal(0);
  let ak_count = 0;
  let tm_sum = new Decimal(0);
  let tm_count = 0;

  const uniqueDates = new Set<string>();

  for (const s of scores) {
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(s.score_date);
    uniqueDates.add(dateStr);

    if (s.sss_score !== null && s.sss_score !== undefined) {
      const val = Number(s.sss_score);
      if (val > 0) {
        sss_sum = sss_sum.plus(new Decimal(val));
        sss_count++;
      }
    }
    if (s.am_score !== null && s.am_score !== undefined) {
      const val = Number(s.am_score);
      if (val > 0) {
        am_sum = am_sum.plus(new Decimal(val));
        am_count++;
      }
    }
    if (s.hb_score !== null && s.hb_score !== undefined) {
      const val = Number(s.hb_score);
      if (val > 0) {
        hb_sum = hb_sum.plus(new Decimal(val));
        hb_count++;
      }
    }
    if (s.asm_score !== null && s.asm_score !== undefined) {
      const val = Number(s.asm_score);
      if (val > 0) {
        asm_sum = asm_sum.plus(new Decimal(val));
        asm_count++;
      }
    }
    if (s.br_score !== null && s.br_score !== undefined) {
      const val = Number(s.br_score);
      if (val > 0) {
        br_sum = br_sum.plus(new Decimal(val));
        br_count++;
      }
    }
    if (s.ak_score !== null && s.ak_score !== undefined) {
      const val = Number(s.ak_score);
      if (val > 0) {
        ak_sum = ak_sum.plus(new Decimal(val));
        ak_count++;
      }
    }
    if (s.tm_score !== null && s.tm_score !== undefined) {
      const val = Number(s.tm_score);
      if (val > 0) {
        tm_sum = tm_sum.plus(new Decimal(val));
        tm_count++;
      }
    }
  }

  const days_counted = uniqueDates.size;

  const f_score = asm_count > 0 ? asm_sum.dividedBy(asm_count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0;
  const i_score = am_count > 0 ? am_sum.dividedBy(am_count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0;
  const t_score = br_count > 0 ? br_sum.dividedBy(br_count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0;

  const avg_sss = sss_count > 0 ? sss_sum.dividedBy(sss_count) : null;
  const avg_hb = hb_count > 0 ? hb_sum.dividedBy(hb_count) : null;

  let r_score = 0;
  if (avg_sss !== null && avg_hb !== null) {
    r_score = avg_sss.plus(avg_hb).dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  } else if (avg_sss !== null) {
    r_score = avg_sss.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  } else if (avg_hb !== null) {
    r_score = avg_hb.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  const a_score = ak_count > 0 ? ak_sum.dividedBy(ak_count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0;
  const h_score = tm_count > 0 ? tm_sum.dividedBy(tm_count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0;

  return {
    f_score,
    i_score,
    t_score,
    r_score,
    a_score,
    h_score,
    sss_sum: sss_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    sss_count,
    am_sum: am_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    am_count,
    hb_sum: hb_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    hb_count,
    asm_sum: asm_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    asm_count,
    br_sum: br_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    br_count,
    ak_sum: ak_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    ak_count,
    tm_sum: tm_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    tm_count,
    days_counted
  };
}

export function groupScoresByWeek(scores: any[]) {
  const groups: Record<string, { week_start_date: Date; week_end_date: Date; scores: any[] }> = {};

  for (const s of scores) {
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(s.score_date);

    const [y, m, d] = dateStr.split('-').map(Number);
    const localDate = new Date(y, m - 1, d);
    
    const monday = new Date(localDate);
    monday.setDate(localDate.getDate() - (localDate.getDay() === 0 ? 6 : localDate.getDay() - 1));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const key = monday.toISOString().split('T')[0];
    if (!groups[key]) {
      groups[key] = {
        week_start_date: monday,
        week_end_date: sunday,
        scores: []
      };
    }
    groups[key].scores.push(s);
  }

  return Object.values(groups);
}

export function groupScoresByMonth(scores: any[]) {
  const groups: Record<string, { summary_month: number; summary_year: number; scores: any[] }> = {};

  for (const s of scores) {
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(s.score_date);

    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(5, 7), 10);
    const key = `${year}-${month}`;

    if (!groups[key]) {
      groups[key] = {
        summary_month: month,
        summary_year: year,
        scores: []
      };
    }
    groups[key].scores.push(s);
  }

  return Object.values(groups);
}
