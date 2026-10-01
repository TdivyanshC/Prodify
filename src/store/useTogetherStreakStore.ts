import { create } from 'zustand';
import { mockTogetherStreaks } from '../mocks/togetherStreaks.mock';
import type { TogetherStreak } from '../types/social';
import { advanceTogetherStreak, getLiveTogetherStreak } from '../utils/togetherStreak';

export interface TogetherStreakChange {
  userId: string;
  before: number;
  after: number;
}

interface TogetherStreakStoreState {
  streaks: Record<string, TogetherStreak>;
  // Called when the user finishes a streak-eligible session in a space
  // with these friends present. Returns what changed for Post-Session.
  recordTogether: (friendIds: string[]) => TogetherStreakChange[];
}

export const useTogetherStreakStore = create<TogetherStreakStoreState>((set, get) => ({
  streaks: mockTogetherStreaks,
  recordTogether: (friendIds) => {
    const streaks = { ...get().streaks };
    const changes = friendIds.map((userId) => {
      const before = getLiveTogetherStreak(streaks[userId]);
      streaks[userId] = advanceTogetherStreak(streaks[userId]);
      return { userId, before, after: getLiveTogetherStreak(streaks[userId]) };
    });
    set({ streaks });
    return changes;
  },
}));
