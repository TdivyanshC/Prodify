import { FREEZE_EVERY_N_DAYS, MAX_FREEZES, STREAK_MILESTONES } from './rules';
import { addDays } from './time';

// Pure streak / together-streak / badge transitions (backend doc §7.3–§7.5).
// The live session-close transaction, the dayRollover job and the seed
// replay all call these, so the three can never disagree.

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDate: string | null; // last credited (or frozen) local day
  freezesAvailable: number;
  freezesUsed: number;
  lastFreezeDate: string | null; // day a freeze covered — a freeze never chains into a second one
}

export type StreakEvent =
  | { type: 'freeze_earned'; streak: number; count: number }
  | { type: 'freeze_used'; streak: number; freezesUsed: number }
  | { type: 'streak_milestone'; streak: number };

export const emptyStreak = (): StreakState => ({
  current: 0,
  longest: 0,
  lastActiveDate: null,
  freezesAvailable: 0,
  freezesUsed: 0,
  lastFreezeDate: null,
});

// The day's total just reached the credit threshold. Idempotent per day.
export function creditDay(s: StreakState, day: string): { next: StreakState; events: StreakEvent[]; credited: boolean } {
  if (s.lastActiveDate === day) return { next: s, events: [], credited: false };
  const current = s.lastActiveDate === addDays(day, -1) ? s.current + 1 : 1;
  const next: StreakState = { ...s, current, longest: Math.max(s.longest, current), lastActiveDate: day };
  const events: StreakEvent[] = [];
  if (current % FREEZE_EVERY_N_DAYS === 0 && next.freezesAvailable < MAX_FREEZES) {
    next.freezesAvailable += 1;
    events.push({ type: 'freeze_earned', streak: current, count: next.freezesAvailable });
  }
  if (STREAK_MILESTONES.includes(current)) events.push({ type: 'streak_milestone', streak: current });
  return { next, events, credited: true };
}

// A local day just ended. Credited → nothing. Exactly one missed day after
// a credited one, with a freeze in stock → spend it. Otherwise the streak
// is broken and `current` resets, so stored streaks are always live.
export function rolloverDay(s: StreakState, day: string): { next: StreakState; events: StreakEvent[] } {
  if (s.lastActiveDate === day) return { next: s, events: [] };
  const prev = addDays(day, -1);
  if (s.current > 0 && s.lastActiveDate === prev && s.lastFreezeDate !== prev && s.freezesAvailable > 0) {
    const next = {
      ...s,
      freezesAvailable: s.freezesAvailable - 1,
      freezesUsed: s.freezesUsed + 1,
      lastActiveDate: day,
      lastFreezeDate: day,
    };
    return { next, events: [{ type: 'freeze_used', streak: s.current, freezesUsed: next.freezesUsed }] };
  }
  return { next: s.current === 0 ? s : { ...s, current: 0 }, events: [] };
}

export interface TogetherState {
  current: number;
  longest: number;
  lastTogetherDay: string;
}

// One more shared day; null = already counted today (no write needed).
export function advanceTogether(pair: TogetherState | null, day: string): TogetherState | null {
  if (pair?.lastTogetherDay === day) return null;
  const alive = pair && pair.lastTogetherDay === addDays(day, -1) ? pair.current : 0;
  const current = alive + 1;
  return { current, longest: Math.max(pair?.longest ?? 0, current), lastTogetherDay: day };
}

// What a client should display: stale pairs read as 0.
export function liveTogether(pair: TogetherState | null | undefined, today: string): number {
  if (!pair) return 0;
  return pair.lastTogetherDay === today || pair.lastTogetherDay === addDays(today, -1) ? pair.current : 0;
}

export interface BadgeDef {
  _id: string;
  criteriaType: string;
  criteriaValue: number;
}

// Threshold-cross only (CLAUDE.md §4): before < value ≤ after.
export function crossedBadges(catalog: BadgeDef[], criteria: string, before: number, after: number, held: string[]): string[] {
  return catalog
    .filter((b) => b.criteriaType === criteria && before < b.criteriaValue && after >= b.criteriaValue && !held.includes(b._id))
    .map((b) => b._id);
}
