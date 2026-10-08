import type { ObjectId } from 'mongodb';
import type { StreakState } from '../lib/progress';

// Collection shapes (docs/phase2-database-design.md §2, 2026-10-05) as
// TypeScript types for the service layer AND as MongoDB $jsonSchema
// validators applied at collection creation — so a bad write is rejected
// by the database, not just by the API's zod schemas.
//
// Relationships (→ = references):
//   users ─┬─< sessions >── spaces >── sessionCategories
//          ├─< dailyStats / userDailyTotal / pointsLedger / weeklyRecaps   (rollups of sessions)
//          ├─< friendships >─ users      (canonical pair, userIdA < userIdB)
//          ├─< blocks >─ users, reports >─ users
//          ├─< togetherStreaks >─ users  (pair)
//          ├─< reactions (contextType space → spaces | milestone → string id) >─ users
//          ├─< notifications, mascotEvents, spaceReminders >─ spaces, authSessions
//          └─ badgeIds → badges
//   spaces.hostId → users, spaces.invitedUserIds[] → users

export type CategoryId = string; // 'cat_coding' …
export type BadgeId = string; // 'badge_xp_1000' …

export interface UserDoc {
  _id: ObjectId;
  googleId: string | null;
  firebaseUid: string;
  handle: string | null;
  email: string;
  authProvider: 'google';
  status: 'active' | 'suspended' | 'banned' | 'deleted';
  role: 'user' | 'moderator' | 'admin';
  displayName: string;
  avatarUrl: string;
  tagline: string;
  favoriteCategoryId: CategoryId | null;
  mascotStage: number;
  dailyTargetMin: number;
  timezone: string;
  socialHandles: Record<'instagram' | 'snapchat', { value: string | null; isVisible: boolean }>;
  streak: StreakState;
  rolloverThrough: string | null;
  points: number;
  level: number;
  badgeIds: BadgeId[];
  counters: { sessionsCompleted: number; earlySessions: number; lateSessions: number; friends: number };
  notificationPrefs: {
    categories: Record<'spaces' | 'friends' | 'progress' | 'nudges', boolean>;
    quietHours: { enabled: boolean; startHour: number; endHour: number };
    dailyToastCap: number;
    friendAlertIds: ObjectId[];
  };
  createdAt: Date;
  lastActiveAt: Date;
}

export interface CategoryDoc {
  _id: CategoryId;
  name: string;
  icon: string;
  sortOrder: number;
  isCustom: false;
  createdBy: null;
}

export interface BadgeDoc {
  _id: BadgeId;
  key: string;
  name: string;
  description: string;
  criteriaType: string;
  criteriaValue: number;
  icon: string;
}

export type SpaceStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface SpaceDoc {
  _id: ObjectId;
  categoryId: CategoryId;
  name: string;
  description: string | null;
  hostId: ObjectId | null;
  isPublic: boolean;
  maxParticipants: number | null;
  durationTargetMin: number;
  status: SpaceStatus;
  startTime: Date;
  endedAt: Date | null;
  invitedUserIds: ObjectId[];
  declinedUserIds: ObjectId[];
  liveCount: number;
  isBotSeeded: boolean;
  syntheticCount: number;
  createdAt: Date;
}

export interface SessionDoc {
  _id: ObjectId;
  userId: ObjectId;
  categoryId: CategoryId;
  spaceId: ObjectId | null;
  type: 'solo' | 'space';
  startTime: Date;
  endTime: Date | null;
  durationMin: number;
  targetDurationMin: number;
  status: 'active' | 'closing' | 'completed';
  closedReason: 'left' | 'completed' | 'timeout' | 'space_ended' | null;
  completed: boolean;
  targetHit: boolean;
  xpEarned: number;
  createdAt: Date;
}

export interface DailyStatsDoc {
  _id: ObjectId;
  userId: ObjectId;
  categoryId: CategoryId;
  date: string;
  totalMinutes: number;
  sessionCount: number;
  xpEarned: number;
}

export interface UserDailyTotalDoc {
  _id: ObjectId;
  userId: ObjectId;
  date: string;
  totalMinutes: number;
  xpEarned: number;
}

export interface LedgerDoc {
  _id: ObjectId;
  userId: ObjectId;
  source: 'session_complete' | 'badge';
  amount: number;
  sessionId: ObjectId | null;
  badgeId: BadgeId | null;
  timestamp: Date;
}

export interface FriendshipDoc {
  _id: ObjectId;
  userIdA: ObjectId;
  userIdB: ObjectId;
  status: 'pending' | 'accepted';
  requestedBy: ObjectId;
  createdAt: Date;
  respondedAt: Date | null;
}

export interface BlockDoc {
  _id: ObjectId;
  blockerId: ObjectId;
  blockedId: ObjectId;
  createdAt: Date;
}

export interface ReportDoc {
  _id: ObjectId;
  reporterId: ObjectId;
  reportedUserId: ObjectId;
  sessionId: ObjectId | null;
  spaceId: ObjectId | null;
  reason: string;
  createdAt: Date;
  status: 'open' | 'actioned' | 'dismissed';
}

export type ReactionType = 'clap' | 'fire' | 'fist_bump';

export interface ReactionDoc {
  _id: ObjectId;
  contextType: 'space' | 'milestone';
  contextId: ObjectId | string;
  fromUserId: ObjectId;
  toUserId: ObjectId;
  type: ReactionType;
  createdAt: Date;
}

export interface TogetherStreakDoc {
  _id: ObjectId;
  pairKey: string;
  userIds: [ObjectId, ObjectId];
  current: number;
  longest: number;
  lastTogetherDay: string;
}

export interface SpaceReminderDoc {
  _id: ObjectId;
  userId: ObjectId;
  spaceId: ObjectId;
  remindAt: Date;
  createdAt: Date;
}

export type NotificationCategory = 'spaces' | 'friends' | 'progress' | 'nudges';

export interface NotificationDoc {
  _id: ObjectId;
  userId: ObjectId;
  eventId: string;
  absorbedEventIds: string[];
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  copyVariantId: string | null;
  copyVars: Record<string, string | number | undefined>;
  sender: { kind: 'spark' } | { kind: 'friend'; userId: ObjectId } | { kind: 'system'; emoji: string };
  tone: 'default' | 'reward' | 'nudge';
  priority: 'normal' | 'high';
  actions: { kind: string; label: string }[];
  payload: Record<string, unknown> & { fromUserIds?: ObjectId[] };
  groupKey: string | null;
  delivery: 'toast' | 'inbox' | 'held';
  heldForSessionId: ObjectId | null;
  actionTaken: string | null;
  scheduledAt: Date;
  sentAt: Date;
  openedAt: Date | null;
  createdAt: Date;
}

export interface MascotEventDoc {
  _id: ObjectId;
  userId: ObjectId;
  eventType: string;
  payload: Record<string, unknown>;
  priority: number;
  deliveredAt: Date | null;
  sourceService: string;
  createdAt: Date;
}

export interface WeeklyRecapDoc {
  _id: ObjectId;
  userId: ObjectId;
  weekStart: string;
  totalMinutes: number;
  days: { date: string; minutes: number }[];
  bestDay: { date: string; minutes: number };
  topCategoryId: CategoryId | null;
  sessionsCompleted: number;
  spacesJoined: number;
  focusedWithFriendIds: ObjectId[];
  cheersReceived: number;
  xpEarned: number;
  createdAt: Date;
}

export interface AuthSessionDoc {
  _id: ObjectId;
  userId: ObjectId;
  deviceId: string;
  platform: string;
  refreshTokenHash: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
}

export interface Collections {
  users: UserDoc;
  authSessions: AuthSessionDoc;
  sessionCategories: CategoryDoc;
  badges: BadgeDoc;
  friendships: FriendshipDoc;
  blocks: BlockDoc;
  reports: ReportDoc;
  spaces: SpaceDoc;
  sessions: SessionDoc;
  dailyStats: DailyStatsDoc;
  userDailyTotal: UserDailyTotalDoc;
  pointsLedger: LedgerDoc;
  reactions: ReactionDoc;
  togetherStreaks: TogetherStreakDoc;
  spaceReminders: SpaceReminderDoc;
  notifications: NotificationDoc;
  mascotEvents: MascotEventDoc;
  weeklyRecaps: WeeklyRecapDoc;
}

export type CollectionName = keyof Collections;

// ── $jsonSchema validators ──────────────────────────────────────────────
type Schema = Record<string, unknown>;
const t = (bsonType: string | string[], extra: Schema = {}): Schema => ({ bsonType, ...extra });
const str = (extra: Schema = {}) => t('string', extra);
const num = (extra: Schema = {}) => t(['int', 'long', 'double'], extra);
const date = () => t('date');
const oid = () => t('objectId');
const bool = () => t('bool');
const orNull = (s: Schema): Schema => ({ ...s, bsonType: [...[s.bsonType].flat(), 'null'] });
const oneOf = (...values: string[]) => ({ enum: values });
const arr = (items: Schema) => t('array', { items });
const obj = (properties: Record<string, Schema>, required = Object.keys(properties)): Schema =>
  t('object', { required, properties });
const dayKey = () => str({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' });
const doc = (properties: Record<string, Schema>, required = Object.keys(properties)) => ({
  $jsonSchema: obj(properties, required),
});

export const VALIDATORS: Record<CollectionName, Schema> = {
  users: doc(
    {
      firebaseUid: str(),
      email: str(),
      status: oneOf('active', 'suspended', 'banned', 'deleted'),
      role: oneOf('user', 'moderator', 'admin'),
      displayName: str({ minLength: 1, maxLength: 60 }),
      tagline: str({ maxLength: 80 }),
      handle: orNull(str({ pattern: '^[a-z0-9._]{3,20}$' })),
      dailyTargetMin: num({ minimum: 5, maximum: 960 }),
      timezone: str(),
      mascotStage: num({ minimum: 1 }),
      points: num({ minimum: 0 }),
      level: num({ minimum: 1 }),
      badgeIds: arr(str()),
      streak: obj({
        current: num({ minimum: 0 }),
        longest: num({ minimum: 0 }),
        lastActiveDate: orNull(dayKey()),
        freezesAvailable: num({ minimum: 0, maximum: 3 }),
        freezesUsed: num({ minimum: 0 }),
        lastFreezeDate: orNull(dayKey()),
      }),
      counters: obj({ sessionsCompleted: num(), earlySessions: num(), lateSessions: num(), friends: num() }),
      notificationPrefs: obj({
        categories: obj({ spaces: bool(), friends: bool(), progress: bool(), nudges: bool() }),
        quietHours: obj({ enabled: bool(), startHour: num({ minimum: 0, maximum: 23 }), endHour: num({ minimum: 0, maximum: 23 }) }),
        dailyToastCap: num({ minimum: 0 }),
        friendAlertIds: arr(oid()),
      }),
      createdAt: date(),
      lastActiveAt: date(),
    },
  ),
  authSessions: doc({ userId: oid(), deviceId: str(), platform: str(), createdAt: date(), lastUsedAt: date(), revokedAt: orNull(date()) }),
  sessionCategories: doc({ _id: str({ pattern: '^cat_' }), name: str(), icon: str(), sortOrder: num() }),
  badges: doc({ _id: str({ pattern: '^badge_' }), name: str(), description: str(), criteriaType: str(), criteriaValue: num({ minimum: 1 }), icon: str() }),
  friendships: doc({
    userIdA: oid(),
    userIdB: oid(),
    status: oneOf('pending', 'accepted'),
    requestedBy: oid(),
    createdAt: date(),
    respondedAt: orNull(date()),
  }),
  blocks: doc({ blockerId: oid(), blockedId: oid(), createdAt: date() }),
  reports: doc({ reporterId: oid(), reportedUserId: oid(), reason: str({ maxLength: 500 }), status: oneOf('open', 'actioned', 'dismissed'), createdAt: date() }),
  spaces: doc(
    {
      categoryId: str({ pattern: '^cat_' }),
      name: str({ minLength: 1, maxLength: 40 }),
      description: orNull(str({ maxLength: 140 })),
      hostId: orNull(oid()),
      isPublic: bool(),
      maxParticipants: orNull(num({ minimum: 2 })),
      durationTargetMin: num({ minimum: 5, maximum: 600 }),
      status: oneOf('scheduled', 'active', 'completed', 'cancelled'),
      startTime: date(),
      endedAt: orNull(date()),
      invitedUserIds: arr(oid()),
      declinedUserIds: arr(oid()),
      liveCount: num({ minimum: 0 }),
      isBotSeeded: bool(),
      syntheticCount: num({ minimum: 0 }),
      createdAt: date(),
    },
  ),
  sessions: doc({
    userId: oid(),
    categoryId: str({ pattern: '^cat_' }),
    spaceId: orNull(oid()),
    type: oneOf('solo', 'space'),
    startTime: date(),
    endTime: orNull(date()),
    durationMin: num({ minimum: 0 }),
    targetDurationMin: num({ minimum: 1 }),
    status: oneOf('active', 'closing', 'completed'),
    closedReason: { enum: ['left', 'completed', 'timeout', 'space_ended', null] },
    targetHit: bool(),
    xpEarned: num({ minimum: 0 }),
  }),
  dailyStats: doc({ userId: oid(), categoryId: str(), date: dayKey(), totalMinutes: num({ minimum: 0 }), sessionCount: num({ minimum: 0 }), xpEarned: num({ minimum: 0 }) }),
  userDailyTotal: doc({ userId: oid(), date: dayKey(), totalMinutes: num({ minimum: 0 }), xpEarned: num({ minimum: 0 }) }),
  pointsLedger: doc({ userId: oid(), source: oneOf('session_complete', 'badge'), amount: num({ minimum: 0 }), timestamp: date() }),
  reactions: doc({
    contextType: oneOf('space', 'milestone'),
    contextId: t(['objectId', 'string']),
    fromUserId: oid(),
    toUserId: oid(),
    type: oneOf('clap', 'fire', 'fist_bump'),
    createdAt: date(),
  }),
  togetherStreaks: doc({ pairKey: str(), userIds: arr(oid()), current: num({ minimum: 0 }), longest: num({ minimum: 0 }), lastTogetherDay: dayKey() }),
  spaceReminders: doc({ userId: oid(), spaceId: oid(), remindAt: date(), createdAt: date() }),
  notifications: doc({
    userId: oid(),
    eventId: str(),
    type: str(),
    category: oneOf('spaces', 'friends', 'progress', 'nudges'),
    title: str(),
    body: str(),
    sender: t('object'),
    tone: oneOf('default', 'reward', 'nudge'),
    priority: oneOf('normal', 'high'),
    actions: arr(obj({ kind: str(), label: str() })),
    payload: t('object'),
    delivery: oneOf('toast', 'inbox', 'held'),
    sentAt: date(),
    openedAt: orNull(date()),
    createdAt: date(),
  }),
  mascotEvents: doc({ userId: oid(), eventType: str(), payload: t('object'), priority: num(), deliveredAt: orNull(date()), sourceService: str(), createdAt: date() }),
  weeklyRecaps: doc({ userId: oid(), weekStart: dayKey(), totalMinutes: num({ minimum: 0 }), days: arr(obj({ date: dayKey(), minutes: num() })), createdAt: date() }),
};
