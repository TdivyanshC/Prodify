// Mirrors the MongoDB collection shapes in claude.md §5, so mock services can
// return data that's a drop-in swap for real API responses in Phase 2.

export interface Streak {
  current: number;
  longest: number;
  lastActiveDate: string | null; // ISO date string
  freezesAvailable: number;
  freezesUsed: number;
}

export interface User {
  _id: string;
  googleId: string | null;
  displayName: string;
  avatarUrl: string;
  mascotStage: number;
  streak: Streak;
  points: number;
  badgeIds: string[];
  createdAt: string;
  lastActiveAt: string;
}

export interface SessionCategory {
  _id: string;
  name: string;
  icon: string;
  isCustom: boolean;
  createdBy: string | null;
}

export interface SessionParticipant {
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  completed: boolean;
  targetHit: boolean;
  // Denormalized display fields — a real API would resolve these via a
  // join with `users`; stored directly here for the Phase 1 mock so
  // session cards don't need a separate participant-lookup service.
  displayName: string;
  avatarInitial: string;
}

export interface Session {
  _id: string;
  categoryId: string;
  templateId: string | null;
  // `name`/`description`/`isPublic` are additive beyond the original §5
  // shape (a real backend would likely resolve name via sessionTemplates)
  // — added directly here since Phase 1 has no templates layer yet.
  name: string;
  description: string | null;
  isPublic: boolean;
  maxParticipants: number | null;
  // Real headline count (e.g. "24 people") — `participants` below only
  // holds a small preview for avatar rendering, so mocks don't need to
  // hand-author dozens of fake participant records.
  participantCount: number;
  type: 'solo' | 'multiplayer';
  hostId: string | null;
  isBotSeeded: boolean;
  startTime: string;
  durationTargetMin: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  participants: SessionParticipant[];
}

export interface Badge {
  _id: string;
  name: string;
  description: string;
  criteriaType: string;
  criteriaValue: number;
  // Additive UI field beyond the original §5 shape, same precedent as
  // Session's denormalized display fields (§6a) — a real badge catalog
  // would likely resolve iconography through a design/content system, but
  // Phase 1 has no such layer yet.
  icon?: string;
}

export interface Friendship {
  _id: string;
  userIdA: string;
  userIdB: string;
  status: 'pending' | 'accepted' | 'declined';
  requestedBy: string;
  createdAt: string;
}

export interface Reaction {
  _id: string;
  sessionId: string;
  fromUserId: string;
  toUserId: string;
  type: 'clap' | 'fire' | 'fist_bump';
  createdAt: string;
}

export interface PointsLedgerEntry {
  _id: string;
  userId: string;
  source: string;
  amount: number;
  timestamp: string;
}

// Priority order per claude.md §4: streak-at-risk-today > new badge/level-up >
// friend's significant achievement > welcome-back-after-inactivity >
// generic encouragement > idle.
export type MascotEventType =
  | 'streak_at_risk'
  | 'badge_earned'
  | 'level_up'
  | 'friend_achievement'
  | 'welcome_back'
  | 'generic_encouragement'
  | 'idle';

export interface MascotEvent {
  _id: string;
  userId: string;
  eventType: MascotEventType;
  payload: Record<string, unknown>;
  priority: number; // lower number = higher priority
  deliveredAt: string | null;
  sourceService: string;
}
