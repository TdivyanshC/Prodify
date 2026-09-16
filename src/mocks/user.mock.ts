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
  badgeIds: ['badge_streak_7', 'badge_early_bird'],
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
  lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
};
