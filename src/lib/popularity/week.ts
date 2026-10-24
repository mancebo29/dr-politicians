// Ranking weeks run Monday to Monday in America/Santo_Domingo, which is
// UTC−4 all year (no daylight saving), so a fixed offset is exact.
const DR_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Week = { weekStart: string; from: Date; to: Date };

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Calendar date in the DR for an instant.
export function drDate(at: Date): string {
  return isoDate(new Date(at.getTime() - DR_OFFSET_MS));
}

export function addDays(date: string, days: number): string {
  return isoDate(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS));
}

export function isMonday(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
}

// The 7-day window [from, to) that starts on Monday `weekStart`, DR time.
export function weekOf(weekStart: string): Week {
  if (!isMonday(weekStart)) throw new Error(`${weekStart} is not a Monday`);
  const from = new Date(Date.parse(`${weekStart}T00:00:00Z`) + DR_OFFSET_MS);
  return { weekStart, from, to: new Date(from.getTime() + 7 * DAY_MS) };
}

// The last full week before `now`: run on a Monday, it is the week that just ended.
export function lastCompletedWeek(now: Date): Week {
  const today = drDate(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const thisMonday = addDays(today, -((weekday + 6) % 7));
  return weekOf(addDays(thisMonday, -7));
}
