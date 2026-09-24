import { create } from 'zustand';
import { getUserProfile } from '../services/userService';
import type { User } from '../types/models';

export interface SessionResultInput {
  minutesLogged: number;
  targetHit: boolean;
  streakEligible: boolean;
}

export interface SessionResultOutcome {
  pointsEarned: number;
  streakBefore: number;
  streakAfter: number;
}

interface UserStoreState {
  user: User | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  addPoints: (amount: number) => void;
  recordSessionResult: (input: SessionResultInput) => SessionResultOutcome;
}

// Points ledger is append-only per claude.md §4 — Phase 1 only tracks the
// running total on the user doc, not per-entry mock rows (Profile's
// history views use a separate static fixture rather than a live ledger).
const XP_PER_MINUTE = 2;
const TARGET_HIT_BONUS = 50;

export const useUserStore = create<UserStoreState>((set, get) => ({
  user: null,
  isLoading: false,
  refresh: async () => {
    set({ isLoading: true });
    const user = await getUserProfile();
    set({ user, isLoading: false });
  },
  addPoints: (amount) =>
    set((state) => (state.user ? { user: { ...state.user, points: state.user.points + amount } } : state)),
  recordSessionResult: ({ minutesLogged, targetHit, streakEligible }) => {
    const user = get().user;
    const streakBefore = user?.streak.current ?? 0;
    if (!user) return { pointsEarned: 0, streakBefore: 0, streakAfter: 0 };

    const pointsEarned = minutesLogged * XP_PER_MINUTE + (targetHit ? TARGET_HIT_BONUS : 0);
    const streakAfter = streakEligible ? streakBefore + 1 : streakBefore;

    set({
      user: {
        ...user,
        points: user.points + pointsEarned,
        streak: {
          ...user.streak,
          current: streakAfter,
          longest: Math.max(user.streak.longest, streakAfter),
          lastActiveDate: new Date().toISOString(),
        },
      },
    });

    return { pointsEarned, streakBefore, streakAfter };
  },
}));
