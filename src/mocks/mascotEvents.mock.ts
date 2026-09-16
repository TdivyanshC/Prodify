import type { MascotEvent } from '../types/models';

// All events below are undelivered by default, so mascotService's priority
// logic has a real candidate at every tier to choose from — streak_at_risk
// should win. Set an event's deliveredAt to a non-null ISO string to remove
// it from contention and see the next tier surface instead.
export const mockMascotEvents: MascotEvent[] = [
  {
    _id: 'mevt_streak_at_risk',
    userId: 'user_local_1',
    eventType: 'streak_at_risk',
    payload: { hoursRemaining: 5 },
    priority: 1,
    deliveredAt: null,
    sourceService: 'mock',
  },
  {
    _id: 'mevt_badge_earned',
    userId: 'user_local_1',
    eventType: 'badge_earned',
    payload: { badgeId: 'badge_streak_7' },
    priority: 2,
    deliveredAt: null,
    sourceService: 'mock',
  },
  {
    _id: 'mevt_level_up',
    userId: 'user_local_1',
    eventType: 'level_up',
    payload: { newLevel: 5 },
    priority: 2,
    deliveredAt: null,
    sourceService: 'mock',
  },
  {
    _id: 'mevt_friend_achievement',
    userId: 'user_local_1',
    eventType: 'friend_achievement',
    payload: { friendName: 'Aman', achievement: '30-day streak' },
    priority: 3,
    deliveredAt: null,
    sourceService: 'mock',
  },
  {
    _id: 'mevt_welcome_back',
    userId: 'user_local_1',
    eventType: 'welcome_back',
    payload: { daysInactive: 4 },
    priority: 4,
    deliveredAt: null,
    sourceService: 'mock',
  },
  {
    _id: 'mevt_generic_encouragement',
    userId: 'user_local_1',
    eventType: 'generic_encouragement',
    payload: {},
    priority: 5,
    deliveredAt: null,
    sourceService: 'mock',
  },
  {
    _id: 'mevt_idle',
    userId: 'user_local_1',
    eventType: 'idle',
    payload: {},
    priority: 6,
    deliveredAt: null,
    sourceService: 'mock',
  },
];
