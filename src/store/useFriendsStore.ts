import { create } from 'zustand';
import * as friends from '../services/friendService';
import type { Friendship } from '../types/models';
import { usePeopleStore } from './usePeopleStore';
import { useTogetherStreakStore } from './useTogetherStreakStore';

interface FriendsStoreState {
  friendships: Friendship[];
  isLoading: boolean;
  // Distinguishes "not fetched yet" from "fetched, and the user has no
  // friends" — `friendships.length === 0` can't tell those apart.
  hasLoaded: boolean;
  refresh: () => Promise<void>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  sendRequest: (toUserId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
}

// Friends — claude.md §4: mutual accept required, either side can unfriend
// anytime. The server owns the state machine (canonical pairs, blocks);
// this store mirrors GET /friendships and refetches after each action.
export const useFriendsStore = create<FriendsStoreState>((set, get) => ({
  friendships: [],
  isLoading: false,
  hasLoaded: false,
  refresh: async () => {
    set({ isLoading: true });
    try {
      const res = await friends.getFriendships();
      usePeopleStore.getState().upsert(res.profiles);
      useTogetherStreakStore.getState().merge(res.togetherStreaks);
      set({ friendships: res.friendships, hasLoaded: true });
    } finally {
      set({ isLoading: false });
    }
  },
  acceptRequest: async (friendshipId) => {
    set((s) => ({ friendships: s.friendships.map((f) => (f._id === friendshipId ? { ...f, status: 'accepted' } : f)) }));
    await friends.acceptFriendRequest(friendshipId).finally(() => get().refresh());
  },
  declineRequest: async (friendshipId) => {
    set((s) => ({ friendships: s.friendships.filter((f) => f._id !== friendshipId) }));
    await friends.declineFriendRequest(friendshipId).finally(() => get().refresh());
  },
  sendRequest: async (toUserId) => {
    const { friendship, profile } = await friends.sendFriendRequest(toUserId);
    usePeopleStore.getState().upsert([profile]);
    set((s) => ({ friendships: [...s.friendships, friendship] }));
  },
  removeFriend: async (friendshipId) => {
    set((s) => ({ friendships: s.friendships.filter((f) => f._id !== friendshipId) }));
    await friends.removeFriendship(friendshipId).finally(() => get().refresh());
  },
}));
