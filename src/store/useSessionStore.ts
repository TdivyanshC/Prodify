import { create } from 'zustand';
import { mockEndedFriendSpaces, mockFriendSpaces, mockScheduledFriendSpaces } from '../mocks/friendSpaces.mock';
import { mockLiveSessions } from '../mocks/liveSessions.mock';
import { mockUser } from '../mocks/user.mock';
import type { Session, SessionParticipant } from '../types/models';

export interface CreateSessionInput {
  name: string;
  categoryId: string;
  durationMin: number;
  description?: string | null;
  isPublic: boolean;
  invitedUserIds?: string[];
  // A future time schedules the space instead of starting it now.
  startTime?: string;
}

export interface CompleteSessionResult {
  targetHit: boolean;
  minutesLogged: number;
  // claude.md §4 streak rule: counts if the target was hit, OR the user
  // stayed for at least half the target duration — computed here (where
  // durationTargetMin is available) so callers never re-derive it.
  streakEligible: boolean;
}

interface SessionStoreState {
  sessions: Session[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  joinSession: (sessionId: string) => void;
  leaveSession: (sessionId: string) => void;
  createSession: (input: CreateSessionInput) => Session;
  // Flips a scheduled space live: status → active, clock restarts now, and
  // `host` (the person actually opening it) becomes the first participant.
  startScheduledSpace: (sessionId: string, host: SessionParticipant) => void;
  addInvitees: (sessionId: string, userIds: string[]) => void;
  completeSession: (sessionId: string, targetHit: boolean) => CompleteSessionResult;
}

// Live sessions — architecture §1 §13: "interactions should actually
// update frontend state," not fake static UI. Join/leave/create all
// mutate this shared store so every screen reading it (Home, Sessions)
// stays in sync.
export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessions: [],
  isLoading: false,
  refresh: async () => {
    set({ isLoading: true });
    // Phase 1: local fixtures. Phase 2: GET /api/spaces?status=active|scheduled
    // plus recently completed ones. Friends' spaces live in the same list
    // so Session Room can resolve any of them by id; every screen filters
    // by `status` itself.
    set({
      sessions: [...mockFriendSpaces, ...mockScheduledFriendSpaces, ...mockEndedFriendSpaces, ...mockLiveSessions],
      isLoading: false,
    });
  },
  joinSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.map((session) => {
        if (session._id !== sessionId) return session;
        const alreadyIn = session.participants.some(
          (p) => p.userId === mockUser._id && !p.leftAt
        );
        if (alreadyIn) return session;
        return {
          ...session,
          participantCount: session.participantCount + 1,
          participants: [
            ...session.participants,
            {
              userId: mockUser._id,
              joinedAt: new Date().toISOString(),
              leftAt: null,
              completed: false,
              targetHit: false,
              displayName: mockUser.displayName,
              avatarInitial: mockUser.displayName[0],
            },
          ],
        };
      }),
    })),
  leaveSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.map((session) => {
        if (session._id !== sessionId) return session;
        const wasIn = session.participants.some((p) => p.userId === mockUser._id && !p.leftAt);
        if (!wasIn) return session;
        return {
          ...session,
          participantCount: Math.max(0, session.participantCount - 1),
          participants: session.participants.map((p) =>
            p.userId === mockUser._id ? { ...p, leftAt: new Date().toISOString() } : p
          ),
        };
      }),
    })),
  createSession: (input) => {
    const now = new Date().toISOString();
    // Scheduled spaces start empty — the host joins when they hit "Start
    // now" (startScheduledSpace), not at creation, so no time is clocked
    // before anyone is actually there.
    const scheduledStart =
      input.startTime && new Date(input.startTime).getTime() > Date.now() ? input.startTime : null;
    const isScheduled = scheduledStart !== null;
    const newSession: Session = {
      _id: `session_${Date.now()}`,
      categoryId: input.categoryId,
      templateId: null,
      name: input.name,
      description: input.description ?? null,
      isPublic: input.isPublic,
      maxParticipants: null,
      participantCount: isScheduled ? 0 : 1,
      type: 'multiplayer',
      hostId: mockUser._id,
      isBotSeeded: false,
      startTime: scheduledStart ?? now,
      durationTargetMin: input.durationMin,
      status: isScheduled ? 'scheduled' : 'active',
      participants: isScheduled
        ? []
        : [
            {
              userId: mockUser._id,
              joinedAt: now,
              leftAt: null,
              completed: false,
              targetHit: false,
              displayName: mockUser.displayName,
              avatarInitial: mockUser.displayName[0],
            },
          ],
      invitedUserIds: input.invitedUserIds ?? [],
    };
    set((state) => ({ sessions: [newSession, ...state.sessions] }));
    return newSession;
  },
  startScheduledSpace: (sessionId, host) =>
    set((state) => ({
      sessions: state.sessions.map((session) => {
        if (session._id !== sessionId || session.status !== 'scheduled') return session;
        const now = new Date().toISOString();
        return {
          ...session,
          status: 'active',
          startTime: now,
          participantCount: 1,
          participants: [{ ...host, joinedAt: now, leftAt: null }],
        };
      }),
    })),
  addInvitees: (sessionId, userIds) =>
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session._id === sessionId
          ? { ...session, invitedUserIds: [...new Set([...(session.invitedUserIds ?? []), ...userIds])] }
          : session
      ),
    })),
  // Session Room's leave/complete controls both end the participant's
  // relationship to it and always mark leftAt — completion is just the
  // "targetHit: true" flavor. Returns minutes logged so the caller (Session
  // Room) can pass streak-eligibility on to the Post-Session screen without
  // re-deriving it from a session that's already been mutated.
  completeSession: (sessionId, targetHit) => {
    const now = new Date().toISOString();
    let minutesLogged = 0;
    let streakEligible = targetHit;
    set((state) => ({
      sessions: state.sessions.map((session) => {
        if (session._id !== sessionId) return session;
        minutesLogged = Math.round((Date.now() - new Date(session.startTime).getTime()) / 60000);
        streakEligible = targetHit || minutesLogged >= session.durationTargetMin * 0.5;
        return {
          ...session,
          participants: session.participants.map((p) =>
            p.userId === mockUser._id ? { ...p, leftAt: now, completed: true, targetHit } : p
          ),
        };
      }),
    }));
    return { targetHit, minutesLogged, streakEligible };
  },
}));
