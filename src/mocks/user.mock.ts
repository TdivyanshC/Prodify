import type { User } from '../types/models';

export const mockUser: User = {
  _id: 'user_local_1',
  googleId: null,
  displayName: 'Simran',
  avatarUrl: '', // TODO: swap for a local asset or emoji avatar once Profile screen is built
  mascotStage: 2,
  streak: {
    current: 6,
    longest: 14,
    lastActiveDate: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    freezesAvailable: 1,
    freezesUsed: 2,
  },
  points: 1240,
  // badge_xp_1000 because points (1240) already crossed that tier.
  badgeIds: ['badge_streak_7', 'badge_early_bird', 'badge_xp_1000'],
  // Kept in sync with dailyActivity.mock's RANGE_MONTHS (4) so the Profile
  // consistency heatmap never implies activity from before the account
  // existed.
  createdAt: (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 4);
    return d.toISOString();
  })(),
  lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
};
