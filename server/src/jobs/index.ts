import { ObjectId } from 'mongodb';
import { col } from '../db/mongo';
import type { UserDoc } from '../db/schemas';
import { emit } from '../events/bus';
import { logger } from '../lib/logger';
import { liveTogether, rolloverDay } from '../lib/progress';
import { creditThreshold, sessionCapMin } from '../lib/rules';
import { addDays, dayKey, localHour, MINUTE, weekStart } from '../lib/time';
import { buildRecap, todayTotals } from '../modules/analytics/service';
import { deliver, firstName, JOIN_NUDGE_COPY, pushMascotEvent } from '../modules/notifications/deliver';
import { closeSession } from '../modules/sessions/close';
import { scheduleEmptyCheck, scheduleSpaceJobs } from '../modules/spaces/service';
import { categoryName, friendIdList } from '../modules/views';
import { presence } from '../realtime/presence';
import { registerJob, repeatJob } from './scheduler';

// Background jobs (backend doc §10). Every handler is idempotent:
// notifications dedupe on deterministic eventIds, state transitions are
// conditional updates.

const NUDGE_SLOTS = [
  { slot: 'morning', from: 8, to: 11, context: 'morning' },
  { slot: 'afternoon', from: 13, to: 16, context: 'afternoon' },
  { slot: 'evening', from: 18, to: 21, context: 'evening' },
  { slot: 'late_night', from: 22, to: 24, context: 'late_night' },
] as const;

const roundUp5 = (n: number) => Math.max(5, Math.ceil(n / 5) * 5);
const timeIn = (date: Date, tz: string) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });

export function registerJobs() {
  // ── Space lifecycle (delayed, per space) ──
  registerJob('space.reminder', async ({ spaceId }) => {
    const space = await col('spaces').findOne({ _id: new ObjectId(String(spaceId)), status: 'scheduled' });
    if (!space || !space.hostId) return;
    const host = await col('users').findOne({ _id: space.hostId });
    for (const r of await col('spaceReminders').find({ spaceId: space._id }).toArray()) {
      const u = await col('users').findOne({ _id: r.userId });
      if (!u) continue;
      await deliver({
        userId: u._id,
        type: 'space_reminder',
        eventId: `reminder_${space._id.toHexString()}`,
        vars: {
          space: space.name,
          friend: firstName(host?.displayName),
          minutes: Math.max(1, Math.ceil((space.startTime.getTime() - Date.now()) / MINUTE)),
          time: timeIn(space.startTime, u.timezone),
        },
        sender: { kind: 'friend', userId: space.hostId },
        priority: 'high', // the user asked for this one
        payload: { spaceId: space._id, spaceName: space.name, fromUserId: space.hostId, fromUserIds: [space.hostId] },
      });
    }
  });

  registerJob('space.due', async ({ spaceId }) => {
    const space = await col('spaces').findOne({ _id: new ObjectId(String(spaceId)), status: 'scheduled' });
    if (!space?.hostId) return;
    const host = await col('users').findOne({ _id: space.hostId });
    if (!host) return;
    await deliver({
      userId: host._id,
      type: 'own_space_due',
      eventId: `due_${space._id.toHexString()}`,
      vars: { space: space.name, time: timeIn(space.startTime, host.timezone) },
      sender: { kind: 'spark' },
      priority: 'high',
      actions: [
        { kind: 'start_space_now', label: 'Start now' },
        { kind: 'snooze', label: 'Snooze 10 min' },
      ],
      payload: { spaceId: space._id, spaceName: space.name },
    });
  });

  // Never started → cancelled (backend doc §3 C5: only the host starts a space).
  registerJob('space.expire', async ({ spaceId }) => {
    const space = await col('spaces').findOneAndUpdate(
      { _id: new ObjectId(String(spaceId)), status: 'scheduled' },
      { $set: { status: 'cancelled', endedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (space) emit('space.updated', { space });
  });

  // Empty for the whole grace period → completed.
  registerJob('space.emptyCheck', async ({ spaceId }) => {
    const id = new ObjectId(String(spaceId));
    if ((await col('sessions').countDocuments({ spaceId: id, status: 'active' })) > 0) return;
    const space = await col('spaces').findOneAndUpdate(
      { _id: id, status: 'active', isBotSeeded: false, liveCount: 0 },
      { $set: { status: 'completed', endedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (space) emit('space.updated', { space });
  });

  // ── Session sweep: close sessions past their credit cap (§7.2) ──
  registerJob('sessionSweep', async () => {
    const now = Date.now();
    for (const s of await col('sessions').find({ status: 'active' }).toArray()) {
      if (s.startTime.getTime() + sessionCapMin(s.targetDurationMin) * MINUTE > now) continue;
      const outcome = await closeSession(s._id, 'timeout');
      if (outcome) emit('session.closed', outcome);
    }
  });

  // ── Day rollover: spend a freeze for exactly one missed day, else reset ──
  registerJob('dayRollover', async () => {
    for (const u of await col('users').find({ status: 'active' }).toArray()) {
      const yesterday = addDays(dayKey(new Date(), u.timezone), -1);
      let day = u.rolloverThrough ? addDays(u.rolloverThrough, 1) : yesterday;
      if (day > yesterday) continue;
      let streak = u.streak;
      const used: number[] = [];
      for (; day <= yesterday; day = addDays(day, 1)) {
        const { next, events } = rolloverDay(streak, day);
        streak = next;
        for (const e of events) if (e.type === 'freeze_used') used.push(e.freezesUsed);
      }
      // Guarded on rolloverThrough, so two workers can't both apply it.
      const res = await col('users').updateOne({ _id: u._id, rolloverThrough: u.rolloverThrough }, { $set: { streak, rolloverThrough: yesterday } });
      if (res.modifiedCount === 0) continue;
      for (const n of used) {
        await deliver({
          userId: u._id,
          type: 'streak_freeze_used',
          eventId: `freezeused_${n}`,
          vars: { streak: streak.current },
          sender: { kind: 'spark' },
          priority: 'high',
        });
      }
      if (used.length || streak.current !== u.streak.current) emit('user.updated', { userId: u._id });
    }
  });

  // ── Nudges for online, idle users (§8.3) ──
  registerJob('nudgeTick', async () => {
    for (const id of presence.onlineUserIds()) {
      const u = await col('users').findOne({ _id: new ObjectId(id), status: 'active' });
      if (u) await nudgeUser(u).catch((err) => logger.error({ err, userId: id }, 'nudge failed'));
    }
  });

  // ── Weekly recap: Sunday ≥18:00 local, Monday-morning catch-up ──
  registerJob('weeklyRecap', async () => {
    const now = new Date();
    for (const u of await col('users').find({ status: 'active' }).toArray()) {
      const today = dayKey(now, u.timezone);
      const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
      const hour = localHour(now, u.timezone);
      let ws: string | null = null;
      if (weekday === 0 && hour >= 18) ws = weekStart(today);
      else if (weekday === 1 && hour < 12) ws = addDays(weekStart(today), -7);
      if (!ws || (await col('weeklyRecaps').countDocuments({ userId: u._id, weekStart: ws }))) continue;
      const recap = await buildRecap(u, ws);
      await col('weeklyRecaps').insertOne(recap);
      if (recap.totalMinutes === 0) continue;
      const h = Math.floor(recap.totalMinutes / 60);
      const m = recap.totalMinutes % 60;
      await deliver({
        userId: u._id,
        type: 'weekly_recap',
        eventId: `recap_${addDays(ws, 6)}`,
        vars: { hours: h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`, bestDay: new Date(`${recap.bestDay.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) },
        sender: { kind: 'system', emoji: '📊' },
        actions: [{ kind: 'open_recap', label: 'See my week' }],
        payload: { weekStart: ws },
      });
    }
  });

  // ── Snooze: the notification comes back, high priority, same words ──
  registerJob('notification.redeliver', async ({ notificationId }) => {
    const n = await col('notifications').findOne({ _id: new ObjectId(String(notificationId)) });
    if (!n) return;
    await deliver({
      userId: n.userId,
      type: n.type as never,
      eventId: `${n.eventId}_snz_${Date.now()}`,
      literal: { title: n.title, body: n.body, copyVariantId: n.copyVariantId },
      vars: n.copyVars,
      sender: n.sender,
      tone: n.tone,
      priority: 'high',
      actions: n.actions.filter((a) => a.kind !== 'snooze'),
      payload: n.payload,
    });
  });
}

async function nudgeUser(u: UserDoc) {
  if (await col('sessions').countDocuments({ userId: u._id, status: 'active' })) return; // focus mode
  const now = new Date();
  const hour = localHour(now, u.timezone);
  const { today, minutes } = await todayTotals(u);
  const threshold = creditThreshold(u.dailyTargetMin);

  // Streak at risk: evening, alive streak, today not yet counted. Never "you'll lose it".
  if (hour >= 19 && u.streak.current > 0 && u.streak.lastActiveDate !== today && minutes < threshold) {
    const needed = roundUp5(threshold - minutes);
    const result = await deliver({
      userId: u._id,
      type: 'streak_at_risk',
      eventId: `risk_${today}`,
      vars: { streak: u.streak.current, needed },
      sender: { kind: 'spark' },
      tone: 'nudge',
      actions: [
        { kind: 'quick_start', label: `Start ${needed} min` },
        { kind: 'snooze', label: 'Snooze 10 min' },
      ],
      payload: { durationMin: needed },
    });
    if (result !== 'duplicate') await pushMascotEvent(u._id, 'streak_at_risk', { streak: u.streak.current, needed }, 'nudgeTick');
  }

  const remaining = u.dailyTargetMin - minutes;
  if (hour >= 17 && remaining > 0 && remaining <= 20) {
    await deliver({
      userId: u._id,
      type: 'goal_close',
      eventId: `goalclose_${today}`,
      vars: { remaining },
      sender: { kind: 'spark' },
      actions: [{ kind: 'quick_start', label: `Start ${roundUp5(remaining)} min` }],
      payload: { durationMin: roundUp5(remaining) },
    });
  }

  // Where friends are focusing right now (spaces this user can open).
  const friends = await friendIdList(u._id);
  const friendSet = new Set(friends.map((f) => f.toHexString()));
  const live = await col('sessions').find({ userId: { $in: friends }, status: 'active', spaceId: { $ne: null } }).toArray();
  const spaces = await col('spaces').find({ _id: { $in: live.map((s) => s.spaceId!) }, status: 'active' }).toArray();
  const liveFriends = live
    .map((s) => ({ s, space: spaces.find((sp) => sp._id.equals(s.spaceId!)) }))
    .filter(({ space }) => space && (space.isPublic || (space.hostId && friendSet.has(space.hostId.toHexString())) || space.invitedUserIds.some((id) => id.equals(u._id))));

  // Together streak: strongest live pair whose friend is in a space now and not shared today.
  const pairs = await col('togetherStreaks').find({ userIds: u._id }).toArray();
  const best = pairs
    .map((p) => ({ p, friendId: p.userIds.find((id) => !id.equals(u._id))!, days: liveTogether(p, today) }))
    .filter((x) => x.days > 0 && x.p.lastTogetherDay !== today)
    .map((x) => ({ ...x, spot: liveFriends.find((l) => l.s.userId.equals(x.friendId)) }))
    .filter((x) => x.spot)
    .sort((a, b) => b.days - a.days)[0];
  if (best?.spot?.space) {
    const fname = firstName((await col('users').findOne({ _id: best.friendId }))?.displayName);
    await deliver({
      userId: u._id,
      type: 'together_streak_risk',
      eventId: `together_${today}`,
      vars: { friend: fname, days: best.days, next: best.days + 1 },
      sender: { kind: 'friend', userId: best.friendId },
      actions: [{ kind: 'join_space', label: `Join ${fname}` }],
      payload: { spaceId: best.spot.space._id, spaceName: best.spot.space.name, fromUserId: best.friendId, fromUserIds: [best.friendId] },
    });
  }

  // Playful join nudge: one per slot per day, only when idle (§4 rules).
  const slot = NUDGE_SLOTS.find((s) => hour >= s.from && hour < s.to);
  const onlineSince = presence.onlineSince(u._id.toHexString());
  const lastToast = presence.lastToast(u._id.toHexString());
  if (!slot || !onlineSince || Date.now() - onlineSince < 90_000 || (lastToast && Date.now() - lastToast < 3 * MINUTE)) return;
  const friendSpot = liveFriends[0];
  if (friendSpot?.space) {
    const fname = firstName((await col('users').findOne({ _id: friendSpot.s.userId }))?.displayName);
    await deliver({
      userId: u._id,
      type: 'join_nudge',
      eventId: `nudge_${today}_${slot.slot}`,
      variants: JOIN_NUDGE_COPY.friend_live,
      vars: { friend: fname, space: friendSpot.space.name, minutes: Math.max(1, Math.round((Date.now() - friendSpot.s.startTime.getTime()) / MINUTE)) },
      sender: { kind: 'spark' },
      actions: [
        { kind: 'join_space', label: `Join ${fname}` },
        { kind: 'snooze', label: 'Maybe later' },
      ],
      payload: { spaceId: friendSpot.space._id, spaceName: friendSpot.space.name, fromUserId: friendSpot.s.userId, fromUserIds: [friendSpot.s.userId] },
    });
    return;
  }
  const useStreak = u.streak.current > 0 && minutes < u.dailyTargetMin && Math.random() < 0.5;
  const favorite = u.favoriteCategoryId;
  await deliver({
    userId: u._id,
    type: 'join_nudge',
    eventId: `nudge_${today}_${slot.slot}`,
    variants: useStreak ? JOIN_NUDGE_COPY.streak : JOIN_NUDGE_COPY[slot.context],
    vars: { streak: u.streak.current, theme: favorite ? await categoryName(favorite) : undefined },
    sender: { kind: 'spark' },
    actions: [
      { kind: 'quick_start', label: 'Start a space' },
      { kind: 'snooze', label: 'Maybe later' },
    ],
    payload: { durationMin: 25 },
  });
}

// Cadences + rebuild in-memory delayed jobs from DB state on boot.
export async function startJobs() {
  registerJobs();
  const now = new Date();
  for (const space of await col('spaces').find({ status: 'scheduled' }).toArray()) {
    if (space.startTime.getTime() + 30 * MINUTE < now.getTime()) {
      // Expired while the server was down.
      await col('spaces').updateOne({ _id: space._id, status: 'scheduled' }, { $set: { status: 'cancelled', endedAt: now } });
    } else scheduleSpaceJobs(space);
  }
  for (const space of await col('spaces').find({ status: 'active', isBotSeeded: false, liveCount: 0 }).toArray()) scheduleEmptyCheck(space._id);
  repeatJob('sessionSweep', 2 * MINUTE, { runNow: true });
  repeatJob('dayRollover', 15 * MINUTE, { runNow: true });
  repeatJob('nudgeTick', 5 * MINUTE);
  repeatJob('weeklyRecap', 60 * MINUTE, { runNow: true });
}
