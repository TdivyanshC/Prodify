import { mockFriendProfiles } from '../mocks/friends.mock';
import { mockUser } from '../mocks/user.mock';
import type { Friendship } from '../types/models';
import type { FriendProfile } from '../types/social';

// A `Friendship` only stores the two userIds — this is the local stand-in
// for the join a real backend would do to find "the other person" from
// mockUser's point of view.
export function getOtherUserId(friendship: Friendship, myId: string = mockUser._id): string {
  return friendship.userIdA === myId ? friendship.userIdB : friendship.userIdA;
}

export function getFriendProfile(userId: string): FriendProfile | undefined {
  return mockFriendProfiles.find((p) => p._id === userId);
}

export function getAcceptedFriendIds(friendships: Friendship[], myId: string = mockUser._id): Set<string> {
  return new Set(friendships.filter((f) => f.status === 'accepted').map((f) => getOtherUserId(f, myId)));
}
