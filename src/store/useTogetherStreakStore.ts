import { create } from 'zustand';
import type { TogetherStreak } from '../types/social';

interface TogetherStreakStoreState {
  // Keyed by friend userId. Advanced only by the server's session-close
  // transaction (same space, ≥10 min overlap, day credited — backend doc §7.4).
  streaks: Record<string, TogetherStreak>;
  merge: (streaks: Record<string, TogetherStreak>) => void;
}

export const useTogetherStreakStore = create<TogetherStreakStoreState>((set) => ({
  streaks: {},
  merge: (streaks) => set((state) => ({ streaks: { ...state.streaks, ...streaks } })),
}));
