// Vendored copy of the app's src/types/social.ts so the server deploys on its own (a host
// may ship only server/). Keep in sync: the hardening test fails on drift.
// Phase-1 UI-only social types. Not part of the locked §5 schema mirror in
// models.ts — a real backend would resolve a friend's display info via a
// join with `users` off the two ids already on `Friendship` (same
// denormalization Session does for participants), so there's no reason to
// bolt these fields onto the locked collection shapes.
export interface FriendProfile {
  _id: string;
  displayName: string;
  avatarInitial: string;
  tagline: string;
  favoriteCategoryIcon: string;
  streak: {
    current: number;
    longest: number;
  };
  isOnline: boolean;
  mascotStage: number;
}

// Consecutive days the user and one friend both clocked streak-eligible
// time in the same space. Phase 2 derives this from `sessions` docs that
// share a `spaceId` on the same day; Phase 1 keeps it per friend.
export interface TogetherStreak {
  current: number;
  longest: number;
  lastTogetherDate: string | null; // "YYYY-MM-DD", local
}

// In-app notification — mirrors the Phase 2 `notifications` doc
// ({ userId, type, copyVariantId, scheduledAt, sentAt, openedAt }), with the
// copy already resolved into title/body. Phase 4's notificationDelivery job
// pushes the same docs through FCM; everything below the core fields is
// presentation metadata the push payload can carry as data.
export type AppNotificationType =
  // Spaces
  | 'space_invite'
  | 'friend_started_space'
  | 'space_reminder'
  | 'own_space_due'
  | 'space_joined'
  // Friends
  | 'friend_request'
  | 'friend_accepted'
  | 'friend_milestone'
  | 'reactions_received'
  | 'together_streak_risk'
  // Progress & rewards
  | 'streak_at_risk'
  | 'goal_close'
  | 'streak_freeze_used'
  | 'streak_freeze_earned'
  | 'badge_earned'
  | 'level_up'
  | 'weekly_recap'
  | 'welcome_back'
  // Playful "come focus" nudges
  | 'join_nudge';

// Drives the inbox filter tabs and the per-category on/off switches.
export type NotificationCategory = 'spaces' | 'friends' | 'progress' | 'nudges';

// Who the notification "comes from" — Spark's face, a friend's avatar, or
// a plain emoji badge.
export type NotificationSender =
  | { kind: 'spark' }
  | { kind: 'friend'; userId: string }
  | { kind: 'system'; emoji: string };

// reward = gold accent (claude.md §3a: gold is only for rewards/streaks);
// nudge = amber `warning` (gentle, never `error` red); default = teal chrome.
export type NotificationTone = 'default' | 'reward' | 'nudge';

export type NotificationActionKind =
  | 'join_space'
  | 'remind_space'
  | 'start_space_now'
  | 'open_spaces'
  | 'quick_start'
  | 'send_fire'
  | 'accept_friend'
  | 'decline_friend'
  | 'open_recap'
  | 'celebrate'
  | 'snooze';

export interface NotificationAction {
  kind: NotificationActionKind;
  label: string;
}

export interface NotificationPayload {
  spaceId?: string;
  // Carried so grouped copy can name the space without a lookup.
  spaceName?: string;
  fromUserId?: string;
  // Grouped notifications ("Riya and 2 others…") accumulate every sender.
  fromUserIds?: string[];
  friendshipId?: string;
  badgeId?: string;
  level?: number;
  durationMin?: number;
  milestone?: number;
  // The 🔥 reaction's context id for a friend's milestone (server-set).
  milestoneContextId?: string;
  reactionEmoji?: string;
}

export interface AppNotification {
  _id: string;
  userId: string;
  // Deterministic source-event id the server dedupes on.
  eventId?: string;
  actionTaken?: string | null;
  delivery?: 'toast' | 'inbox' | 'held';
  type: AppNotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  sender: NotificationSender;
  tone: NotificationTone;
  // 'high' skips quiet hours and the daily cap (rewards, invites, things
  // the user explicitly asked for like reminders). It never skips focus
  // mode — nothing interrupts a session in progress.
  priority: 'normal' | 'high';
  actions: NotificationAction[];
  payload: NotificationPayload;
  copyVariantId: string | null;
  // Notifications sharing a groupKey merge while unread (see
  // the server's notification pipeline) instead of stacking up.
  groupKey?: string;
  scheduledAt: string;
  sentAt: string | null;
  openedAt: string | null;
}

// An invite into a live space. Phase 2 has no `spaceInvites` collection —
// invitees go up with `POST /spaces` and reach the friend as a
// `space_invite` notification (docs/phase2-database-design.md §2/§4) — so
// this is the client-side read model of that notification, not a schema.
export interface SpaceInvite {
  _id: string;
  spaceId: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}
