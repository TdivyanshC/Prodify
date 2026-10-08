// Timezone-aware day keys (docs/phase2-backend-architecture.md §5.4): every
// per-day rule uses the user's local day from `users.timezone`. Moves to
// packages/shared/rules/dayKey.ts when that package exists.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

function wallClock(instant: Date, tz: string) {
  const parts = Object.fromEntries(formatter(tz).formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(instant: Date, tz: string): string {
  const w = wallClock(instant, tz);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

// Fractional local hour, e.g. 21.5 for 21:30.
export function localHour(instant: Date, tz: string): number {
  const w = wallClock(instant, tz);
  return w.hour + w.minute / 60;
}

function offsetMs(instant: Date, tz: string): number {
  const w = wallClock(instant, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// Local wall-clock time on a given day → instant. Two passes settle DST edges.
export function zonedTime(key: string, hour: number, minute: number, tz: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz);
  return new Date(t);
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function startOfDay(key: string, tz: string): Date {
  return zonedTime(key, 0, 0, tz);
}

// Monday of the key's week (recaps are Mon–Sun).
export function weekStart(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(key, -((weekday + 6) % 7));
}

export const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / MINUTE;
export const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * MINUTE);
