// All app dates are plain YYYY-MM-DD calendar dates. Doing the arithmetic in
// UTC keeps the Worker (which always runs in UTC) and the browser in agreement.

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
}

/** Monday-start week, matching the Laravel calendar. */
export function startOfWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return addDays(date, -sinceMonday);
}

export function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayName(date: string): string {
  return DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function dayNumber(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDate();
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "7 July 2026" */
export function formatLongDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Mon 7 Jul" */
export function formatShortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;
}

/** "7 Jul" — PHP format('j M') */
export function formatDayMonth(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;
}

/** "12 Jul 2026" — PHP format('j M Y') */
export function formatDayMonthYear(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${formatDayMonth(date)} ${d.getUTCFullYear()}`;
}

/** "Mon 7" — PHP format('D j') */
export function formatWeekdayDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()}`;
}

/** Weekday abbreviation "Mon" — PHP format('D') */
export function weekdayShort(date: string): string {
  return DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()].slice(0, 3);
}
