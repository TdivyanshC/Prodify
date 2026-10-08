import { MongoServerError, ObjectId } from 'mongodb';
import { GROUPED_COPY, JOIN_NUDGE_COPY, NOTIFICATION_COPY, type CopyVariant } from '../../../../src/mocks/notificationCopy';
import type { AppNotificationType } from '../../../../src/types/social';
import { col } from '../../db/mongo';
import type { NotificationCategory, NotificationDoc, UserDoc } from '../../db/schemas';
import { logger } from '../../lib/logger';
import { localHour, startOfDay, dayKey, MINUTE } from '../../lib/time';
import { emitToUser } from '../../realtime/io';
import { presence } from '../../realtime/presence';

// Server twin of the app's utils/notifications/deliver.ts (backend doc §8.1):
//   1 dedupe by deterministic eventId   2 category muted → dropped
//   3 same-groupKey unread within 20 min → merged ("Riya and 2 others")
//   4 inbox write                        5 delivery mode:
//        open session → held (focus mode: nothing interrupts, any priority)
//        normal priority in quiet hours / over the daily toast cap → inbox
//        otherwise → toast
//   6 socket push `notification:new` (Phase 4 adds FCM for offline users)

export { NOTIFICATION_COPY, JOIN_NUDGE_COPY };
export type CopyVars = Record<string, string | number | undefined>;

const GROUP_WINDOW_MS = 20 * MINUTE;

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
  userId: ObjectId;
  type: AppNotificationType;
  eventId: string;
  variants?: CopyVariant[]; // defaults to NOTIFICATION_COPY[type]
  vars?: CopyVars;
  // Already-rendered copy (snooze re-delivery keeps the original words).
  literal?: { title: string; body: string; copyVariantId: string | null };
  sender: NotificationDoc['sender'];
  tone?: NotificationDoc['tone'];
  priority?: NotificationDoc['priority'];
  actions?: NotificationDoc['actions'];
  payload?: NotificationDoc['payload'];
  groupKey?: string;
}

export type DeliveryResult = 'duplicate' | 'muted' | 'nocopy' | 'grouped' | 'held' | 'inbox' | 'toast' | 'no_user';

const TOKEN = /\{(\w+)\}/g;
export function pickCopy(variants: CopyVariant[], vars: CopyVars) {
  const usable = variants.filter((v) => [...`${v.title} ${v.body}`.matchAll(TOKEN)].every((m) => vars[m[1]] !== undefined && vars[m[1]] !== ''));
  if (usable.length === 0) return null;
  const v = usable[Math.floor(Math.random() * usable.length)];
  const fill = (s: string) => s.replace(TOKEN, (_m, k) => String(vars[k]));
  return { title: fill(v.title), body: fill(v.body), copyVariantId: v.id };
}

export const firstName = (name: string | undefined) => name?.split(' ')[0] ?? 'A friend';

// JSON-safe copy for socket payloads (ObjectId → hex, Date → ISO).
export const plain = <T>(value: T) => JSON.parse(JSON.stringify(value));

export async function deliver(draft: NotificationDraft, opts: { force?: boolean } = {}): Promise<DeliveryResult> {
  const user = await col('users').findOne({ _id: draft.userId });
  if (!user || user.status !== 'active') return 'no_user';
  const now = new Date();

  if (!opts.force) {
    const seen = await col('notifications').countDocuments({ userId: user._id, $or: [{ eventId: draft.eventId }, { absorbedEventIds: draft.eventId }] });
    if (seen > 0) return 'duplicate';
  }
  const category = CATEGORY_BY_TYPE[draft.type];
  if (!opts.force && !user.notificationPrefs.categories[category]) return 'muted';

  const vars = draft.vars ?? {};
  const copy = draft.literal ?? pickCopy(draft.variants ?? NOTIFICATION_COPY[draft.type], vars);
  if (!copy) return 'nocopy';
  const priority = draft.priority ?? 'normal';
  const { delivery, heldForSessionId } = await deliveryMode(user, priority, now, opts.force);

  if (draft.groupKey) {
    const open = await col('notifications').findOne(
      { userId: user._id, groupKey: draft.groupKey, openedAt: null, sentAt: { $gte: new Date(now.getTime() - GROUP_WINDOW_MS) } },
      { sort: { sentAt: -1 } }
    );
    if (open) {
      const merged = await mergeIntoGroup(open, draft, vars, delivery, heldForSessionId, now);
      if (merged) {
        push(user, merged, delivery);
        return 'grouped';
      }
    }
  }

  const doc: NotificationDoc = {
    _id: new ObjectId(),
    userId: user._id,
    eventId: draft.eventId,
    absorbedEventIds: [],
    type: draft.type,
    category,
    title: copy.title,
    body: copy.body,
    copyVariantId: copy.copyVariantId,
    copyVars: vars,
    sender: draft.sender,
    tone: draft.tone ?? 'default',
    priority,
    actions: draft.actions ?? [],
    payload: { fromUserIds: [], ...draft.payload },
    groupKey: draft.groupKey ?? null,
    delivery,
    heldForSessionId,
    actionTaken: null,
    scheduledAt: now,
    sentAt: now,
    openedAt: null,
    createdAt: now,
  };
  try {
    await col('notifications').insertOne(doc);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) return 'duplicate';
    throw err;
  }
  push(user, doc, delivery);
  return delivery;
}

async function deliveryMode(user: UserDoc, priority: 'normal' | 'high', now: Date, force?: boolean) {
  if (force) return { delivery: 'toast' as const, heldForSessionId: null };
  const open = await col('sessions').findOne({ userId: user._id, status: 'active' }, { projection: { _id: 1 } });
  if (open) return { delivery: 'held' as const, heldForSessionId: open._id };
  if (priority === 'normal') {
    const { enabled, startHour, endHour } = user.notificationPrefs.quietHours;
    const hour = Math.floor(localHour(now, user.timezone));
    const quiet =
      enabled && startHour !== endHour && (startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour);
    if (quiet) return { delivery: 'inbox' as const, heldForSessionId: null };
    const cap = user.notificationPrefs.dailyToastCap;
    if (cap > 0) {
      const toastsToday = await col('notifications').countDocuments({
        userId: user._id,
        delivery: 'toast',
        sentAt: { $gte: startOfDay(dayKey(now, user.timezone), user.timezone) },
      });
      if (toastsToday >= cap) return { delivery: 'inbox' as const, heldForSessionId: null };
    }
  }
  return { delivery: 'toast' as const, heldForSessionId: null };
}

async function mergeIntoGroup(
  open: NotificationDoc,
  draft: NotificationDraft,
  vars: CopyVars,
  delivery: NotificationDoc['delivery'],
  heldForSessionId: ObjectId | null,
  now: Date
) {
  const ids = [...(open.payload.fromUserIds ?? []), ...((draft.payload?.fromUserIds as ObjectId[] | undefined) ?? [])];
  const fromUserIds = ids.filter((id, i) => ids.findIndex((x) => x.equals(id)) === i);
  const lead = fromUserIds[0] ? await col('users').findOne({ _id: fromUserIds[0] }, { projection: { displayName: 1 } }) : null;
  const others = fromUserIds.length - 1;
  const grouped = GROUPED_COPY[draft.type];
  const copy =
    grouped && others > 0
      ? pickCopy([grouped], { ...open.copyVars, ...vars, friend: firstName(lead?.displayName), others: `${others} ${others === 1 ? 'other' : 'others'}` })
      : null;
  return col('notifications').findOneAndUpdate(
    { _id: open._id, openedAt: null },
    {
      $set: {
        title: copy?.title ?? open.title,
        body: copy?.body ?? open.body,
        copyVariantId: copy?.copyVariantId ?? open.copyVariantId,
        payload: { ...open.payload, ...draft.payload, fromUserIds },
        sentAt: now,
        delivery,
        heldForSessionId,
      },
      $push: { absorbedEventIds: draft.eventId },
    },
    { returnDocument: 'after' }
  );
}

function push(user: UserDoc, doc: NotificationDoc, delivery: NotificationDoc['delivery']) {
  if (delivery === 'toast') presence.noteToast(user._id.toHexString());
  emitToUser(user._id, 'notification:new', { notification: plain(doc), delivery });
  logger.debug({ userId: user._id.toHexString(), type: doc.type, delivery }, 'notification delivered');
}

// ── Mascot queue (CLAUDE.md §4 priority order) ──────────────────────────
export const MASCOT_PRIORITY: Record<string, number> = {
  streak_at_risk: 1,
  badge_earned: 2,
  level_up: 2,
  friend_achievement: 3,
  welcome_back: 4,
  generic_encouragement: 5,
  idle: 6,
};

export async function pushMascotEvent(userId: ObjectId, eventType: keyof typeof MASCOT_PRIORITY, payload: Record<string, unknown>, sourceService: string) {
  const doc = {
    _id: new ObjectId(),
    userId,
    eventType,
    payload,
    priority: MASCOT_PRIORITY[eventType],
    deliveredAt: null,
    sourceService,
    createdAt: new Date(),
  };
  await col('mascotEvents').insertOne(doc);
  emitToUser(userId, 'mascot:event', plain(doc));
}
