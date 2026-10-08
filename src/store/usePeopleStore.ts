import { create } from 'zustand';
import type { FriendProfile } from '../types/social';

interface PeopleState {
  // Everyone the app has a profile for — friends, requesters, suggestions.
  profiles: Record<string, FriendProfile>;
  upsert: (profiles: FriendProfile[]) => void;
  setOnline: (userId: string, online: boolean) => void;
}

// Profile cache behind utils/friendHelpers.getFriendProfile(), filled from
// the friendships/suggestions responses and kept fresh by presence events.
export const usePeopleStore = create<PeopleState>((set) => ({
  profiles: {},
  upsert: (profiles) =>
    set((state) => ({ profiles: { ...state.profiles, ...Object.fromEntries(profiles.map((p) => [p._id, p])) } })),
  setOnline: (userId, online) =>
    set((state) =>
      state.profiles[userId] ? { profiles: { ...state.profiles, [userId]: { ...state.profiles[userId], isOnline: online } } } : state
    ),
}));
