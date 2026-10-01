import { create } from 'zustand';
import { mockUser } from '../mocks/user.mock';
import { getSpaceInvites } from '../services/spaceService';
import type { SpaceInvite } from '../types/social';

interface SpaceInviteStoreState {
  invites: SpaceInvite[];
  hasLoaded: boolean;
  // Invites the "X invited you" popup has already been shown for, so it
  // greets each invite once instead of on every visit to the Spaces tab.
  announcedIds: string[];
  refresh: () => Promise<void>;
  sendInvites: (spaceId: string, toUserIds: string[]) => void;
  acceptInvite: (inviteId: string) => void;
  declineInvite: (inviteId: string) => void;
  markAnnounced: (inviteId: string) => void;
}

// Space invites, both directions: ones friends sent the user (shown on the
// Spaces tab) and ones the user sent when creating a space. Same
// mutate-the-shared-store pattern as useFriendsStore.
export const useSpaceInviteStore = create<SpaceInviteStoreState>((set) => ({
  invites: [],
  hasLoaded: false,
  announcedIds: [],
  refresh: async () => {
    const invites = await getSpaceInvites();
    set({ invites, hasLoaded: true });
  },
  sendInvites: (spaceId, toUserIds) => {
    const createdAt = new Date().toISOString();
    const outgoing: SpaceInvite[] = toUserIds.map((toUserId) => ({
      _id: `invite_${spaceId}_${toUserId}`,
      spaceId,
      fromUserId: mockUser._id,
      toUserId,
      status: 'pending',
      createdAt,
    }));
    set((state) => ({ invites: [...state.invites, ...outgoing] }));
  },
  acceptInvite: (inviteId) =>
    set((state) => ({
      invites: state.invites.map((i) => (i._id === inviteId ? { ...i, status: 'accepted' } : i)),
    })),
  declineInvite: (inviteId) =>
    set((state) => ({
      invites: state.invites.map((i) => (i._id === inviteId ? { ...i, status: 'declined' } : i)),
    })),
  markAnnounced: (inviteId) =>
    set((state) =>
      state.announcedIds.includes(inviteId) ? state : { announcedIds: [...state.announcedIds, inviteId] }
    ),
}));
