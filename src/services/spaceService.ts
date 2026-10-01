import { mockSpaceInvites } from '../mocks/spaceInvites.mock';
import type { SpaceInvite } from '../types/social';

// Phase 1: returns local fixture data. Phase 2: swap the body for
// GET /api/notifications?type=space_invite — invites aren't their own
// collection (docs/phase2-database-design.md §2), they're notifications.
export async function getSpaceInvites(): Promise<SpaceInvite[]> {
  return mockSpaceInvites;
}
