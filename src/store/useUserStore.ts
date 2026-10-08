import { create } from 'zustand';
import type { ActivityResponse, HomeSummary, StatsResponse } from '../api/types';
import { getActivity, getHomeSummary, getStats, getUserProfile } from '../services/userService';
import type { User } from '../types/models';

interface UserStoreState {
  user: User | null;
  // Home's daily tracker + gamification card (GET /me/summary).
  summary: HomeSummary | null;
  // Profile's consistency heatmap + weekly chart.
  activity: ActivityResponse | null;
  weekStats: StatsResponse | null;
  isLoading: boolean;
  setUser: (user: User) => void;
  refresh: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  loadProgress: () => Promise<void>;
}

// The signed-in user. XP, streaks, freezes, badges and levels are computed
// by the server's session-close transaction (backend doc §7.3) and pushed
// back via `progress:updated` — the client never awards anything itself.
export const useUserStore = create<UserStoreState>((set) => ({
  user: null,
  summary: null,
  activity: null,
  weekStats: null,
  isLoading: false,
  setUser: (user) => set({ user }),
  refresh: async () => {
    set({ isLoading: true });
    try {
      const [user, summary] = await Promise.all([getUserProfile(), getHomeSummary()]);
      set({ user, summary });
    } finally {
      set({ isLoading: false });
    }
  },
  refreshSummary: async () => {
    set({ summary: await getHomeSummary() });
  },
  loadProgress: async () => {
    const [activity, weekStats] = await Promise.all([getActivity(), getStats('week')]);
    set({ activity, weekStats });
  },
}));
