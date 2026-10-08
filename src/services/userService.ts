import { api } from '../api/client';
import type {
  AchievementsResponse,
  ActivityResponse,
  AuthSessionResponse,
  GoogleSignInResponse,
  HomeSummary,
  NotificationSettings,
  Paged,
  SessionHistoryItem,
  StatsResponse,
  WeeklyRecapResponse,
} from '../api/types';
import type { User } from '../types/models';

// The signed-in user (GET/PATCH /v1/me…).

type DeviceInfo = { timezone: string; deviceId: string; platform: string };

// Dev accounts only (server AUTH_MODE=dev) — the dev:<uid> token is already set.
export function startAuthSession(input: DeviceInfo) {
  return api.post<AuthSessionResponse>('/auth/session', input);
}

// Trades a Google ID token for a Prodify session token.
export function signInWithGoogleIdToken(input: DeviceInfo & { idToken: string }) {
  return api.post<GoogleSignInResponse>('/auth/google', input);
}

// Revokes this device's session token.
export const logout = () => api.post<{ ok: true }>('/auth/logout');

export const getUserProfile = () => api.get<User>('/me');
export const updateProfile = (patch: Partial<Pick<User, 'displayName' | 'tagline' | 'dailyTargetMin' | 'timezone'>>) =>
  api.patch<User>('/me', patch);
export const getHomeSummary = () => api.get<HomeSummary>('/me/summary');
export const getActivity = (from?: string) => api.get<ActivityResponse>(`/me/activity${from ? `?from=${from}` : ''}`);
export const getStats = (range: 'week' | 'month' = 'week') => api.get<StatsResponse>(`/me/stats?range=${range}`);
export const getLatestRecap = () => api.get<WeeklyRecapResponse>('/me/recaps/latest');
export const getAchievements = () => api.get<AchievementsResponse>('/me/achievements');
export const getSessionHistory = (limit = 20) => api.get<Paged<SessionHistoryItem>>(`/sessions?limit=${limit}`);

export const getNotificationSettings = () =>
  api.get<NotificationSettings & { friendAlertIds: string[] }>('/me/notification-settings');
export const updateNotificationSettings = (patch: {
  categories?: Partial<NotificationSettings['categories']>;
  quietHours?: Partial<NotificationSettings['quietHours']>;
  dailyToastCap?: number;
}) => api.patch<NotificationSettings>('/me/notification-settings', patch);

export const setFriendAlert = (userId: string, on: boolean) =>
  on ? api.put(`/me/friend-alerts/${userId}`) : api.del(`/me/friend-alerts/${userId}`);
export const setSpaceReminder = (spaceId: string, on: boolean) =>
  on ? api.put(`/me/space-reminders/${spaceId}`) : api.del(`/me/space-reminders/${spaceId}`);
