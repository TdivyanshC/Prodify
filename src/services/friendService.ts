import { mockFriendships } from '../mocks/friends.mock';
import type { Friendship } from '../types/models';

// Phase 1: returns local fixture data. Phase 2: swap the body for
// GET /api/friendships?userId=:id — the return shape stays identical
// (claude.md §5 friendships).
export async function getFriendships(): Promise<Friendship[]> {
  return mockFriendships;
}
