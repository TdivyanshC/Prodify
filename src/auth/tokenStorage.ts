import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Keeps the Prodify session token (and a stable per-install device id) across
// app restarts. SecureStore on phones; localStorage on web, where SecureStore
// doesn't exist. Every read/write is best-effort — a failure just means the
// user signs in again.

const TOKEN_KEY = 'prodify.sessionToken';
const DEVICE_KEY = 'prodify.deviceId';

async function read(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } else if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // storage unavailable — the session just won't survive a restart
  }
}

export const loadSessionToken = () => read(TOKEN_KEY);
export const saveSessionToken = (token: string | null) => write(TOKEN_KEY, token);

// The server keys sign-out per device, so the id must stay stable per install.
export async function getDeviceId(): Promise<string> {
  const existing = await read(DEVICE_KEY);
  if (existing) return existing;
  const id = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await write(DEVICE_KEY, id);
  return id;
}
