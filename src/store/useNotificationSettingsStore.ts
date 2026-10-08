import { create } from 'zustand';
import { getNotificationSettings, updateNotificationSettings } from '../services/userService';
import type { NotificationCategory } from '../types/social';

export interface QuietHours {
  enabled: boolean;
  startHour: number; // 0–23, local
  endHour: number; // 0–23, local; may be < startHour (wraps midnight)
}

interface NotificationSettingsState {
  categories: Record<NotificationCategory, boolean>;
  quietHours: QuietHours;
  // Max toasts per day for normal-priority notifications; 0 = no limit.
  // Over the cap, notifications still land in the inbox — they just stop
  // interrupting.
  dailyToastCap: number;
  load: () => Promise<void>;
  toggleCategory: (category: NotificationCategory) => void;
  setQuietHours: (patch: Partial<QuietHours>) => void;
  setDailyToastCap: (cap: number) => void;
}

// Notification preferences, stored on the user (users.notificationPrefs) —
// the server's delivery pipeline reads them for every notification, so the
// in-app toast and Phase 4 push follow the same rules.
export const useNotificationSettingsStore = create<NotificationSettingsState>((set, get) => ({
  categories: { spaces: true, friends: true, progress: true, nudges: true },
  quietHours: { enabled: true, startHour: 22, endHour: 8 },
  dailyToastCap: 6,
  load: async () => {
    const s = await getNotificationSettings();
    set({ categories: s.categories, quietHours: s.quietHours, dailyToastCap: s.dailyToastCap });
  },
  toggleCategory: (category) => {
    const next = !get().categories[category];
    set((state) => ({ categories: { ...state.categories, [category]: next } }));
    void updateNotificationSettings({ categories: { [category]: next } }).catch(() => get().load());
  },
  setQuietHours: (patch) => {
    set((state) => ({ quietHours: { ...state.quietHours, ...patch } }));
    void updateNotificationSettings({ quietHours: patch }).catch(() => get().load());
  },
  setDailyToastCap: (cap) => {
    set({ dailyToastCap: cap });
    void updateNotificationSettings({ dailyToastCap: cap }).catch(() => get().load());
  },
}));

export function isWithinQuietHours(quietHours: QuietHours, date: Date = new Date()): boolean {
  if (!quietHours.enabled || quietHours.startHour === quietHours.endHour) return false;
  const hour = date.getHours();
  return quietHours.startHour < quietHours.endHour
    ? hour >= quietHours.startHour && hour < quietHours.endHour
    : hour >= quietHours.startHour || hour < quietHours.endHour;
}
