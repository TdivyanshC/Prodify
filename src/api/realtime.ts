import { io, type Socket } from 'socket.io-client';
import { useFocusModeStore } from '../store/useFocusModeStore';
import { useFriendsStore } from '../store/useFriendsStore';
import { useMascotStore } from '../store/useMascotStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { usePeopleStore } from '../store/usePeopleStore';
import { useReactionStore } from '../store/useReactionStore';
import { useSessionStore } from '../store/useSessionStore';
import { useUserStore } from '../store/useUserStore';
import type { Reaction, User } from '../types/models';
import type { AppNotification } from '../types/social';
import { API_URL } from './config';

// Socket.IO client (backend doc §9). REST is the write path; the server
// pushes results here and stores update. Space payloads are per-viewer, so
// `space:changed` only says *that* something changed — the feed is refetched
// (debounced, so a burst of joins is one request).

let socket: Socket | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function debounce(key: string, ms: number, fn: () => void) {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      fn();
    }, ms)
  );
}

const quiet = (p: Promise<unknown>) => void p.catch(() => undefined);
const refreshSpaces = () =>
  debounce('spaces', 700, () => {
    quiet(useSessionStore.getState().refresh());
    quiet(useUserStore.getState().refreshSummary());
  });

export function connectRealtime(token: string) {
  disconnectRealtime();
  socket = io(API_URL, { auth: { token }, transports: ['websocket'], reconnectionDelayMax: 10_000 });

  socket.on('notification:new', ({ notification, delivery }: { notification: AppNotification; delivery: 'toast' | 'inbox' | 'held' }) => {
    useNotificationStore.getState().receive(notification, delivery);
    if (delivery === 'held') useFocusModeStore.getState().hold(notification._id);
  });
  socket.on('notification:updated', ({ id, patch }: { id: string; patch: Partial<AppNotification> }) => {
    useNotificationStore.getState().update(id, patch);
  });
  socket.on('progress:updated', (user: User) => {
    useUserStore.getState().setUser(user);
    debounce('summary', 500, () => quiet(useUserStore.getState().refreshSummary()));
  });
  socket.on('friendship:changed', () => debounce('friends', 400, () => quiet(useFriendsStore.getState().refresh())));
  socket.on('space:changed', refreshSpaces);
  socket.on('presence:update', refreshSpaces);
  socket.on('presence:friends', ({ userId, online }: { userId: string; online: boolean }) => {
    usePeopleStore.getState().setOnline(userId, online);
  });
  socket.on('reaction:changed', (payload: Reaction & { on: boolean }) => {
    useReactionStore.getState().applyRemote(payload, payload.on);
  });
  socket.on('mascot:event', () => debounce('mascot', 500, () => quiet(useMascotStore.getState().refresh())));
  // Dev reseed — everything on screen is stale.
  socket.on('dev:reset', () => {
    quiet(useUserStore.getState().refresh());
    quiet(useSessionStore.getState().refresh());
    quiet(useFriendsStore.getState().refresh());
    quiet(useNotificationStore.getState().load());
  });
  // Reconnects (Wi-Fi drop, app resumed) may have missed pushes.
  socket.io.on('reconnect', () => {
    refreshSpaces();
    quiet(useNotificationStore.getState().load());
    quiet(useFriendsStore.getState().refresh());
  });
}

export function disconnectRealtime() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

// Session Room joins/leaves the space's socket room (presence + reactions).
export function enterSpaceRoom(spaceId: string) {
  socket?.emit('space:enter', { spaceId });
}
export function exitSpaceRoom(spaceId: string) {
  socket?.emit('space:exit', { spaceId });
}
