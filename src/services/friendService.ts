import { api } from '../api/client';
import type { FriendshipsResponse, ProfileResponse } from '../api/types';
import type { Friendship } from '../types/models';
import type { FriendProfile } from '../types/social';

// Friends (DB doc §3): request → pending → accept/decline; either side can
// unfriend. Profiles come back alongside so screens never need a lookup.

export const getFriendships = () => api.get<FriendshipsResponse>('/friendships');
export const sendFriendRequest = (toUserId: string) =>
  api.post<{ friendship: Friendship; profile: FriendProfile }>('/friendships', { toUserId });
export const acceptFriendRequest = (friendshipId: string) => api.post<{ friendship: Friendship }>(`/friendships/${friendshipId}/accept`);
export const declineFriendRequest = (friendshipId: string) => api.post(`/friendships/${friendshipId}/decline`);
export const removeFriendship = (friendshipId: string) => api.del(`/friendships/${friendshipId}`);
export const getSuggestions = () => api.get<{ items: (FriendProfile & { mutualCount: number })[] }>('/friends/suggestions');
export const getProfile = (userId: string) => api.get<ProfileResponse>(`/users/${userId}/profile`);
export const blockUser = (userId: string) => api.post('/blocks', { userId });
