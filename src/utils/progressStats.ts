import { useUserStore } from '../store/useUserStore';

// Today's focused minutes vs. target — from GET /me/summary, which reads
// `userDailyTotal` + `users.dailyTargetMin` server-side.
export function getTodayProgress() {
  const summary = useUserStore.getState().summary;
  return { minutes: summary?.todayMinutes ?? 0, target: summary?.dailyTargetMin ?? 0 };
}

export const roundUpTo5 = (minutes: number) => Math.max(5, Math.ceil(minutes / 5) * 5);
