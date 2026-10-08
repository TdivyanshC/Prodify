import { create } from 'zustand';
import * as api from '../services/notificationService';
import type { AppNotification } from '../types/social';

type Delivery = 'toast' | 'inbox' | 'held';

interface NotificationStoreState {
  notifications: AppNotification[];
  // Toasts show one at a time: `toastId` is on screen, `toastQueue` waits.
  toastId: string | null;
  toastQueue: string[];

  load: () => Promise<void>;
  // A server push (`notification:new`). The server already decided whether
  // it interrupts — dedupe, grouping, quiet hours, cap, focus mode all live
  // in its pipeline (backend doc §8.1).
  receive: (notification: AppNotification, delivery: Delivery) => void;
  // Inserts, or replaces in place (moved to the top) when the id exists.
  upsert: (notification: AppNotification) => void;
  // Local edit only — e.g. an in-place action rewriting the row's body.
  update: (id: string, patch: Partial<AppNotification>) => void;
  enqueueToast: (id: string) => void;
  dismissToast: () => void;
  markOpened: (id: string) => void;
  markAllOpened: () => void;
  remove: (id: string) => void;
  snooze: (id: string, minutes: number) => void;
}

// In-app inbox + toast queue, mirroring GET /notifications and the
// `notification:new` socket event. Writes go straight to the API.
export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [],
  toastId: null,
  toastQueue: [],

  load: async () => {
    const { items } = await api.getNotifications();
    set({ notifications: items });
  },
  receive: (notification, delivery) => {
    get().upsert(notification);
    if (delivery === 'toast') get().enqueueToast(notification._id);
  },
  upsert: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications.filter((n) => n._id !== notification._id)],
    })),
  update: (id, patch) =>
    set((state) => ({ notifications: state.notifications.map((n) => (n._id === id ? { ...n, ...patch } : n)) })),

  enqueueToast: (id) =>
    set((state) => {
      if (state.toastId === id || state.toastQueue.includes(id)) return state;
      return state.toastId === null ? { toastId: id } : { toastQueue: [...state.toastQueue, id] };
    }),
  dismissToast: () =>
    set((state) => {
      const [next, ...rest] = state.toastQueue;
      return { toastId: next ?? null, toastQueue: rest };
    }),

  markOpened: (id) => {
    const target = get().notifications.find((n) => n._id === id);
    if (!target || target.openedAt) return;
    get().update(id, { openedAt: new Date().toISOString() });
    void api.markNotificationOpened(id).catch(() => undefined);
  },
  markAllOpened: () => {
    const now = new Date().toISOString();
    set((state) => ({ notifications: state.notifications.map((n) => (n.openedAt ? n : { ...n, openedAt: now })) }));
    void api.markAllNotificationsOpened().catch(() => undefined);
  },
  remove: (id) => {
    set((state) => {
      const queue = state.toastQueue.filter((q) => q !== id);
      const removingCurrent = state.toastId === id;
      return {
        notifications: state.notifications.filter((n) => n._id !== id),
        toastId: removingCurrent ? (queue[0] ?? null) : state.toastId,
        toastQueue: removingCurrent ? queue.slice(1) : queue,
      };
    });
    void api.deleteNotification(id).catch(() => undefined);
  },
  // The server re-delivers it after `minutes` (high priority, same words).
  snooze: (id, minutes) => {
    get().update(id, { openedAt: new Date().toISOString() });
    void api.snoozeNotification(id, minutes).catch(() => undefined);
  },
}));
