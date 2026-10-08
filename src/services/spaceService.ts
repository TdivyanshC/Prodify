import { api } from '../api/client';
import type { Paged, SessionCloseResult, SpaceActionResponse, SpacesFeed } from '../api/types';
import type { Session } from '../types/models';

// Spaces (backend doc §6). Invites are notifications server-side; the feed
// returns them already shaped as the app's SpaceInvite read model.

export const getSpacesFeed = () => api.get<SpacesFeed>('/spaces/feed');
export const browsePublicSpaces = (categoryId?: string, cursor?: string) => {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  if (cursor) params.set('cursor', cursor);
  return api.get<Paged<Session>>(`/spaces?${params.toString()}`);
};
export const getSpace = (spaceId: string) => api.get<Session>(`/spaces/${spaceId}`);

export interface CreateSpaceBody {
  name: string;
  categoryId: string;
  durationTargetMin: number;
  description?: string | null;
  isPublic: boolean;
  invitedUserIds?: string[];
  startTime?: string;
}
export const createSpace = (body: CreateSpaceBody) => api.post<SpaceActionResponse>('/spaces', body);
export const joinSpace = (spaceId: string) => api.post<SpaceActionResponse>(`/spaces/${spaceId}/join`);
export const leaveSpace = (spaceId: string) => api.post<SessionCloseResult>(`/spaces/${spaceId}/leave`);
export const startSpace = (spaceId: string) => api.post<SpaceActionResponse>(`/spaces/${spaceId}/start`);
export const cancelSpace = (spaceId: string) => api.post(`/spaces/${spaceId}/cancel`);
export const inviteToSpace = (spaceId: string, userIds: string[]) => api.post<Session>(`/spaces/${spaceId}/invites`, { userIds });
export const declineSpaceInvite = (spaceId: string) => api.post(`/spaces/${spaceId}/invites/decline`);
