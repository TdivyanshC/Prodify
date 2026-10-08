import { create } from 'zustand';
import { getMyReactions, getReactionCounts, setReaction } from '../services/reactionService';
import type { Reaction } from '../types/models';
import { useUserStore } from './useUserStore';

type Counts = Record<Reaction['type'], number>;

interface ReactionStoreState {
  // Reactions the user has sent recently (cards + milestone 🔥).
  reactions: Reaction[];
  // Live totals per space, for the Session Room's reaction bar.
  roomCounts: Record<string, Counts>;
  load: () => Promise<void>;
  toggleReaction: (contextId: string, toUserId: string, type: Reaction['type'], contextType?: Reaction['contextType']) => void;
  loadRoomCounts: (spaceId: string) => Promise<void>;
  applyRemote: (reaction: Reaction, on: boolean) => void;
}

const matches = (r: Reaction, contextId: string, toUserId: string, type: Reaction['type'], fromUserId: string) =>
  r.contextId === contextId && r.toUserId === toUserId && r.type === type && r.fromUserId === fromUserId;

// claude.md §4: clap / fire / fist-bump is the entire social vocabulary.
// Toggle semantics, matching the server's unique index — tapping again
// takes it back. Optimistic, rolled back if the API refuses.
export const useReactionStore = create<ReactionStoreState>((set, get) => ({
  reactions: [],
  roomCounts: {},
  load: async () => {
    set({ reactions: (await getMyReactions()).items });
  },
  toggleReaction: (contextId, toUserId, type, contextType = 'space') => {
    const me = useUserStore.getState().user?._id;
    if (!me) return;
    const existing = get().reactions.find((r) => matches(r, contextId, toUserId, type, me));
    const on = !existing;
    const optimistic: Reaction = { _id: `local_${Date.now()}`, contextType, contextId, fromUserId: me, toUserId, type, createdAt: new Date().toISOString() };
    const flip = (turnOn: boolean) =>
      set((state) => ({
        reactions: turnOn ? [...state.reactions, optimistic] : state.reactions.filter((r) => !matches(r, contextId, toUserId, type, me)),
      }));
    flip(on);
    setReaction({ contextType, contextId, toUserId, type }, on).catch(() => flip(!on));
  },
  loadRoomCounts: async (spaceId) => {
    const { counts } = await getReactionCounts(spaceId);
    set((state) => ({ roomCounts: { ...state.roomCounts, [spaceId]: counts } }));
  },
  applyRemote: (reaction, on) => {
    // Own reactions were already counted optimistically.
    if (reaction.contextType !== 'space' || reaction.fromUserId === useUserStore.getState().user?._id) return;
    set((state) => {
      const current = state.roomCounts[reaction.contextId];
      if (!current) return state;
      return {
        roomCounts: {
          ...state.roomCounts,
          [reaction.contextId]: { ...current, [reaction.type]: Math.max(0, current[reaction.type] + (on ? 1 : -1)) },
        },
      };
    });
  },
}));
