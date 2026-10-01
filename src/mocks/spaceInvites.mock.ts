import type { SpaceInvite } from '../types/social';
import { mockUser } from './user.mock';

const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString();

// One incoming invite so the Spaces tab's invite banner + popup have real
// content: Kabir opened Morning Reset (friendSpaces.mock.ts) and asked
// mockUser along.
export const mockSpaceInvites: SpaceInvite[] = [
  {
    _id: 'invite_kabir_morning_reset',
    spaceId: 'space_kabir_morning_reset',
    fromUserId: 'user_seed_kabir',
    toUserId: mockUser._id,
    status: 'pending',
    createdAt: minutesAgo(6),
  },
];
