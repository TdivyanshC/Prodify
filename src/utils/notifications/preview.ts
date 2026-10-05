import { mockBadges } from '../../mocks/badges.mock';
import { NOTIFICATION_COPY } from '../../mocks/notificationCopy';
import { useUserStore } from '../../store/useUserStore';
import type { AppNotificationType, NotificationAction, NotificationPayload, NotificationSender, NotificationTone } from '../../types/social';
import { getLevel } from '../levels';
import { getTodayProgress, getWeeklyRecap } from '../progressStats';
import { pickCopy, type CopyVars } from './copy';
import { deliver } from './deliver';
import { runNudgeTriggers } from './triggers/nudges';

interface PreviewSpec {
  label: string;
  vars: () => CopyVars;
  sender: NotificationSender;
  tone?: NotificationTone;
  actions?: NotificationAction[];
  payload?: NotificationPayload;
}

const riya: NotificationSender = { kind: 'friend', userId: 'user_seed_riya' };
const meera: NotificationSender = { kind: 'friend', userId: 'user_seed_meera' };
const riyaSpace = { spaceId: 'space_riya_graph_sprint', spaceName: 'Graph Problems Sprint' };
const steadyBlaze = mockBadges.find((b) => b._id === 'badge_xp_5000');

// Dev-only previews (Notification settings → Preview). Many notifications
// are time-gated (Sunday recap, 7pm streak check, 3-day welcome back), so
// this sends any type on demand with realistic fixture data, through the
// real pipeline with `force` (skips dedupe, settings, quiet hours, focus).
const PREVIEWS: Partial<Record<AppNotificationType, PreviewSpec>> = {
  space_invite: {
    label: 'Space invite',
    vars: () => ({ friend: 'Kabir', space: 'Morning Reset', theme: 'Wellness' }),
    sender: { kind: 'friend', userId: 'user_seed_kabir' },
    actions: [{ kind: 'join_space', label: 'Join' }],
    payload: { spaceId: 'space_kabir_morning_reset', spaceName: 'Morning Reset' },
  },
  friend_started_space: {
    label: 'Friend started a space',
    vars: () => ({ friend: 'Riya', space: riyaSpace.spaceName, theme: 'Coding & Tech' }),
    sender: riya,
    actions: [{ kind: 'join_space', label: 'Join Riya' }],
    payload: { ...riyaSpace, fromUserId: 'user_seed_riya' },
  },
  space_reminder: {
    label: 'Space reminder',
    vars: () => ({ friend: 'Meera', space: 'Library Hours', minutes: 5, time: '6:00 PM' }),
    sender: meera,
  },
  own_space_due: {
    label: 'Your space is due',
    vars: () => ({ space: 'Deep Work Block', time: 'now' }),
    sender: { kind: 'spark' },
    actions: [
      { kind: 'open_spaces', label: 'Open Spaces' },
      { kind: 'snooze', label: 'Snooze 10 min' },
    ],
  },
  space_joined: {
    label: 'Friend joined your space',
    vars: () => ({ friend: 'Meera', space: 'Deep Work Block' }),
    sender: meera,
  },
  friend_request: {
    label: 'Friend request',
    vars: () => ({ friend: 'Sara' }),
    sender: { kind: 'friend', userId: 'user_seed_sara' },
    actions: [
      { kind: 'accept_friend', label: 'Accept' },
      { kind: 'decline_friend', label: 'Decline' },
    ],
    payload: { friendshipId: 'friendship_sara_incoming', fromUserId: 'user_seed_sara' },
  },
  friend_accepted: {
    label: 'Request accepted',
    vars: () => ({ friend: 'Priya' }),
    sender: { kind: 'friend', userId: 'user_seed_priya' },
  },
  friend_milestone: {
    label: 'Friend milestone',
    vars: () => ({ friend: 'Meera', milestone: 21 }),
    sender: meera,
    actions: [{ kind: 'send_fire', label: 'Send 🔥' }],
    payload: { fromUserId: 'user_seed_meera', milestone: 21 },
  },
  reactions_received: {
    label: 'Cheer received',
    vars: () => ({ friend: 'Riya', emoji: '🔥', space: riyaSpace.spaceName }),
    sender: riya,
  },
  together_streak_risk: {
    label: 'Together streak',
    vars: () => ({ friend: 'Meera', days: 9, next: 10 }),
    sender: meera,
    actions: [{ kind: 'join_space', label: 'Join Meera' }],
    payload: riyaSpace,
  },
  streak_at_risk: {
    label: 'Streak at risk',
    vars: () => ({ streak: useUserStore.getState().user?.streak.current ?? 6, needed: 20 }),
    sender: { kind: 'spark' },
    tone: 'nudge',
    actions: [
      { kind: 'quick_start', label: 'Start 20 min' },
      { kind: 'snooze', label: 'Snooze 10 min' },
    ],
    payload: { durationMin: 20 },
  },
  goal_close: {
    label: 'Close to goal',
    vars: () => {
      const { minutes, target } = getTodayProgress();
      return { remaining: Math.max(5, target - minutes) };
    },
    sender: { kind: 'spark' },
    actions: [{ kind: 'quick_start', label: 'Start 15 min' }],
    payload: { durationMin: 15 },
  },
  streak_freeze_used: {
    label: 'Freeze saved streak',
    vars: () => ({ streak: useUserStore.getState().user?.streak.current ?? 6 }),
    sender: { kind: 'spark' },
  },
  streak_freeze_earned: {
    label: 'Freeze earned',
    vars: () => ({ streak: 7, count: 2 }),
    sender: { kind: 'system', emoji: '❄️' },
    tone: 'reward',
  },
  badge_earned: {
    label: 'Badge earned',
    vars: () => ({ badge: steadyBlaze?.name, icon: steadyBlaze?.icon, description: steadyBlaze?.description }),
    sender: { kind: 'system', emoji: steadyBlaze?.icon ?? '🏅' },
    tone: 'reward',
    actions: [{ kind: 'celebrate', label: 'Celebrate 🎉' }],
  },
  level_up: {
    label: 'Level up',
    vars: () => ({ level: getLevel(useUserStore.getState().user?.points ?? 0) + 1 }),
    sender: { kind: 'spark' },
    tone: 'reward',
    actions: [{ kind: 'celebrate', label: 'Celebrate ✨' }],
  },
  weekly_recap: {
    label: 'Weekly recap',
    vars: () => {
      const recap = getWeeklyRecap();
      return { hours: recap.totalLabel, bestDay: recap.bestDay.day };
    },
    sender: { kind: 'system', emoji: '📊' },
    actions: [{ kind: 'open_recap', label: 'See my week' }],
  },
  welcome_back: {
    label: 'Welcome back',
    vars: () => ({ friend: 'Riya' }),
    sender: { kind: 'spark' },
    actions: [{ kind: 'join_space', label: 'Join them' }],
    payload: riyaSpace,
  },
};

export const PREVIEW_TYPES: { type: AppNotificationType; label: string }[] = [
  { type: 'join_nudge', label: 'Playful “come focus” nudge' },
  ...(Object.entries(PREVIEWS) as [AppNotificationType, PreviewSpec][]).map(([type, spec]) => ({
    type,
    label: spec.label,
  })),
];

export function sendPreview(type: AppNotificationType) {
  const now = Date.now();
  if (type === 'join_nudge') {
    runNudgeTriggers(now, 0, { force: true });
    return;
  }
  const spec = PREVIEWS[type];
  const copy = spec && pickCopy(NOTIFICATION_COPY[type], spec.vars());
  if (!spec || !copy) return;
  deliver(
    {
      eventId: `preview_${type}_${now}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      copy,
      sender: spec.sender,
      tone: spec.tone,
      actions: spec.actions,
      payload: spec.payload,
    },
    { force: true }
  );
}
