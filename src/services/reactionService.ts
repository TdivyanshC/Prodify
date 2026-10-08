import { api } from '../api/client';
import type { Reaction } from '../types/models';

// Reactions toggle (one per sender/recipient/context/type — DB doc §2).
export const setReaction = (r: Pick<Reaction, 'contextType' | 'contextId' | 'toUserId' | 'type'>, on: boolean) =>
  api.put('/reactions', { ...r, on });
export const getMyReactions = () => api.get<{ items: Reaction[] }>('/reactions/mine');
export const getReactionCounts = (spaceId: string) =>
  api.get<{ counts: Record<Reaction['type'], number>; total: number }>(`/reactions?contextType=space&contextId=${spaceId}`);
