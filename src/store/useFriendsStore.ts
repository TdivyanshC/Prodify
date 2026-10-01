import { create } from 'zustand';
import { getFriendships } from '../services/friendService';
import { mockUser } from '../mocks/user.mock';
import type { Friendship } from '../types/models';

interface FriendsStoreState {
  friendships: Friendship[];
  isLoading: boolean;
  // Distinguishes "not fetched yet" from "fetched, and the user has no
  // friends" — `friendships.length === 0` can't tell those apart.
  hasLoaded: boolean;
  refresh: () => Promise<void>;
  acceptRequest: (friendshipId: string) => void;
  declineRequest: (friendshipId: string) => void;
  sendRequest: (toUserId: string) => void;
  removeFriend: (friendshipId: string) => void;
}

// Friends — claude.md §4: mutual accept required, either side can unfriend
// anytime. All actions mutate this shared store (same pattern as
// useSessionStore) so Friends screen state stays real rather than static UI.
export const useFriendsStore = create<FriendsStoreState>((set, get) => ({
  friendships: [],
  isLoading: false,
  hasLoaded: false,
  refresh: async () => {
    set({ isLoading: true });
    const friendships = await getFriendships();
    set({ friendships, isLoading: false, hasLoaded: true });
  },
  acceptRequest: (friendshipId) =>
    set((state) => ({
      friendships: state.friendships.map((f) =>
        f._id === friendshipId ? { ...f, status: 'accepted' } : f
      ),
    })),
  declineRequest: (friendshipId) =>
    set((state) => ({
      friendships: state.friendships.filter((f) => f._id !== friendshipId),
    })),
  sendRequest: (toUserId) => {
    const alreadyExists = get().friendships.some(
      (f) => f.userIdA === toUserId || f.userIdB === toUserId
    );
    if (alreadyExists) return;
    const newFriendship: Friendship = {
      _id: `friendship_${Date.now()}`,
      userIdA: mockUser._id,
      userIdB: toUserId,
      status: 'pending',
      requestedBy: mockUser._id,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ friendships: [...state.friendships, newFriendship] }));
  },
  removeFriend: (friendshipId) =>
    set((state) => ({
      friendships: state.friendships.filter((f) => f._id !== friendshipId),
    })),
}));
