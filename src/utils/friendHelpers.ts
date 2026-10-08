import { usePeopleStore } from '../store/usePeopleStore';
import { useUserStore } from '../store/useUserStore';
import type { Friendship } from '../types/models';
import type { FriendProfile } from '../types/social';

const currentUserId = () => useUserStore.getState().user?._id ?? '';

// A `Friendship` only stores the two userIds — "the other person" from the
// signed-in user's point of view.
export function getOtherUserId(friendship: Friendship, myId: string = currentUserId()): string {
  return friendship.userIdA === myId ? friendship.userIdB : friendship.userIdA;
}

// Profiles come from the API (friendships, suggestions) via the people store.
export function getFriendProfile(userId: string): FriendProfile | undefined {
  return usePeopleStore.getState().profiles[userId];
}

export function getAcceptedFriendIds(friendships: Friendship[], myId: string = currentUserId()): Set<string> {
  return new Set(friendships.filter((f) => f.status === 'accepted').map((f) => getOtherUserId(f, myId)));
}
