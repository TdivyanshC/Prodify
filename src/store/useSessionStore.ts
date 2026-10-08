import { create } from 'zustand';
import type { SessionCloseResult } from '../api/types';
import * as spaces from '../services/spaceService';
import type { Session } from '../types/models';
import { useSpaceAlertsStore } from './useSpaceAlertsStore';
import { useSpaceInviteStore } from './useSpaceInviteStore';
import { useTogetherStreakStore } from './useTogetherStreakStore';

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

interface SessionStoreState {
  // Every space the Spaces tab / Home / Session Room can show — friends' live,
  // scheduled and recently ended ones, the user's own, public and seeded
  // rooms (GET /spaces/feed). Screens filter by `status` themselves.
  sessions: Session[];
  isLoading: boolean;
  hasLoaded: boolean;
  refresh: () => Promise<void>;
  upsert: (space: Session) => void;
  joinSession: (spaceId: string) => Promise<Session>;
  // Ends the user's session in a space; the server closes it (XP, streak…)
  // and returns the result Post-Session shows.
  leaveSession: (spaceId: string) => Promise<SessionCloseResult>;
  createSession: (input: CreateSessionInput) => Promise<Session>;
  startScheduledSpace: (spaceId: string) => Promise<Session>;
  addInvitees: (spaceId: string, userIds: string[]) => Promise<void>;
}

// Spaces state (CLAUDE.md §4 — the frontend rename to useSpaceStore is
// still pending). Server-authoritative: every action awaits the API and
// stores what it returns; socket `space:changed` triggers a refetch.
export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessions: [],
  isLoading: false,
  hasLoaded: false,
  refresh: async () => {
    set({ isLoading: true });
    try {
      const feed = await spaces.getSpacesFeed();
      set({ sessions: feed.spaces, hasLoaded: true });
      useSpaceInviteStore.getState().setInvites(feed.invites);
      useSpaceAlertsStore.getState().setAll(feed.friendAlertIds, feed.reminderSpaceIds);
      useTogetherStreakStore.getState().merge(feed.togetherStreaks);
    } finally {
      set({ isLoading: false });
    }
  },
  upsert: (space) =>
    set((state) => ({
      sessions: state.sessions.some((s) => s._id === space._id)
        ? state.sessions.map((s) => (s._id === space._id ? space : s))
        : [space, ...state.sessions],
    })),
  joinSession: async (spaceId) => {
    const { space } = await spaces.joinSpace(spaceId);
    get().upsert(space);
    return space;
  },
  leaveSession: async (spaceId) => {
    const result = await spaces.leaveSpace(spaceId);
    void get().refresh();
    return result;
  },
  createSession: async (input) => {
    const { space } = await spaces.createSpace({
      name: input.name,
      categoryId: input.categoryId,
      durationTargetMin: input.durationMin,
      description: input.description ?? null,
      isPublic: input.isPublic,
      invitedUserIds: input.invitedUserIds,
      startTime: input.startTime,
    });
    get().upsert(space);
    return space;
  },
  startScheduledSpace: async (spaceId) => {
    const { space } = await spaces.startSpace(spaceId);
    get().upsert(space);
    return space;
  },
  addInvitees: async (spaceId, userIds) => {
    get().upsert(await spaces.inviteToSpace(spaceId, userIds));
  },
}));
