import { create } from 'zustand';
import { mockUser } from '../mocks/user.mock';
import type { Reaction } from '../types/models';

interface ReactionStoreState {
  reactions: Reaction[];
  toggleReaction: (sessionId: string, toUserId: string, type: Reaction['type']) => void;
}

// Reactions the user has sent (claude.md §4: the fixed clap/fire/fist-bump
// set is the entire social vocabulary). Toggle semantics, matching the
// Phase 2 unique index {sessionId, fromUserId, toUserId, type} — tapping
// again takes it back rather than stacking a second one.
export const useReactionStore = create<ReactionStoreState>((set) => ({
  reactions: [],
  toggleReaction: (sessionId, toUserId, type) =>
    set((state) => {
      const matches = (r: Reaction) =>
        r.sessionId === sessionId && r.fromUserId === mockUser._id && r.toUserId === toUserId && r.type === type;
      if (state.reactions.some(matches)) {
        return { reactions: state.reactions.filter((r) => !matches(r)) };
      }
      const reaction: Reaction = {
        _id: `reaction_${Date.now()}`,
        sessionId,
        fromUserId: mockUser._id,
        toUserId,
        type,
        createdAt: new Date().toISOString(),
      };
      return { reactions: [...state.reactions, reaction] };
    }),
}));
