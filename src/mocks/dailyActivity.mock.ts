import { mockHomeStats } from './homeStats.mock';

// Backs the Profile "consistency" heatmap (GitHub/LeetCode-style grid).
// Shape mirrors the planned `userDailyTotal` rollup (docs/phase2-database-
// design.md §5/§6 — one doc per user per day, `totalMinutes` compared
// against `users.dailyTargetMin`) rather than inventing a new shape —
// swapping this fixture for a real `GET /users/me/daily-activity` call in
// Phase 2 is a drop-in, the UI just needs {date, totalMinutes} pairs.
//
// Trailing 4-month window (like GitHub's own heatmap is a trailing 12
// months, not calendar-aligned) — kept in sync with user.mock's
// `createdAt`, which was moved back to match, so the grid never implies
// history from before the account existed. The tail is hand-placed, not
// random, so it agrees with the other mock numbers already on this
// screen: the last 6 days before today are all "complete" (matches
// user.mock's streak.current: 6), today reuses homeStats.mock's
// productiveMinutesToday (165 of a 180 target — still in progress, not
// yet complete), and a 14-day complete run sits earlier to justify
// streak.longest: 14. A single "none" day separates each streak block
// from the next, consistent with user.mock's freezesUsed: 2 (the streak
// was broken/frozen, not one unbroken run). Everything else is a small
// deterministic (non-Math.random) mix for texture.
const RANGE_MONTHS = 4;
export interface DailyActivityEntry {
  date: string; // YYYY-MM-DD
  totalMinutes: number;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

// Deterministic pseudo-random int in [0, mod) — same LCG shape used
// elsewhere in the mocks/fixtures (see ChatWallpaper's pseudoRandom) so
// fixture output is stable across reloads instead of reshuffling.
function seeded(seed: number, mod: number): number {
  return Math.abs((seed * 9301 + 49297) % 233280) % mod;
}

const TARGET = mockHomeStats.dailyTargetMinutes;

const rangeStart = new Date();
rangeStart.setHours(0, 0, 0, 0);
rangeStart.setMonth(rangeStart.getMonth() - RANGE_MONTHS);
const TOTAL_DAYS = Math.round((Date.now() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));

function minutesFor(n: number): number {
  if (n === 0) return mockHomeStats.productiveMinutesToday; // today — in progress
  if (n >= 1 && n <= 6) return TARGET + 10 + seeded(n, 40); // current 6-day streak
  if (n === 7) return 0; // the break that resets the streak to 6
  if (n >= 8 && n <= 21) return TARGET + 5 + seeded(n * 3, 60); // the 14-day "longest streak" run
  if (n === 22) return 0; // gap before the older history

  // Older history: deterministic mix — ~40% none, ~30% partial, ~30% complete.
  const bucket = seeded(n * 17, 10);
  if (bucket < 4) return 0;
  if (bucket < 7) return 20 + seeded(n * 31, TARGET - 20);
  return TARGET + seeded(n * 13, 90);
}

export const mockDailyActivity: DailyActivityEntry[] = Array.from(
  { length: TOTAL_DAYS + 1 },
  (_, i) => {
    const n = TOTAL_DAYS - i; // oldest first, today last
    return { date: toISODate(daysAgo(n)), totalMinutes: minutesFor(n) };
  }
);
