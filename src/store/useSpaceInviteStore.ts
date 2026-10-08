import { create } from 'zustand';
import { declineSpaceInvite } from '../services/spaceService';
import type { SpaceInvite } from '../types/social';

interface SpaceInviteStoreState {
  invites: SpaceInvite[];
  hasLoaded: boolean;
  // Invites the "X invited you" popup has already been shown for, so it
  // greets each invite once instead of on every visit to the Spaces tab.
  announcedIds: string[];
  setInvites: (invites: SpaceInvite[]) => void;
  acceptInvite: (inviteId: string) => void;
  declineInvite: (inviteId: string) => Promise<void>;
  markAnnounced: (inviteId: string) => void;
}

// Space invites received — the client read model of the server's
// `space_invite` notifications, delivered inside GET /spaces/feed.
// Accepting = joining the space (the join marks it server-side).
export const useSpaceInviteStore = create<SpaceInviteStoreState>((set, get) => ({
  invites: [],
  hasLoaded: false,
  announcedIds: [],
  setInvites: (invites) => set({ invites, hasLoaded: true }),
  acceptInvite: (inviteId) =>
    set((state) => ({ invites: state.invites.map((i) => (i._id === inviteId ? { ...i, status: 'accepted' } : i)) })),
  declineInvite: async (inviteId) => {
    const invite = get().invites.find((i) => i._id === inviteId);
    set((state) => ({ invites: state.invites.map((i) => (i._id === inviteId ? { ...i, status: 'declined' } : i)) }));
    if (invite) await declineSpaceInvite(invite.spaceId);
  },
  markAnnounced: (inviteId) =>
    set((state) => (state.announcedIds.includes(inviteId) ? state : { announcedIds: [...state.announcedIds, inviteId] })),
}));
