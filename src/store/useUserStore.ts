import { create } from 'zustand';
import { mockBadges } from '../mocks/badges.mock';
import { getUserProfile } from '../services/userService';
import type { User } from '../types/models';
import { localDayKey } from '../utils/togetherStreak';

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

// claude.md §4: freezes are earned at streak milestones into a capped
// stockpile.
const FREEZE_EVERY_N_DAYS = 7;
const MAX_FREEZES = 3;

const XP_BADGES = mockBadges.filter((b) => b.criteriaType === 'total_xp');

// Badges whose XP threshold was crossed going from `before` to `after` —
// awarded once on the cross, never re-evaluated (claude.md §4).
function newlyEarnedXpBadges(user: User, before: number, after: number): string[] {
  return XP_BADGES.filter(
    (b) => before < b.criteriaValue && after >= b.criteriaValue && !user.badgeIds.includes(b._id)
  ).map((b) => b._id);
}

// If exactly one day was missed (last active the day before yesterday)
// and a freeze is in the stockpile, spend it: the streak survives and the
// missed day counts as covered. Two+ missed days are past what one freeze
// covers, so nothing happens.
function applyStreakFreeze(user: User): User {
  const last = user.streak.lastActiveDate;
  if (!last || user.streak.current === 0 || user.streak.freezesAvailable === 0) return user;
  const dayBeforeYesterday = new Date();
  dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
  if (localDayKey(new Date(last)) !== localDayKey(dayBeforeYesterday)) return user;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return {
    ...user,
    streak: {
      ...user.streak,
      freezesAvailable: user.streak.freezesAvailable - 1,
      freezesUsed: user.streak.freezesUsed + 1,
      lastActiveDate: yesterday.toISOString(),
    },
  };
}

export const useUserStore = create<UserStoreState>((set, get) => ({
  user: null,
  isLoading: false,
  refresh: async () => {
    set({ isLoading: true });
    const user = await getUserProfile();
    // Phase 2 runs this check server-side on the streak job; Phase 1 does
    // it on load so the freeze-saved notification has something to report.
    set({ user: applyStreakFreeze(user), isLoading: false });
  },
  addPoints: (amount) =>
    set((state) => (state.user ? { user: { ...state.user, points: state.user.points + amount } } : state)),
  recordSessionResult: ({ minutesLogged, targetHit, streakEligible }) => {
    const user = get().user;
    const streakBefore = user?.streak.current ?? 0;
    if (!user) return { pointsEarned: 0, streakBefore: 0, streakAfter: 0 };

    const pointsEarned = minutesLogged * XP_PER_MINUTE + (targetHit ? TARGET_HIT_BONUS : 0);
    const streakAfter = streakEligible ? streakBefore + 1 : streakBefore;
    const hitFreezeMilestone = streakAfter > streakBefore && streakAfter % FREEZE_EVERY_N_DAYS === 0;
    const pointsAfter = user.points + pointsEarned;

    set({
      user: {
        ...user,
        points: pointsAfter,
        badgeIds: [...user.badgeIds, ...newlyEarnedXpBadges(user, user.points, pointsAfter)],
        streak: {
          ...user.streak,
          current: streakAfter,
          longest: Math.max(user.streak.longest, streakAfter),
          lastActiveDate: new Date().toISOString(),
          freezesAvailable: hitFreezeMilestone
            ? Math.min(MAX_FREEZES, user.streak.freezesAvailable + 1)
            : user.streak.freezesAvailable,
        },
      },
    });

    return { pointsEarned, streakBefore, streakAfter };
  },
}));
