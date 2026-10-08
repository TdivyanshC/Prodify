import { previewNotification } from '../../services/notificationService';
import type { AppNotificationType } from '../../types/social';

// Dev-only previews (Notification settings → Preview). Many notifications
// are time-gated (Sunday recap, 7pm streak check, 3-day welcome back), so
// this asks the server to send any type on demand through its REAL pipeline
// (forced past dedupe/settings/quiet hours) — it arrives over the socket
// like any other notification.
export const PREVIEW_TYPES: { type: AppNotificationType; label: string }[] = [
  { type: 'join_nudge', label: 'Playful “come focus” nudge' },
  { type: 'space_invite', label: 'Space invite' },
  { type: 'friend_started_space', label: 'Friend started a space' },
  { type: 'space_reminder', label: 'Space reminder' },
  { type: 'own_space_due', label: 'Your space is due' },
  { type: 'space_joined', label: 'Friend joined your space' },
  { type: 'friend_request', label: 'Friend request' },
  { type: 'friend_accepted', label: 'Request accepted' },
  { type: 'friend_milestone', label: 'Friend milestone' },
  { type: 'reactions_received', label: 'Cheer received' },
  { type: 'together_streak_risk', label: 'Together streak' },
  { type: 'streak_at_risk', label: 'Streak at risk' },
  { type: 'goal_close', label: 'Close to goal' },
  { type: 'streak_freeze_used', label: 'Freeze saved streak' },
  { type: 'streak_freeze_earned', label: 'Freeze earned' },
  { type: 'badge_earned', label: 'Badge earned' },
  { type: 'level_up', label: 'Level up' },
  { type: 'weekly_recap', label: 'Weekly recap' },
  { type: 'welcome_back', label: 'Welcome back' },
];

export function sendPreview(type: AppNotificationType) {
  void previewNotification(type).catch(() => undefined);
}
