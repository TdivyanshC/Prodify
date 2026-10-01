export type DayStatus = 'complete' | 'partial' | 'none';

// Mirrors the three cases the Profile consistency grid needs to show:
// hit the daily target, showed up but fell short (joined a session and
// left early, or logged some time without reaching it), or nothing at
// all that day. Deliberately not the same threshold as the locked
// streak-credit rule (claude.md §4's "≥50% still counts") — that rule
// decides whether a day counts toward the streak *number*; this decides
// what color a calendar cell gets, which is a looser "did they show up"
// signal.
export function getDayStatus(totalMinutes: number, targetMinutes: number): DayStatus {
  if (totalMinutes <= 0) return 'none';
  if (totalMinutes >= targetMinutes) return 'complete';
  return 'partial';
}
