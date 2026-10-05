import { create } from 'zustand';
import type { AppNotification } from '../types/social';

interface Snoozed {
  notification: AppNotification;
  until: number;
}

interface NotificationStoreState {
  notifications: AppNotification[];
  // Source-event ids already handled. A grouped notification keeps the id
  // of whichever event started the group, so the events it absorbed need
  // their own record — otherwise the next trigger pass would re-send them.
  seenEventIds: string[];
  // Toasts show one at a time: `toastId` is on screen, `toastQueue` waits.
  toastId: string | null;
  toastQueue: string[];
  // When each toast was shown — the daily cap counts today's entries.
  toastLog: number[];
  snoozed: Snoozed[];

  hasSeen: (eventId: string) => boolean;
  markSeen: (eventId: string) => void;
  // Inserts, or replaces in place (moved to the top) when the id exists.
  upsert: (notification: AppNotification) => void;
  update: (id: string, patch: Partial<AppNotification>) => void;
  enqueueToast: (id: string) => void;
  dismissToast: () => void;
  markOpened: (id: string) => void;
  markAllOpened: () => void;
  remove: (id: string) => void;
  snooze: (id: string, minutes: number) => void;
  takeDueSnoozes: (now: number) => AppNotification[];
}

// In-app notification inbox + toast queue. Phase 2 swaps the trigger side
// for the `notification:new` socket event and `markOpened` for
// PATCH /notifications/:id/read (docs/phase2-backend-architecture.md);
// what decides *whether* something toasts lives in
// utils/notifications/deliver.ts, not here.
export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [],
  seenEventIds: [],
  toastId: null,
  toastQueue: [],
  toastLog: [],
  snoozed: [],

  hasSeen: (eventId) => get().seenEventIds.includes(eventId),
  markSeen: (eventId) =>
    set((state) => (state.seenEventIds.includes(eventId) ? state : { seenEventIds: [...state.seenEventIds, eventId] })),

  upsert: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications.filter((n) => n._id !== notification._id)],
    })),
  update: (id, patch) =>
    set((state) => ({ notifications: state.notifications.map((n) => (n._id === id ? { ...n, ...patch } : n)) })),

  enqueueToast: (id) =>
    set((state) => {
      if (state.toastId === id || state.toastQueue.includes(id)) return state;
      const toastLog = [...state.toastLog, Date.now()];
      return state.toastId === null ? { toastId: id, toastLog } : { toastQueue: [...state.toastQueue, id], toastLog };
    }),
  dismissToast: () =>
    set((state) => {
      const [next, ...rest] = state.toastQueue;
      return { toastId: next ?? null, toastQueue: rest };
    }),

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
  remove: (id) =>
    set((state) => {
      const queue = state.toastQueue.filter((q) => q !== id);
      const removingCurrent = state.toastId === id;
      return {
        notifications: state.notifications.filter((n) => n._id !== id),
        toastId: removingCurrent ? queue[0] ?? null : state.toastId,
        toastQueue: removingCurrent ? queue.slice(1) : queue,
      };
    }),

  snooze: (id, minutes) => {
    const notification = get().notifications.find((n) => n._id === id);
    if (!notification) return;
    get().markOpened(id);
    set((state) => ({ snoozed: [...state.snoozed, { notification, until: Date.now() + minutes * 60000 }] }));
  },
  takeDueSnoozes: (now) => {
    const due = get().snoozed.filter((s) => s.until <= now);
    if (due.length === 0) return [];
    set((state) => ({ snoozed: state.snoozed.filter((s) => s.until > now) }));
    return due.map((s) => s.notification);
  },
}));
