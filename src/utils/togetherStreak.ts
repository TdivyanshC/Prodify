import type { TogetherStreak } from '../types/social';

export function localDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDayKey(d);
}

// A together streak is only "alive" if the last shared day was today or
// yesterday — otherwise the stored count is stale and reads as 0.
export function getLiveTogetherStreak(streak: TogetherStreak | undefined): number {
  if (!streak?.lastTogetherDate) return 0;
  const last = streak.lastTogetherDate;
  return last === localDayKey() || last === yesterdayKey() ? streak.current : 0;
}

// Applies one more shared day. Idempotent within a day — finishing three
// spaces with the same friend today still counts today once.
export function advanceTogetherStreak(streak: TogetherStreak | undefined): TogetherStreak {
  const today = localDayKey();
  const alive = getLiveTogetherStreak(streak);
  if (streak?.lastTogetherDate === today) return streak;
  const current = alive + 1;
  return { current, longest: Math.max(streak?.longest ?? 0, current), lastTogetherDate: today };
}
