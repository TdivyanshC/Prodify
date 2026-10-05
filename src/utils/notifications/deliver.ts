import { GROUPED_COPY } from '../../mocks/notificationCopy';
import { mockUser } from '../../mocks/user.mock';
import { useFocusModeStore } from '../../store/useFocusModeStore';
import { useNotificationSettingsStore, isWithinQuietHours } from '../../store/useNotificationSettingsStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import type {
  AppNotification,
  AppNotificationType,
  NotificationAction,
  NotificationCategory,
  NotificationPayload,
  NotificationSender,
  NotificationTone,
} from '../../types/social';
import { getFriendProfile } from '../friendHelpers';
import { firstName, pickCopy, type CopyVars } from './copy';

// How long an unread group stays open to absorb more of the same kind.
const GROUP_WINDOW_MS = 20 * 60 * 1000;

export const CATEGORY_BY_TYPE: Record<AppNotificationType, NotificationCategory> = {
  space_invite: 'spaces',
  friend_started_space: 'spaces',
  space_reminder: 'spaces',
  own_space_due: 'spaces',
  space_joined: 'spaces',
  friend_request: 'friends',
  friend_accepted: 'friends',
  friend_milestone: 'friends',
  reactions_received: 'friends',
  together_streak_risk: 'friends',
  streak_at_risk: 'progress',
  goal_close: 'progress',
  streak_freeze_used: 'progress',
  streak_freeze_earned: 'progress',
  badge_earned: 'progress',
  level_up: 'progress',
  weekly_recap: 'progress',
  welcome_back: 'progress',
  join_nudge: 'nudges',
};

export interface NotificationDraft {
  // Deterministic id of the source event, e.g. `started_<spaceId>` — the
  // dedupe key that makes every trigger safe to re-run.
  eventId: string;
  type: AppNotificationType;
  copy: { title: string; body: string; copyVariantId: string | null };
  sender: NotificationSender;
  tone?: NotificationTone;
  priority?: 'normal' | 'high';
  actions?: NotificationAction[];
  payload?: NotificationPayload;
  groupKey?: string;
}

export type DeliveryResult = 'duplicate' | 'muted' | 'grouped' | 'held' | 'quiet' | 'capped' | 'silent' | 'toasted';

// The single entry point every trigger goes through. In order:
//   1. dedupe by eventId
//   2. category switched off in settings → dropped
//   3. same-groupKey unread notification → merged into it ("+2 others")
//   4. lands in the inbox
//   5. decides whether it also interrupts as a toast:
//      focus mode → held for "While you focused" (nothing interrupts a session)
//      quiet hours / daily cap → inbox only, unless priority is 'high'
export function deliver(draft: NotificationDraft, options: { silent?: boolean; force?: boolean } = {}): DeliveryResult {
  const store = useNotificationStore.getState();
  if (!options.force && store.hasSeen(draft.eventId)) return 'duplicate';
  store.markSeen(draft.eventId);

  const category = CATEGORY_BY_TYPE[draft.type];
  const settings = useNotificationSettingsStore.getState();
  if (!options.force && !settings.categories[category]) return 'muted';

  const now = Date.now();
  let notification: AppNotification = {
    _id: `notif_${draft.eventId}`,
    userId: mockUser._id,
    type: draft.type,
    category,
    title: draft.copy.title,
    body: draft.copy.body,
    sender: draft.sender,
    tone: draft.tone ?? 'default',
    priority: draft.priority ?? 'normal',
    actions: draft.actions ?? [],
    payload: draft.payload ?? {},
    copyVariantId: draft.copy.copyVariantId,
    groupKey: draft.groupKey,
    scheduledAt: new Date(now).toISOString(),
    sentAt: new Date(now).toISOString(),
    openedAt: null,
  };

  let result: DeliveryResult = 'toasted';
  if (draft.groupKey) {
    const open = store.notifications.find(
      (n) =>
        n.groupKey === draft.groupKey &&
        !n.openedAt &&
        n.sentAt !== null &&
        now - new Date(n.sentAt).getTime() < GROUP_WINDOW_MS
    );
    if (open) {
      notification = mergeIntoGroup(open, notification);
      result = 'grouped';
    }
  }

  store.upsert(notification);

  if (options.force) {
    store.enqueueToast(notification._id);
    return 'toasted';
  }
  if (options.silent) return 'silent';

  if (useFocusModeStore.getState().activeSessionId) {
    useFocusModeStore.getState().hold(notification._id);
    return 'held';
  }
  if (notification.priority !== 'high') {
    if (isWithinQuietHours(settings.quietHours)) return 'quiet';
    const cap = settings.dailyToastCap;
    if (cap > 0 && toastsShownToday() >= cap) return 'capped';
  }
  // A group that grew re-toasts, but a toast for it that's already queued
  // or on screen is left alone (enqueueToast dedupes by id).
  store.enqueueToast(notification._id);
  return result;
}

// A snoozed notification coming back: a fresh unread copy (new id, so it
// sits at the top of the inbox) that goes through the same rules again.
// The user asked for it back, so it's high priority.
export function redeliverSnoozed(original: AppNotification, now: number) {
  const { _id, ...rest } = original;
  const eventId = `${_id.replace(/^notif_/, '')}_snz_${now}`;
  deliver({
    eventId,
    type: rest.type,
    copy: { title: rest.title, body: rest.body.replace(/ · Snoozed for \d+ min$/, ''), copyVariantId: rest.copyVariantId },
    sender: rest.sender,
    tone: rest.tone,
    priority: 'high',
    actions: rest.actions,
    payload: rest.payload,
  });
}

function toastsShownToday(): number {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return useNotificationStore.getState().toastLog.filter((t) => t >= startOfDay.getTime()).length;
}

// Merges an incoming notification into an unread one of the same group:
// sender list accumulates, copy switches to the grouped form, and it
// keeps the existing id (so it stays one row in the inbox).
function mergeIntoGroup(existing: AppNotification, incoming: AppNotification): AppNotification {
  const senders = [
    ...(existing.payload.fromUserIds ?? (existing.payload.fromUserId ? [existing.payload.fromUserId] : [])),
    ...(incoming.payload.fromUserIds ?? (incoming.payload.fromUserId ? [incoming.payload.fromUserId] : [])),
  ];
  const fromUserIds = [...new Set(senders)];
  const grouped = GROUPED_COPY[existing.type];
  const lead = firstName(getFriendProfile(fromUserIds[0])?.displayName);
  const othersCount = fromUserIds.length - 1;
  const vars: CopyVars = {
    friend: lead,
    others: `${othersCount} ${othersCount === 1 ? 'other' : 'others'}`,
    emoji: incoming.payload.reactionEmoji ?? existing.payload.reactionEmoji,
    space: incoming.payload.spaceName ?? existing.payload.spaceName,
  };
  const copy = grouped && othersCount > 0 ? pickCopy([grouped], vars) : null;

  return {
    ...incoming,
    _id: existing._id,
    title: copy?.title ?? incoming.title,
    body: copy?.body ?? incoming.body,
    copyVariantId: copy?.copyVariantId ?? incoming.copyVariantId,
    payload: { ...existing.payload, ...incoming.payload, fromUserIds },
    // A group of friends gets the lead friend's face, not the newest one's.
    sender: existing.sender,
  };
}
