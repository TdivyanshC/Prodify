import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { col } from '../../db/mongo';
import type { UserDoc } from '../../db/schemas';
import { emit } from '../../events/bus';
import { emptyStreak } from '../../lib/progress';
import { badRequest, forbidden, notFound, parseId } from '../../lib/errors';
import { addDays, DAY, dayKey, MINUTE, weekStart } from '../../lib/time';
import { me, requireToken, requireUser } from '../../middleware/auth';
import { issueSessionToken, verifyGoogleIdToken, type GoogleIdentity } from '../../lib/authTokens';
import { rateLimit, validate } from '../../middleware/common';
import { scheduleJob } from '../../jobs/scheduler';
import { activity, buildRecap, homeSummary, recapDTO, stats } from '../analytics/service';
import { deliver, pushMascotEvent } from '../notifications/deliver';
import { areFriends, getBadges, getCategories, toUserDTO } from '../views';

// Auth session, the signed-in user, and per-user settings.
export const authRoutes = Router();
export const meRoutes = Router();
export const catalogRoutes = Router();

const isTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const deviceSchema = z.object({ timezone: z.string().refine(isTimezone).optional(), deviceId: z.string().max(100).optional(), platform: z.string().max(20).optional() });

// Called once per app launch: right after picking a dev account, or with a
// saved session token when the app reopens signed in.
authRoutes.post(
  '/session',
  // Many phones share one public IP (carrier NAT, campus Wi-Fi), so the
  // tight limit is per account; the per-IP one only stops floods.
  rateLimit('auth_ip', 3000, 60_000, (req) => `ip:${req.ip}`),
  requireToken,
  rateLimit('auth_account', 10, 60_000, (req) => `uid:${req.firebaseUid}`),
  validate(deviceSchema),
  async (req, res) => {
    const { user, isNew } = await signIn(req.firebaseUid!, {}, req.body, { sessionId: req.authSessionId });
    res.json({ user: toUserDTO(user), isNew });
  }
);

// Real sign-in: verify the Google ID token from native Google Sign-In, create
// or update the account, and return a Prodify session token for this device.
authRoutes.post(
  '/google',
  rateLimit('auth_ip', 3000, 60_000, (req) => `ip:${req.ip}`),
  validate(deviceSchema.extend({ idToken: z.string().min(1) })),
  async (req, res) => {
    const google = await verifyGoogleIdToken(req.body.idToken);
    const { user, isNew, authSessionId } = await signIn(`google:${google.sub}`, google, req.body, { freshSession: true });
    const token = await issueSessionToken(user.firebaseUid, authSessionId.toHexString());
    res.json({ token, user: toUserDTO(user), isNew });
  }
);

authRoutes.post('/logout', requireUser, async (req, res) => {
  if (req.authSessionId) await col('authSessions').updateOne({ _id: req.authSessionId }, { $set: { revokedAt: new Date() } });
  res.json({ ok: true });
});

// Upsert the user (first sign-in creates the account), record the device,
// welcome back after a gap. Shared by dev and Google sign-in.
async function signIn(
  uid: string,
  google: Partial<GoogleIdentity>,
  body: z.infer<typeof deviceSchema>,
  { freshSession = false, sessionId }: { freshSession?: boolean; sessionId?: ObjectId } = {}
): Promise<{ user: UserDoc; isNew: boolean; authSessionId: ObjectId }> {
  const now = new Date();
  let user = await col('users').findOne({ firebaseUid: uid });
  const isNew = !user;
  if (!user) {
    user = newUser(uid, google, body.timezone ?? 'UTC', now);
    await col('users').insertOne(user);
  } else {
    if (user.status !== 'active') throw forbidden('ACCOUNT_' + user.status.toUpperCase(), `This account is ${user.status}`);
    const daysAway = (now.getTime() - user.lastActiveAt.getTime()) / DAY;
    if (daysAway >= 3) {
      await deliver({
        userId: user._id,
        type: 'welcome_back',
        eventId: `welcome_${dayKey(now, user.timezone)}`,
        sender: { kind: 'spark' },
        actions: [{ kind: 'open_spaces', label: 'Browse spaces' }],
      });
      await pushMascotEvent(user._id, 'welcome_back', { daysAway: Math.floor(daysAway) }, 'auth');
    }
    const tz = body.timezone && body.timezone !== user.timezone ? body.timezone : null;
    await col('users').updateOne({ _id: user._id }, { $set: { lastActiveAt: now, ...(tz ? { timezone: tz } : {}) } });
    user = (await col('users').findOne({ _id: user._id }))!;
  }
  const deviceId = body.deviceId ?? 'unknown-device';
  if (sessionId) {
    // Reopening with a session token touches exactly that (already verified
    // unrevoked) row — never a device-wide upsert that could revive an old one.
    await col('authSessions').updateOne({ _id: sessionId }, { $set: { lastUsedAt: now } });
    return { user, isNew, authSessionId: sessionId };
  }
  if (freshSession) {
    // A new session token gets its own row, and older ones on this device are
    // revoked — reviving the old row would also revive any token signed for it.
    await col('authSessions').updateMany({ userId: user._id, deviceId, revokedAt: null }, { $set: { revokedAt: now } });
    const authSessionId = new ObjectId();
    await col('authSessions').insertOne({ _id: authSessionId, userId: user._id, deviceId, platform: body.platform ?? 'unknown', refreshTokenHash: null, createdAt: now, lastUsedAt: now, revokedAt: null });
    return { user, isNew, authSessionId };
  }
  const session = await col('authSessions').findOneAndUpdate(
    { userId: user._id, deviceId },
    { $set: { lastUsedAt: now, platform: body.platform ?? 'unknown', revokedAt: null }, $setOnInsert: { _id: new ObjectId(), createdAt: now, refreshTokenHash: null } },
    { upsert: true, returnDocument: 'after' }
  );
  return { user, isNew, authSessionId: session!._id };
}

function newUser(uid: string, google: Partial<GoogleIdentity>, timezone: string, now: Date): UserDoc {
  return {
    _id: new ObjectId(),
    googleId: google.sub ?? null,
    firebaseUid: uid,
    handle: null,
    email: google.email ?? `${uid}@unknown.prodify`,
    authProvider: 'google',
    status: 'active',
    role: 'user',
    displayName: google.name?.trim().slice(0, 60) || 'New friend',
    avatarUrl: google.picture ?? '',
    tagline: '',
    favoriteCategoryId: null,
    mascotStage: 1,
    dailyTargetMin: 30,
    timezone,
    socialHandles: { instagram: { value: null, isVisible: false }, snapchat: { value: null, isVisible: false } },
    streak: emptyStreak(),
    rolloverThrough: addDays(dayKey(now, timezone), -1),
    points: 0,
    level: 1,
    badgeIds: [],
    counters: { sessionsCompleted: 0, earlySessions: 0, lateSessions: 0, friends: 0 },
    notificationPrefs: {
      categories: { spaces: true, friends: true, progress: true, nudges: true },
      quietHours: { enabled: true, startHour: 22, endHour: 8 },
      dailyToastCap: 6,
      friendAlertIds: [],
    },
    createdAt: now,
    lastActiveAt: now,
  };
}

authRoutes.post('/logout-all', requireUser, async (req, res) => {
  await col('authSessions').updateMany({ userId: me(req)._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  res.json({ ok: true });
});

// ── Me ──────────────────────────────────────────────────────────────────
meRoutes.get('/', (req, res) => {
  res.json(toUserDTO(me(req)));
});

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  tagline: z.string().trim().max(80).optional(),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9._]{3,20}$/).optional(),
  dailyTargetMin: z.number().int().min(5).max(960).optional(),
  timezone: z.string().refine(isTimezone, 'Unknown timezone').optional(),
  socialHandles: z
    .object({
      instagram: z.object({ value: z.string().max(40).nullable(), isVisible: z.boolean() }).optional(),
      snapchat: z.object({ value: z.string().max(40).nullable(), isVisible: z.boolean() }).optional(),
    })
    .optional(),
});

meRoutes.patch('/', validate(patchSchema), async (req, res) => {
  const user = me(req);
  const body = req.body as z.infer<typeof patchSchema>;
  const $set: Record<string, unknown> = {};
  for (const key of ['displayName', 'tagline', 'handle', 'dailyTargetMin', 'timezone'] as const) if (body[key] !== undefined) $set[key] = body[key];
  if (body.socialHandles?.instagram) $set['socialHandles.instagram'] = body.socialHandles.instagram;
  if (body.socialHandles?.snapchat) $set['socialHandles.snapchat'] = body.socialHandles.snapchat;
  if (body.handle && (await col('users').countDocuments({ handle: body.handle, _id: { $ne: user._id } }))) throw badRequest('HANDLE_TAKEN', 'That handle is taken');
  const updated = await col('users').findOneAndUpdate({ _id: user._id }, { $set }, { returnDocument: 'after' });
  emit('user.updated', { userId: user._id });
  res.json(toUserDTO(updated!));
});

meRoutes.get('/summary', async (req, res) => {
  res.json(await homeSummary(me(req)));
});

meRoutes.get('/activity', validate(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), 'query'), async (req, res) => {
  const user = me(req);
  const today = dayKey(new Date(), user.timezone);
  const { from, to } = req.query as { from?: string; to?: string };
  res.json({ items: await activity(user, from ?? addDays(today, -365), to ?? today), today, dailyTargetMin: user.dailyTargetMin, createdAt: user.createdAt });
});

meRoutes.get('/stats', validate(z.object({ range: z.enum(['week', 'month']).default('week'), categoryId: z.string().optional() }), 'query'), async (req, res) => {
  const { range, categoryId } = req.query as { range: 'week' | 'month'; categoryId?: string };
  res.json(await stats(me(req), range, categoryId));
});

// The most recent complete week (Mon–Sun) — stored by the weeklyRecap job,
// built on demand if the job hasn't produced it yet.
meRoutes.get('/recaps/latest', async (req, res) => {
  const user = me(req);
  const lastWeek = addDays(weekStart(dayKey(new Date(), user.timezone)), -7);
  const stored = await col('weeklyRecaps').findOne({ userId: user._id, weekStart: lastWeek });
  res.json(recapDTO(stored ?? (await buildRecap(user, lastWeek))));
});

meRoutes.get('/recaps/:weekStart', async (req, res) => {
  const user = me(req);
  const ws = String(req.params.weekStart);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ws) || weekStart(ws) !== ws) throw badRequest('BAD_WEEK', 'weekStart must be a Monday (YYYY-MM-DD)');
  const stored = await col('weeklyRecaps').findOne({ userId: user._id, weekStart: ws });
  res.json(recapDTO(stored ?? (await buildRecap(user, ws))));
});

// Every badge with earned state, when (from the append-only ledger) and
// live progress toward it from the same counters the badge engine reads.
meRoutes.get('/achievements', async (req, res) => {
  const user = me(req);
  const earnedRows = await col('pointsLedger').find({ userId: user._id, source: 'badge' }, { projection: { badgeId: 1, timestamp: 1 } }).toArray();
  const earnedAt = new Map(earnedRows.map((r) => [r.badgeId, r.timestamp]));
  const current: Record<string, number> = {
    total_xp: user.points,
    streak: user.streak.longest,
    sessions_completed: user.counters.sessionsCompleted,
    early_sessions: user.counters.earlySessions,
    late_sessions: user.counters.lateSessions,
    friend_count: user.counters.friends,
  };
  const items = (await getBadges()).map((b) => {
    const earned = user.badgeIds.includes(b._id);
    return {
      badge: b,
      earned,
      earnedAt: earned ? (earnedAt.get(b._id)?.toISOString() ?? null) : null,
      progress: { current: Math.min(current[b.criteriaType] ?? 0, b.criteriaValue), target: b.criteriaValue },
    };
  });
  items.sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress.current / b.progress.target - a.progress.current / a.progress.target);
  res.json({ items, earnedCount: items.filter((i) => i.earned).length });
});

// ── Notification settings, friend alerts, space reminders ───────────────
meRoutes.get('/notification-settings', (req, res) => {
  const p = me(req).notificationPrefs;
  res.json({ categories: p.categories, quietHours: p.quietHours, dailyToastCap: p.dailyToastCap, friendAlertIds: p.friendAlertIds.map((id) => id.toHexString()) });
});

meRoutes.patch(
  '/notification-settings',
  validate(
    z.object({
      categories: z.object({ spaces: z.boolean(), friends: z.boolean(), progress: z.boolean(), nudges: z.boolean() }).partial().optional(),
      quietHours: z.object({ enabled: z.boolean(), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(0).max(23) }).partial().optional(),
      dailyToastCap: z.number().int().min(0).max(50).optional(),
    })
  ),
  async (req, res) => {
    const $set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req.body.categories ?? {})) $set[`notificationPrefs.categories.${k}`] = v;
    for (const [k, v] of Object.entries(req.body.quietHours ?? {})) $set[`notificationPrefs.quietHours.${k}`] = v;
    if (req.body.dailyToastCap !== undefined) $set['notificationPrefs.dailyToastCap'] = req.body.dailyToastCap;
    const u = (await col('users').findOneAndUpdate({ _id: me(req)._id }, { $set }, { returnDocument: 'after' }))!;
    res.json({ categories: u.notificationPrefs.categories, quietHours: u.notificationPrefs.quietHours, dailyToastCap: u.notificationPrefs.dailyToastCap });
  }
);

meRoutes.put('/friend-alerts/:userId', async (req, res) => {
  const user = me(req);
  const friendId = parseId(req.params.userId, 'user id');
  if (!(await areFriends(user._id, friendId))) throw badRequest('NOT_FRIENDS', 'Alerts are for friends');
  await col('users').updateOne({ _id: user._id }, { $addToSet: { 'notificationPrefs.friendAlertIds': friendId } });
  res.json({ on: true });
});

meRoutes.delete('/friend-alerts/:userId', async (req, res) => {
  await col('users').updateOne({ _id: me(req)._id }, { $pull: { 'notificationPrefs.friendAlertIds': parseId(req.params.userId, 'user id') } });
  res.json({ on: false });
});

meRoutes.put('/space-reminders/:spaceId', async (req, res) => {
  const user = me(req);
  const spaceId = parseId(req.params.spaceId, 'space id');
  const space = await col('spaces').findOne({ _id: spaceId, status: 'scheduled' });
  if (!space) throw notFound('Scheduled space');
  const remindAt = new Date(space.startTime.getTime() - 5 * MINUTE);
  await col('spaceReminders').updateOne({ userId: user._id, spaceId }, { $set: { remindAt }, $setOnInsert: { _id: new ObjectId(), createdAt: new Date() } }, { upsert: true });
  // Re-arm (idempotent) in case the space's own reminder job isn't loaded.
  scheduleJob(`reminder:${spaceId.toHexString()}`, remindAt, 'space.reminder', { spaceId: spaceId.toHexString() });
  res.json({ on: true });
});

meRoutes.delete('/space-reminders/:spaceId', async (req, res) => {
  await col('spaceReminders').deleteOne({ userId: me(req)._id, spaceId: parseId(req.params.spaceId, 'space id') });
  res.json({ on: false });
});

meRoutes.delete('/', async (req, res) => {
  // Soft delete; the 30-day purge job removes PII (backend doc §12).
  await col('users').updateOne({ _id: me(req)._id }, { $set: { status: 'deleted', displayName: 'Deleted user', tagline: '' } });
  res.json({ ok: true });
});

// ── Catalog ─────────────────────────────────────────────────────────────
catalogRoutes.get('/categories', async (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({ items: await getCategories() });
});

catalogRoutes.get('/badges', async (_req, res) => {
  res.json({ items: (await getBadges()).map((b) => ({ ...b, _id: b._id })) });
});
