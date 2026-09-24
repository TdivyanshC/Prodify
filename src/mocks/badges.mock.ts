import type { Badge } from '../types/models';

// Badge catalog (claude.md §5: "static-ish catalog collection, config-driven
// so new badges don't need a deploy"). mockUser.badgeIds references the
// first two as earned; the rest render locked/greyed on Profile & the
// Achievements screen to give the badge row somewhere to grow toward.
export const mockBadges: Badge[] = [
  {
    _id: 'badge_streak_7',
    name: '7-Day Streak',
    description: 'Kept your streak alive for a full week.',
    criteriaType: 'streak',
    criteriaValue: 7,
    icon: '🔥',
  },
  {
    _id: 'badge_early_bird',
    name: 'Early Bird',
    description: 'Completed 5 sessions before 9am.',
    criteriaType: 'early_sessions',
    criteriaValue: 5,
    icon: '🌅',
  },
  {
    _id: 'badge_streak_30',
    name: '30-Day Streak',
    description: 'A full month without missing a day.',
    criteriaType: 'streak',
    criteriaValue: 30,
    icon: '🏆',
  },
  {
    _id: 'badge_night_owl',
    name: 'Night Owl',
    description: 'Completed 5 sessions after 10pm.',
    criteriaType: 'late_sessions',
    criteriaValue: 5,
    icon: '🌙',
  },
  {
    _id: 'badge_centurion',
    name: 'Centurion',
    description: 'Completed 100 sessions total.',
    criteriaType: 'sessions_completed',
    criteriaValue: 100,
    icon: '💯',
  },
  {
    _id: 'badge_social_butterfly',
    name: 'Social Butterfly',
    description: 'Made 10 friends on Prodify.',
    criteriaType: 'friend_count',
    criteriaValue: 10,
    icon: '🦋',
  },
];
