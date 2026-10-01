import { create } from 'zustand';
import { mockFriendSpaceAlertIds } from '../mocks/spaceAlerts.mock';

interface SpaceAlertsStoreState {
  // Friends whose new spaces the user wants to be told about.
  friendAlertIds: string[];
  // Scheduled spaces the user asked to be reminded about before they start.
  reminderSpaceIds: string[];
  toggleFriendAlert: (userId: string) => void;
  toggleReminder: (spaceId: string) => void;
}

const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

// Space-related notification preferences: per-friend "tell me when they
// start a space" and per-space "remind me before it starts". Phase 1 only
// holds the preference; delivery lands with notifications in Phase 4.
export const useSpaceAlertsStore = create<SpaceAlertsStoreState>((set) => ({
  friendAlertIds: mockFriendSpaceAlertIds,
  reminderSpaceIds: [],
  toggleFriendAlert: (userId) => set((state) => ({ friendAlertIds: toggle(state.friendAlertIds, userId) })),
  toggleReminder: (spaceId) => set((state) => ({ reminderSpaceIds: toggle(state.reminderSpaceIds, spaceId) })),
}));
