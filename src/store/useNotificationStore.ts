import { create } from 'zustand';
import type { AppNotification } from '../types/social';

interface NotificationStoreState {
  notifications: AppNotification[];
  // The one notification currently shown as the top toast, if any.
  toastId: string | null;
  // Idempotent by `_id` — callers use deterministic ids (e.g.
  // `notif_started_<spaceId>`) so a re-run of the same check can't
  // deliver the same notification twice.
  push: (notification: AppNotification, options?: { toast?: boolean }) => void;
  markOpened: (id: string) => void;
  markAllOpened: () => void;
  dismissToast: () => void;
}

// In-app notification inbox + toast. Phase 2 swaps `push` for the
// `notification:new` socket event and `markOpened` for
// PATCH /notifications/:id/read (docs/phase2-backend-architecture.md).
export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [],
  toastId: null,
  push: (notification, { toast = true } = {}) => {
    if (get().notifications.some((n) => n._id === notification._id)) return;
    const delivered = { ...notification, sentAt: notification.sentAt ?? new Date().toISOString() };
    set((state) => ({
      notifications: [delivered, ...state.notifications],
      toastId: toast ? delivered._id : state.toastId,
    }));
  },
  markOpened: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n._id === id && !n.openedAt ? { ...n, openedAt: new Date().toISOString() } : n
      ),
    })),
  markAllOpened: () => {
    const now = new Date().toISOString();
    set((state) => ({ notifications: state.notifications.map((n) => (n.openedAt ? n : { ...n, openedAt: now })) }));
  },
  dismissToast: () => set({ toastId: null }),
}));
