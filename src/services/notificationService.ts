import { api } from '../api/client';
import type { Paged } from '../api/types';
import type { AppNotification, AppNotificationType } from '../types/social';

// The inbox (backend doc §8). The server decides delivery; the client only
// renders and reports what the user did.

export const getNotifications = () => api.get<Paged<AppNotification>>('/notifications?limit=100');
export const markNotificationOpened = (id: string) => api.patch<AppNotification>(`/notifications/${id}`, { opened: true });
export const recordNotificationAction = (id: string, actionTaken: string, body?: string) =>
  api.patch<AppNotification>(`/notifications/${id}`, { actionTaken, ...(body ? { body } : {}) });
export const markAllNotificationsOpened = () => api.post('/notifications/read-all');
export const snoozeNotification = (id: string, minutes: number) => api.post(`/notifications/${id}/snooze`, { minutes });
export const deleteNotification = (id: string) => api.del(`/notifications/${id}`);
// Dev-only preview panel: runs the real server pipeline for any type.
export const previewNotification = (type: AppNotificationType) => api.post('/dev/notifications/preview', { type });
