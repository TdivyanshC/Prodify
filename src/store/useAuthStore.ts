import { Platform } from 'react-native';
import { create } from 'zustand';
import { ApiError, getAuthToken, setAuthToken, setUnauthorizedHandler } from '../api/client';
import { DEV_ACCOUNT, GOOGLE_AUTH_ENABLED } from '../api/config';
import { connectRealtime, disconnectRealtime, setSessionRejectedHandler } from '../api/realtime';
import { getGoogleIdToken, GoogleSignInCancelled, signOutOfGoogle } from '../auth/googleSignIn';
import { getDeviceId, loadSessionToken, saveSessionToken } from '../auth/tokenStorage';
import { logout, signInWithGoogleIdToken, startAuthSession } from '../services/userService';
import type { User } from '../types/models';
import { useCatalogStore } from './useCatalogStore';
import { useFocusModeStore } from './useFocusModeStore';
import { useMascotStore } from './useMascotStore';
import { usePeopleStore } from './usePeopleStore';
import { useSpaceAlertsStore } from './useSpaceAlertsStore';
import { useSpaceInviteStore } from './useSpaceInviteStore';
import { useSparkOverlayStore } from './useSparkOverlayStore';
import { useTogetherStreakStore } from './useTogetherStreakStore';
import { useFriendsStore } from './useFriendsStore';
import { useNotificationSettingsStore } from './useNotificationSettingsStore';
import { useNotificationStore } from './useNotificationStore';
import { useReactionStore } from './useReactionStore';
import { useSessionStore } from './useSessionStore';
import { useUserStore } from './useUserStore';

type AuthStatus = 'idle' | 'signing-in' | 'ready' | 'error' | 'signed-out';

interface AuthStoreState {
  status: AuthStatus;
  isAuthenticated: boolean;
  // Shown on the sign-in screen (a failed Google sign-in), unlike `status:
  // 'error'`, which is a failed load of an already-signed-in session.
  error: string | null;
  // True while Google's account picker is open — the button shows a spinner.
  googlePending: boolean;
  accountId: string;
  restore: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithDevAccount: (accountId?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const deviceInfo = async () => ({
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  deviceId: await getDeviceId(),
  platform: Platform.OS,
});

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
const isAuthRejection = (err: unknown) => err instanceof ApiError && (err.status === 401 || err.status === 403);

// Sign-in + bootstrap. Google sign-in: the server verifies Google's ID token
// and returns a Prodify session token, kept in SecureStore so the app
// reopens signed in. With auth paused (Expo Go / EXPO_PUBLIC_AUTH_MODE=dev)
// it signs into a seeded dev account instead. Either way every store loads
// from the API once and the socket keeps them current.
export const useAuthStore = create<AuthStoreState>((set, get) => ({
  status: 'idle',
  isAuthenticated: false,
  error: null,
  googlePending: false,
  accountId: DEV_ACCOUNT,

  // App launch: reuse the saved session if there is one. With auth paused,
  // skip it (and the sign-in screen) and go straight into the dev account.
  restore: async () => {
    if (!GOOGLE_AUTH_ENABLED) return get().signInWithDevAccount();
    const token = await loadSessionToken();
    if (!token) {
      set({ status: 'signed-out' });
      return;
    }
    set({ status: 'signing-in', error: null });
    resetUserData();
    try {
      setAuthToken(token);
      const { user } = await startAuthSession(await deviceInfo());
      await bootstrap(user);
      set({ status: 'ready', isAuthenticated: true });
    } catch (err) {
      setAuthToken(null);
      if (isAuthRejection(err)) {
        // expired or signed out elsewhere — back to the sign-in screen
        await saveSessionToken(null);
        set({ status: 'signed-out', isAuthenticated: false });
      } else {
        set({ status: 'error', isAuthenticated: false, error: message(err) });
      }
    }
  },

  signInWithGoogle: async () => {
    set({ googlePending: true, error: null });
    let token: string;
    let user: User;
    try {
      const idToken = await getGoogleIdToken();
      ({ token, user } = await signInWithGoogleIdToken({ idToken, ...(await deviceInfo()) }));
    } catch (err) {
      set({ googlePending: false, error: err instanceof GoogleSignInCancelled ? null : message(err) });
      return;
    }
    set({ googlePending: false, status: 'signing-in' });
    resetUserData();
    try {
      setAuthToken(token);
      await saveSessionToken(token);
      await bootstrap(user);
      set({ status: 'ready', isAuthenticated: true });
    } catch (err) {
      setAuthToken(null);
      await saveSessionToken(null);
      set({ status: 'signed-out', isAuthenticated: false, error: message(err) });
    }
  },

  signInWithDevAccount: async (accountId = get().accountId) => {
    set({ status: 'signing-in', error: null, accountId });
    resetUserData();
    try {
      setAuthToken(`dev:${accountId}`);
      const { user } = await startAuthSession(await deviceInfo());
      await bootstrap(user);
      set({ status: 'ready', isAuthenticated: true });
    } catch (err) {
      setAuthToken(null);
      set({ status: 'error', isAuthenticated: false, error: message(err) });
    }
  },

  signOut: async () => {
    // Revoke this device's token server-side; signing out still works offline.
    if (getAuthToken() && !getAuthToken()!.startsWith('dev:')) await logout().catch(() => undefined);
    disconnectRealtime();
    setAuthToken(null);
    await saveSessionToken(null);
    await signOutOfGoogle();
    resetUserData();
    set({ status: 'signed-out', isAuthenticated: false, error: null });
  },
}));

// A token that was good and then stopped being (30-day expiry, revoked from
// another device, account disabled): drop it and go back to sign-in instead of
// leaving the app on stale data. Only acts on a live session - sign-in flows
// handle their own failures - and the flag stops a burst of failing requests
// from running it more than once.
let endingSession = false;
async function endRejectedSession() {
  const { status } = useAuthStore.getState();
  if (endingSession || status !== 'ready') return;
  endingSession = true;
  try {
    setAuthToken(null);
    disconnectRealtime();
    await saveSessionToken(null);
    await signOutOfGoogle().catch(() => undefined);
    resetUserData();
    useAuthStore.setState({ status: 'signed-out', isAuthenticated: false, error: 'Your session ended. Please sign in again.' });
  } finally {
    endingSession = false;
  }
}
setUnauthorizedHandler(() => void endRejectedSession());
setSessionRejectedHandler(() => void endRejectedSession());

// Loads every store for the signed-in user, then opens the socket.
async function bootstrap(user: User) {
  useUserStore.getState().setUser(user);
  await useCatalogStore.getState().load();
  await Promise.all([
    useUserStore.getState().refresh(),
    useSessionStore.getState().refresh(),
    useFriendsStore.getState().refresh(),
    useNotificationStore.getState().load(),
    useNotificationSettingsStore.getState().load(),
    useReactionStore.getState().load(),
  ]);
  connectRealtime(getAuthToken()!);
}

// Everything that belongs to one signed-in user — cleared on sign-out and
// before a sign-in, so switching accounts never shows the previous user's
// friends, streaks or inbox.
function resetUserData() {
  useUserStore.setState({ user: null, summary: null, activity: null, weekStats: null });
  useSessionStore.setState({ sessions: [], hasLoaded: false });
  useFriendsStore.setState({ friendships: [], hasLoaded: false });
  usePeopleStore.setState({ profiles: {} });
  useTogetherStreakStore.setState({ streaks: {} });
  useSpaceInviteStore.setState({ invites: [], hasLoaded: false, announcedIds: [] });
  useSpaceAlertsStore.setState({ friendAlertIds: [], reminderSpaceIds: [] });
  useReactionStore.setState({ reactions: [], roomCounts: {} });
  useNotificationStore.setState({ notifications: [], toastId: null, toastQueue: [] });
  useMascotStore.setState({ message: null });
  useFocusModeStore.setState({ activeSessionId: null, enteredAt: null, heldIds: [], lastHeldIds: [] });
  useSparkOverlayStore.setState({ visible: false });
}
