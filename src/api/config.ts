import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// Where the Phase 2 API lives, in priority order:
//  1. EXPO_PUBLIC_API_URL — explicit override (staging, a tunnel, a remote box)
//  2. The dev machine Metro is serving from — in Expo Go / dev builds on Wi-Fi,
//     `hostUri` is "<computer-LAN-IP>:8081", so the API is that IP on :4000.
//     No per-network setup: change Wi-Fi and it follows.
//  3. localhost — web, simulators, or a USB phone with `adb reverse tcp:4000 tcp:4000`.
const API_PORT = 4000;

function devMachineUrl(): string | null {
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "10.19.148.120:8081"
  const host = hostUri?.split(':')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return `http://${host}:${API_PORT}`;
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? devMachineUrl() ?? `http://localhost:${API_PORT}`).replace(/\/$/, '');

// Dev accounts (server AUTH_MODE=dev): the token is "dev:<uid>". Seeded
// accounts are seed-<name> — seed-simran is the main test user.
export const DEV_ACCOUNT = process.env.EXPO_PUBLIC_DEV_ACCOUNT ?? 'seed-simran';

// Google Sign-In is a native module, so it can't run in Expo Go — only in a
// dev build or an APK. EXPO_PUBLIC_AUTH_MODE=dev pauses it on purpose: the
// app signs straight into DEV_ACCOUNT and the sign-in screen lists the seeded
// accounts instead of the Google button.
export const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
export const GOOGLE_AUTH_ENABLED =
  process.env.EXPO_PUBLIC_AUTH_MODE !== 'dev' && !IS_EXPO_GO && Platform.OS !== 'web' && GOOGLE_WEB_CLIENT_ID !== '';
