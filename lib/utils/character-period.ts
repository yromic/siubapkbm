export type CharacterPeriodMode = "semester" | "month" | "week";

export interface CharacterPeriodFilter {     
  mode: CharacterPeriodMode;
  weekStartDate: string; // YYYY-MM-DD
  month: number; // 1-12
  year: number;
}

export const INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMondayOfDate(d: Date): Date {
  const target = new Date(d);
  const day = target.getDay();
  // If it's Sunday (0), day should be treated as 7 to get previous Monday
  const diff = target.getDate() - (day === 0 ? 6 : day - 1);
  target.setDate(diff);
  target.setHours(0, 0, 0, 0);
  return target;
}

export function getWeekRangeString(mondayStr: string | Date): string {
  const monday = typeof mondayStr === "string" ? new Date(mondayStr) : mondayStr;
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startDay = monday.getDate();
  const startMonth = INDONESIAN_MONTHS[monday.getMonth()];
  const startYear = monday.getFullYear();

  const endDay = sunday.getDate();
  const endMonth = INDONESIAN_MONTHS[sunday.getMonth()];
  const endYear = sunday.getFullYear();

  if (startYear !== endYear) {
    return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
  }
  if (startMonth !== endMonth) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
  }
  return `${startDay} – ${endDay} ${startMonth} ${startYear}`;
}

export function isFutureWeek(weekStartDate: string): boolean {
  const today = new Date();
  const currentWeekMonday = getMondayOfDate(today);
  const targetMonday = new Date(weekStartDate);
  return targetMonday > currentWeekMonday;
}

export function isFutureMonth(month: number, year: number): boolean {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  if (year > currentYear) return true;
  if (year === currentYear && month > currentMonth) return true;
  return false;
}

export function getPeriodParams(filter: CharacterPeriodFilter) {
  switch (filter.mode) {
    case "week":
      return { week_start_date: filter.weekStartDate };
    case "month":
      return { month: filter.month, year: filter.year };
    case "semester":
    default:
      return {};
  }
}
