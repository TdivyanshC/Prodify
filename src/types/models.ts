// Client-side shapes of the Phase 2 API's DTOs (server/src/modules/views.ts).
// They kept the Phase 1 field names, so screens built against the mocks
// read live data unchanged.

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
  // Phase 2 additions (server DTO).
  handle?: string | null;
  tagline?: string;
  level?: number;
  // XP bounds of the current level (server rules — curve is provisional, D3).
  levelProgress?: { level: number; levelStartXp: number; nextLevelXp: number };
  dailyTargetMin?: number;
  timezone?: string;
  counters?: { sessionsCompleted: number; earlySessions: number; lateSessions: number; friends: number };
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
  // Denormalized display fields — the API resolves them from `users` so
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
  // Real headline count (live sessions + a seeded room's synthetic count) —
  // `participants` below lists the people actually present.
  participantCount: number;
  type: 'solo' | 'multiplayer';
  hostId: string | null;
  isBotSeeded: boolean;
  startTime: string;
  durationTargetMin: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  participants: SessionParticipant[];
  // Friends the host invited — people asked, not people present; they only
  // show up in `participants` once they actually join. Only returned to the
  // host and invitees.
  invitedUserIds?: string[];
  endedAt?: string | null;
  // Per-viewer flags computed by the server (access rules live there).
  viewer?: {
    isIn: boolean;
    isHost: boolean;
    canInvite: boolean;
    reminderOn: boolean;
    inviteId: string | null;
  };
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
  respondedAt?: string | null;
}

// contextType 'space' → contextId is a space id; 'milestone' → a friend's
// streak-milestone id (backend doc §3 C4 — reactions aren't tied to ledger
// sessions).
export interface Reaction {
  _id: string;
  contextType: 'space' | 'milestone';
  contextId: string;
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
