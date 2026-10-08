import { create } from 'zustand';
import { setFriendAlert, setSpaceReminder } from '../services/userService';

interface SpaceAlertsStoreState {
  // Friends whose new spaces the user wants to be told about.
  friendAlertIds: string[];
  // Scheduled spaces the user asked to be reminded about before they start.
  reminderSpaceIds: string[];
  setAll: (friendAlertIds: string[], reminderSpaceIds: string[]) => void;
  toggleFriendAlert: (userId: string) => void;
  toggleReminder: (spaceId: string) => void;
}

const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

// Per-friend "tell me when they start a space" bells and per-space "remind
// me" toggles — stored server-side (users.notificationPrefs.friendAlertIds,
// spaceReminders), which is where the notification jobs read them.
// Optimistic: flip locally, roll back if the API refuses.
export const useSpaceAlertsStore = create<SpaceAlertsStoreState>((set, get) => ({
  friendAlertIds: [],
  reminderSpaceIds: [],
  setAll: (friendAlertIds, reminderSpaceIds) => set({ friendAlertIds, reminderSpaceIds }),
  toggleFriendAlert: (userId) => {
    const on = !get().friendAlertIds.includes(userId);
    set((state) => ({ friendAlertIds: toggle(state.friendAlertIds, userId) }));
    setFriendAlert(userId, on).catch(() => set((state) => ({ friendAlertIds: toggle(state.friendAlertIds, userId) })));
  },
  toggleReminder: (spaceId) => {
    const on = !get().reminderSpaceIds.includes(spaceId);
    set((state) => ({ reminderSpaceIds: toggle(state.reminderSpaceIds, spaceId) }));
    setSpaceReminder(spaceId, on).catch(() => set((state) => ({ reminderSpaceIds: toggle(state.reminderSpaceIds, spaceId) })));
  },
}));
