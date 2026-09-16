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
}

export interface Session {
  _id: string;
  categoryId: string;
  templateId: string | null;
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
