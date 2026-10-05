import { create } from 'zustand';
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
  toggleCategory: (category: NotificationCategory) => void;
  setQuietHours: (patch: Partial<QuietHours>) => void;
  setDailyToastCap: (cap: number) => void;
}

// Notification preferences — the Phase 1 "Notifications settings" screen
// from claude.md §2. Phase 2 persists these on the user doc; Phase 4's
// delivery job reads the same values before sending a push.
export const useNotificationSettingsStore = create<NotificationSettingsState>((set) => ({
  categories: { spaces: true, friends: true, progress: true, nudges: true },
  quietHours: { enabled: true, startHour: 22, endHour: 8 },
  dailyToastCap: 6,
  toggleCategory: (category) =>
    set((state) => ({ categories: { ...state.categories, [category]: !state.categories[category] } })),
  setQuietHours: (patch) => set((state) => ({ quietHours: { ...state.quietHours, ...patch } })),
  setDailyToastCap: (cap) => set({ dailyToastCap: cap }),
}));

export function isWithinQuietHours(quietHours: QuietHours, date: Date = new Date()): boolean {
  if (!quietHours.enabled || quietHours.startHour === quietHours.endHour) return false;
  const hour = date.getHours();
  return quietHours.startHour < quietHours.endHour
    ? hour >= quietHours.startHour && hour < quietHours.endHour
    : hour >= quietHours.startHour || hour < quietHours.endHour;
}
