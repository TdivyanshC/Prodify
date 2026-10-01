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
// ({ userId, type, scheduledAt, sentAt, openedAt }), with the copy already
// resolved into title/body (Phase 2 resolves it from `copyVariantId`).
// Phase 4's notificationDelivery job pushes the same docs through FCM.
export type AppNotificationType = 'space_invite' | 'friend_started_space' | 'space_reminder' | 'own_space_due';

export interface AppNotification {
  _id: string;
  userId: string;
  type: AppNotificationType;
  title: string;
  body: string;
  payload: { spaceId: string; fromUserId?: string };
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
