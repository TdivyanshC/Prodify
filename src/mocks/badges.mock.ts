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
  // XP tiers — claude.md §4: badges at 1,000 / 5,000 / 10,000 total XP,
  // awarded on threshold-cross. Names are the placeholders from
  // docs/phase2-database-design.md §2.
  {
    _id: 'badge_xp_1000',
    name: 'Rising Flame',
    description: 'Earned 1,000 XP.',
    criteriaType: 'total_xp',
    criteriaValue: 1000,
    icon: '🔥',
  },
  {
    _id: 'badge_xp_5000',
    name: 'Steady Blaze',
    description: 'Earned 5,000 XP.',
    criteriaType: 'total_xp',
    criteriaValue: 5000,
    icon: '☄️',
  },
  {
    _id: 'badge_xp_10000',
    name: 'Inferno',
    description: 'Earned 10,000 XP.',
    criteriaType: 'total_xp',
    criteriaValue: 10000,
    icon: '🌋',
  },
];
