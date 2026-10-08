import type { Badge, Friendship, Session, SessionCategory, User } from '../types/models';
import type { AppNotification, FriendProfile, SpaceInvite, TogetherStreak } from '../types/social';

// Response shapes of the Phase 2 API (server/src/modules/**/routes.ts).

export interface AuthSessionResponse {
  user: User;
  isNew: boolean;
}

// POST /auth/google — same as above plus this device's Prodify session token.
export interface GoogleSignInResponse extends AuthSessionResponse {
  token: string;
}

export interface HomeSummary {
  todayMinutes: number;
  dailyTargetMin: number;
  xpToday: number;
  sessionsCompletedTotal: number;
  openSession: { _id: string; spaceId: string | null; startTime: string; targetDurationMin: number } | null;
  focusingFriends: { userId: string; spaceId: string; spaceName: string; joinedAt: string }[];
}

export interface SpacesFeed {
  spaces: Session[];
  invites: SpaceInvite[];
  togetherStreaks: Record<string, TogetherStreak>;
  friendAlertIds: string[];
  reminderSpaceIds: string[];
  serverTime: string;
}

export interface SpaceActionResponse {
  space: Session;
  session: { _id: string } | null;
  switchedFrom: SessionCloseResult | null;
}

// What every session close returns (backend doc §7.3) — Post-Session
// renders it instead of computing rewards on the client.
export interface SessionCloseResult {
  session: {
    _id: string;
    spaceId: string | null;
    categoryId: string;
    durationMin: number;
    targetDurationMin: number;
    targetHit: boolean;
    xpEarned: number;
    closedReason: string;
  };
  day: { dayKey: string; totalMinutes: number; dailyTargetMin: number; credited: boolean; creditedNow: boolean };
  streak: { before: number; after: number; freezesAvailable: number; freezeEarned: boolean };
  xp: { before: number; after: number; levelBefore: number; levelAfter: number };
  badgesEarned: { _id: string; name: string; icon: string; description: string }[];
  togetherStreaks: { userId: string; displayName: string; days: number; grew: boolean }[];
  heldNotifications: AppNotification[];
}

export interface FriendshipsResponse {
  friendships: Friendship[];
  profiles: FriendProfile[];
  togetherStreaks: Record<string, TogetherStreak>;
}

export interface ProfileResponse {
  profile: FriendProfile;
  stats: { points: number; level: number; sessionsCompleted: number; badgeIds: string[]; friends: number };
  socialHandles: Record<string, string>;
  relationship: {
    status: 'self' | 'none' | 'friends' | 'pending_out' | 'pending_in';
    friendshipId: string | null;
    since: string | null;
    togetherStreak: TogetherStreak | null;
    alertOn: boolean;
  };
}

export interface DayMinutes {
  date: string;
  day: string;
  minutes: number;
}

export interface StatsResponse {
  range: 'week' | 'month';
  days: DayMinutes[];
  totalMinutes: number;
  byCategory: { categoryId: string; minutes: number }[];
}

export interface ActivityResponse {
  items: { date: string; totalMinutes: number }[];
  today: string;
  dailyTargetMin: number;
  createdAt: string;
}

export interface WeeklyRecapResponse {
  weekStart: string;
  totalMinutes: number;
  days: DayMinutes[];
  bestDay: DayMinutes;
  topCategoryId: string | null;
  sessionsCompleted: number;
  spacesJoined: number;
  focusedWithFriendIds: string[];
  cheersReceived: number;
  xpEarned: number;
}

export interface NotificationSettings {
  categories: Record<'spaces' | 'friends' | 'progress' | 'nudges', boolean>;
  quietHours: { enabled: boolean; startHour: number; endHour: number };
  dailyToastCap: number;
}

export interface Paged<T> {
  items: T[];
  nextCursor: string | null;
}

export type CategoriesResponse = { items: SessionCategory[] };
export type BadgesResponse = { items: Badge[] };

export interface AchievementItem {
  badge: Badge;
  earned: boolean;
  earnedAt: string | null;
  progress: { current: number; target: number };
}
export interface AchievementsResponse {
  items: AchievementItem[];
  earnedCount: number;
}

export interface SessionHistoryItem {
  _id: string;
  categoryId: string;
  spaceId: string | null;
  spaceName: string | null;
  type: 'solo' | 'space';
  startTime: string;
  endTime: string | null;
  durationMin: number;
  targetDurationMin: number;
  status: 'active' | 'closing' | 'completed';
  targetHit: boolean;
  xpEarned: number;
}

export interface DevAccount {
  firebaseUid: string;
  displayName: string;
  handle: string | null;
}
