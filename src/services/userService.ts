import { mockUser } from '../mocks/user.mock';
import type { User } from '../types/models';

// Phase 1: returns local fixture data. Phase 2: swap the body for a fetch to
// GET /api/users/:id — the return shape stays identical (claude.md §5 users).
export async function getUserProfile(userId: string = mockUser._id): Promise<User> {
  return mockUser;
}
