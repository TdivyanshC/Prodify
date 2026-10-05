import { mockHomeStats } from '../mocks/homeStats.mock';
import { mockSessionCategories } from '../mocks/sessionCategories.mock';
import { mockWeeklyActivity } from '../mocks/weeklyActivity.mock';
import { mockWeeklyRecapExtras } from '../mocks/weeklyRecap.mock';
import type { SessionCategory } from '../types/models';
import { formatMinutes } from './sessionHelpers';

// Today's focused minutes vs. target — Phase 2 reads both from
// `userDailyTotal` + `users.dailyTargetMin`.
export function getTodayProgress() {
  return { minutes: mockHomeStats.productiveMinutesToday, target: mockHomeStats.dailyTargetMinutes };
}

export const roundUpTo5 = (minutes: number) => Math.max(5, Math.ceil(minutes / 5) * 5);

export interface WeeklyRecap {
  totalMinutes: number;
  totalLabel: string;
  bestDay: { day: string; minutes: number };
  days: { day: string; minutes: number }[];
  topCategory: SessionCategory | undefined;
  sessionsCompleted: number;
  spacesJoined: number;
  focusedWithFriendIds: string[];
  cheersReceived: number;
}

export function getWeeklyRecap(): WeeklyRecap {
  const totalMinutes = mockWeeklyActivity.reduce((sum, d) => sum + d.minutes, 0);
  const bestDay = mockWeeklyActivity.reduce((best, d) => (d.minutes > best.minutes ? d : best));
  return {
    totalMinutes,
    totalLabel: formatMinutes(totalMinutes),
    bestDay,
    days: mockWeeklyActivity,
    topCategory: mockSessionCategories.find((c) => c._id === mockWeeklyRecapExtras.topCategoryId),
    sessionsCompleted: mockWeeklyRecapExtras.sessionsCompleted,
    spacesJoined: mockWeeklyRecapExtras.spacesJoined,
    focusedWithFriendIds: mockWeeklyRecapExtras.focusedWithFriendIds,
    cheersReceived: mockWeeklyRecapExtras.cheersReceived,
  };
}
