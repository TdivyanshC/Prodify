import type { ObjectId } from 'mongodb';
import { GROUPED_COPY, JOIN_NUDGE_COPY, NOTIFICATION_COPY, type CopyVariant } from '../shared/notificationCopy';
import { hashInt, oid } from '../lib/ids';
import { creditThreshold, levelFor, pairKey, stageFor, TOGETHER_MIN_OVERLAP_MIN } from '../lib/rules';
import { addDays, addMinutes, DAY, dayKey, localHour, MINUTE, minutesBetween, weekStart, zonedTime } from '../lib/time';
import { BADGES, BLOCKS, CATEGORIES, FRIENDSHIPS, MAIN_USER, REPORTS, type CatSlug } from './fixtures';
import { areFriendsAt, friendshipAcceptedAt, type Activity, type RawSession, type RawSpace } from './generate';
import type { ReplayResult } from './replay';

export type Doc = Record<string, unknown>;
export type SeedData = Record<string, Doc[]>;

// Order matters only for readability of dumps; run.ts inserts all of them.
export const COLLECTIONS = [
  'users',
  'authSessions',
  'sessionCategories',
  'badges',
  'friendships',
  'blocks',
  'reports',
  'spaces',
  'sessions',
  'dailyStats',
  'userDailyTotal',
  'pointsLedger',
  'reactions',
  'togetherStreaks',
  'spaceReminders',
  'notifications',
  'mascotEvents',
  'weeklyRecaps',
] as const;

const CATEGORY_BY_TYPE: Record<string, 'spaces' | 'friends' | 'progress' | 'nudges'> = {
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

const MASCOT_PRIORITY: Record<string, number> = {
  streak_at_risk: 1,
  badge_earned: 2,
  level_up: 2,
  friend_achievement: 3,
  welcome_back: 4,
  generic_encouragement: 5,
  idle: 6,
};

const REACTION_EMOJI = { clap: '👏', fire: '🔥', fist_bump: '🤜' } as const;

const firstName = (name: string) => name.split(' ')[0];
const roundUp5 = (n: number) => Math.max(5, Math.ceil(n / 5) * 5);

export function assemble(activity: Activity, result: ReplayResult): SeedData {
  const { users, sessions, spaces, now } = activity;
  const { states, closed, together } = result;

  const userId = (key: string) => users.get(key)!.id;
  // Fixed catalogs keep stable string ids (`cat_coding`, `badge_xp_1000`) —
  // the app's theme colors and badge art key off them.
  const categoryId = (slug: CatSlug) => CATEGORIES.find((c) => c.slug === slug)!.legacyId;
  const badgeId = (key: string) => key;
  const spaceById = new Map(spaces.map((s) => [s.key, s]));
  const name = (key: string) => users.get(key)!.persona.displayName;
  const categoryName = (slug: CatSlug) => CATEGORIES.find((c) => c.slug === slug)!.name;
  const sessionsOf = (user: string) => sessions.filter((s) => s.user === user);
  const openSessionAt = (user: string, at: Date) =>
    sessionsOf(user).find((s) => s.start <= at && (s.end === null || at < s.end)) ?? null;

  const data: SeedData = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));

  // ── Catalogs ──────────────────────────────────────────────────────────
  data.sessionCategories = CATEGORIES.map((c, i) => ({
    _id: categoryId(c.slug),
    name: c.name,
    sortOrder: i,
    icon: c.icon,
    isCustom: false,
    createdBy: null,
  }));
  data.badges = BADGES.map((b) => ({ _id: badgeId(b.key), ...b }));

  // ── Users ─────────────────────────────────────────────────────────────
  for (const u of users.values()) {
    const state = states.get(u.key)!;
    const p = u.persona;
    const thirtyDaysAgo = addDays(u.today, -30);
    const catMinutes = new Map<CatSlug, number>();
    for (const [day, totals] of state.daily) {
      if (day < thirtyDaysAgo) continue;
      for (const [cat, v] of totals.byCat) catMinutes.set(cat, (catMinutes.get(cat) ?? 0) + v.minutes);
    }
    const favorite = [...catMinutes].sort((a, b) => b[1] - a[1])[0]?.[0];
    const mine = sessionsOf(u.key);
    const lastActiveAt = mine.some((s) => s.end === null)
      ? now
      : mine.reduce((max, s) => (s.end && s.end > max ? s.end : max), u.createdAt);
    const level = levelFor(state.points);
    data.users.push({
      _id: u.id,
      googleId: `seed-google-${u.key}`,
      firebaseUid: `seed-${u.key}`,
      handle: p.handle,
      email: `${u.key}@seed.prodify.test`,
      authProvider: 'google',
      status: 'active',
      role: 'user',
      displayName: p.displayName,
      avatarUrl: '',
      tagline: p.tagline,
      favoriteCategoryId: favorite ? categoryId(favorite) : null,
      mascotStage: stageFor(level),
      dailyTargetMin: p.dailyTargetMin,
      timezone: u.tz,
      socialHandles: {
        instagram: p.socialHandles?.instagram ?? { value: null, isVisible: false },
        snapchat: p.socialHandles?.snapchat ?? { value: null, isVisible: false },
      },
      streak: { ...state.streak },
      rolloverThrough: state.rolloverThrough,
      points: state.points,
      level,
      badgeIds: state.badges.map((b) => badgeId(b.key)),
      counters: { ...state.counters },
      notificationPrefs: {
        categories: { spaces: true, friends: true, progress: true, nudges: p.notificationPrefs?.nudges ?? true },
        quietHours: p.notificationPrefs?.quietHours ?? { enabled: true, startHour: 22, endHour: 8 },
        dailyToastCap: p.notificationPrefs?.dailyToastCap ?? 6,
        friendAlertIds: (p.notificationPrefs?.friendAlerts ?? []).map(userId),
      },
      createdAt: u.createdAt,
      lastActiveAt,
    });
    data.authSessions.push({
      _id: oid(`authSession:${u.key}`),
      userId: u.id,
      deviceId: `seed-device-${u.key}`,
      platform: p.platform,
      // Firebase owns refresh tokens (backend doc §5.2); this row is the
      // device-management/audit layer only.
      refreshTokenHash: null,
      createdAt: u.createdAt,
      lastUsedAt: lastActiveAt,
      revokedAt: null,
    });
  }

  // ── Relationships ─────────────────────────────────────────────────────
  const friendshipIdOf = (a: string, b: string) => oid(`friendship:${pairKey(a, b)}`);
  for (const f of FRIENDSHIPS) {
    const [idA, idB] = [userId(f.a), userId(f.b)].sort((x, y) => x.toHexString().localeCompare(y.toHexString()));
    data.friendships.push({
      _id: friendshipIdOf(f.a, f.b),
      userIdA: idA, // canonical: userIdA < userIdB (DB doc §2)
      userIdB: idB,
      status: f.status,
      requestedBy: userId(f.requestedBy),
      createdAt: new Date(now.getTime() - f.requestedDaysAgo * DAY),
      respondedAt: f.respondedDaysAgo !== undefined ? new Date(now.getTime() - f.respondedDaysAgo * DAY) : null,
    });
  }
  for (const b of BLOCKS) {
    data.blocks.push({ _id: oid(`block:${b.blocker}:${b.blocked}`), blockerId: userId(b.blocker), blockedId: userId(b.blocked), createdAt: new Date(now.getTime() - b.daysAgo * DAY) });
  }
  for (const r of REPORTS) {
    data.reports.push({
      _id: oid(`report:${r.reporter}:${r.reported}`),
      reporterId: userId(r.reporter),
      reportedUserId: userId(r.reported),
      sessionId: null,
      spaceId: null,
      reason: r.reason,
      createdAt: new Date(now.getTime() - r.daysAgo * DAY),
      status: 'open',
    });
  }

  // ── Spaces & sessions ─────────────────────────────────────────────────
  for (const s of spaces) {
    const open = sessions.filter((x) => x.spaceKey === s.key && x.end === null).length;
    data.spaces.push({
      _id: oid(s.key),
      categoryId: categoryId(s.category),
      name: s.name,
      description: s.description,
      hostId: s.host ? userId(s.host) : null,
      isPublic: s.isPublic,
      maxParticipants: s.maxParticipants,
      durationTargetMin: s.targetMin,
      status: s.status,
      startTime: s.startTime,
      endedAt: s.endedAt,
      invitedUserIds: s.invited.map(userId),
      declinedUserIds: [],
      liveCount: s.status === 'active' ? open : 0,
      isBotSeeded: s.isBotSeeded,
      syntheticCount: s.syntheticCount,
      createdAt: s.createdAt,
    });
  }
  for (const s of sessions) {
    const c = closed.get(s.key);
    data.sessions.push({
      _id: oid(s.key),
      userId: userId(s.user),
      categoryId: categoryId(s.category),
      spaceId: s.spaceKey ? oid(s.spaceKey) : null,
      type: s.spaceKey ? 'space' : 'solo',
      startTime: s.start,
      endTime: s.end,
      durationMin: c?.durationMin ?? 0,
      targetDurationMin: s.targetMin,
      status: c ? 'completed' : 'active',
      closedReason: c?.closedReason ?? null,
      completed: Boolean(c),
      targetHit: c?.targetHit ?? false,
      xpEarned: c?.xpEarned ?? 0,
      createdAt: s.start,
    });
  }

  // ── Rollups & ledger ──────────────────────────────────────────────────
  for (const u of users.values()) {
    const state = states.get(u.key)!;
    for (const [day, totals] of state.daily) {
      data.userDailyTotal.push({ _id: oid(`udt:${u.key}:${day}`), userId: u.id, date: day, totalMinutes: totals.total, xpEarned: totals.xp });
      for (const [cat, v] of totals.byCat) {
        data.dailyStats.push({
          _id: oid(`ds:${u.key}:${cat}:${day}`),
          userId: u.id,
          categoryId: categoryId(cat),
          date: day,
          totalMinutes: v.minutes,
          sessionCount: v.count,
          xpEarned: v.xp,
        });
      }
    }
    state.ledger.forEach((entry, i) => {
      data.pointsLedger.push({
        _id: oid(`ledger:${u.key}:${i}`),
        userId: u.id,
        source: entry.source,
        amount: entry.amount,
        sessionId: entry.sessionKey ? oid(entry.sessionKey) : null,
        badgeId: entry.badgeKey ? badgeId(entry.badgeKey) : null,
        timestamp: entry.at,
      });
    });
  }

  for (const [key, t] of together) {
    const [a, b] = t.users.map(userId).sort((x, y) => x.toHexString().localeCompare(y.toHexString()));
    data.togetherStreaks.push({
      _id: oid(`together:${key}`),
      pairKey: `${a.toHexString()}_${b.toHexString()}`,
      userIds: [a, b],
      current: t.current,
      longest: t.longest,
      lastTogetherDay: t.lastTogetherDay,
    });
  }

  for (const s of spaces) {
    for (const user of s.reminders) {
      data.spaceReminders.push({
        _id: oid(`reminder:${user}:${s.key}`),
        userId: userId(user),
        spaceId: oid(s.key),
        remindAt: addMinutes(s.startTime, -5),
        createdAt: addMinutes(now, -120),
      });
    }
  }

  // ── Notifications ─────────────────────────────────────────────────────
  const seenEvents = new Set<string>();
  const byGroup = new Map<string, Doc>();

  interface Draft {
    user: string;
    type: string;
    eventId: string;
    variants: CopyVariant[];
    vars: Record<string, string | number | undefined>;
    sender: Doc;
    sentAt: Date;
    tone?: 'default' | 'reward' | 'nudge';
    priority?: 'normal' | 'high';
    actions?: { kind: string; label: string }[];
    payload?: Doc;
    groupKey?: string;
    openedAt?: Date | null; // undefined → default (read if older than a day)
    actionTaken?: string;
  }

  const pickVariant = (variants: CopyVariant[], vars: Draft['vars'], salt: string) => {
    const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k]));
    const usable = variants.filter((v) =>
      [...`${v.title} ${v.body}`.matchAll(/\{(\w+)\}/g)].every((m) => vars[m[1]] !== undefined && vars[m[1]] !== '')
    );
    if (usable.length === 0) return null;
    const v = usable[hashInt(salt) % usable.length];
    return { title: fill(v.title), body: fill(v.body), copyVariantId: v.id };
  };

  // Mirrors deliver(): dedupe → mute → group → inbox → delivery mode.
  const notify = (d: Draft) => {
    if (d.sentAt > now) return;
    const dedupeKey = `${d.user}|${d.eventId}`;
    if (seenEvents.has(dedupeKey)) return;
    seenEvents.add(dedupeKey);
    const u = users.get(d.user)!;
    const category = CATEGORY_BY_TYPE[d.type];
    if (category === 'nudges' && u.persona.notificationPrefs?.nudges === false) return;

    const priority = d.priority ?? 'normal';
    const focusSession = openSessionAt(d.user, d.sentAt);
    const hour = localHour(d.sentAt, u.tz);
    const delivery = focusSession
      ? focusSession.end === null
        ? 'held'
        : 'inbox' // held during the session, flipped to inbox on close
      : priority === 'normal' && (hour >= 22 || hour < 8)
        ? 'inbox'
        : 'toast';
    const openedAt =
      d.openedAt !== undefined
        ? d.openedAt
        : now.getTime() - d.sentAt.getTime() > DAY
          ? addMinutes(d.sentAt, 5 + (hashInt(d.eventId) % 175))
          : null;

    const groupId = d.groupKey ? `${d.user}|${d.groupKey}` : null;
    const open = groupId ? byGroup.get(groupId) : undefined;
    if (open && !open.openedAt && d.sentAt.getTime() - (open.sentAt as Date).getTime() < 20 * MINUTE) {
      // Group merge: keep the lead's id/sender, accumulate senders, grouped copy.
      const payload = open.payload as Doc;
      const fromUserIds = [...(payload.fromUserIds as ObjectId[]), ...(((d.payload?.fromUserIds as ObjectId[]) ?? []))];
      const unique = fromUserIds.filter((id, i) => fromUserIds.findIndex((x) => x.equals(id)) === i);
      const grouped = GROUPED_COPY[d.type as keyof typeof GROUPED_COPY];
      const others = unique.length - 1;
      const copy = grouped
        ? pickVariant([grouped], { ...(open.copyVars as Doc as Draft['vars']), ...d.vars, friend: (open.copyVars as Draft['vars']).friend, others: `${others} ${others === 1 ? 'other' : 'others'}` }, d.eventId)
        : null;
      Object.assign(open, {
        title: copy?.title ?? open.title,
        body: copy?.body ?? open.body,
        copyVariantId: copy?.copyVariantId ?? open.copyVariantId,
        payload: { ...payload, ...d.payload, fromUserIds: unique },
        absorbedEventIds: [...(open.absorbedEventIds as string[]), d.eventId],
        sentAt: d.sentAt,
        openedAt,
        delivery,
      });
      return;
    }

    const copy = pickVariant(d.variants, d.vars, d.eventId);
    if (!copy) return;
    const doc: Doc = {
      _id: oid(`notif:${dedupeKey}`),
      userId: u.id,
      eventId: d.eventId,
      absorbedEventIds: [],
      type: d.type,
      category,
      title: copy.title,
      body: copy.body,
      copyVariantId: copy.copyVariantId,
      copyVars: d.vars,
      sender: d.sender,
      tone: d.tone ?? 'default',
      priority,
      actions: d.actions ?? [],
      payload: { fromUserIds: [], ...d.payload },
      groupKey: d.groupKey ?? null,
      delivery,
      heldForSessionId: focusSession ? oid(focusSession.key) : null,
      actionTaken: d.actionTaken ?? null,
      scheduledAt: d.sentAt,
      sentAt: d.sentAt,
      openedAt,
      createdAt: d.sentAt,
    };
    data.notifications.push(doc);
    if (groupId) byGroup.set(groupId, doc);
  };

  const friendSender = (key: string) => ({ kind: 'friend', userId: userId(key) });
  const spark = { kind: 'spark' };
  const spacePayload = (s: RawSpace, from?: string) => ({
    spaceId: oid(s.key),
    spaceName: s.name,
    ...(from ? { fromUserId: userId(from), fromUserIds: [userId(from)] } : {}),
  });
  const joinTimeOf = (user: string, s: RawSpace) => sessions.find((x) => x.spaceKey === s.key && x.user === user)?.start ?? null;

  // Invites — every invitee of every space (friends-only history + scripted).
  for (const s of spaces) {
    if (!s.host) continue;
    const scheduled = s.status === 'scheduled' || s.status === 'cancelled';
    for (const invitee of s.invited) {
      const joinedAt = joinTimeOf(invitee, s);
      const remindSet = s.reminders.includes(invitee);
      notify({
        user: invitee,
        type: 'space_invite',
        eventId: `invite_${oid(s.key).toHexString()}_${userId(invitee).toHexString()}`,
        variants: NOTIFICATION_COPY.space_invite,
        vars: { friend: firstName(name(s.host)), space: s.name, theme: categoryName(s.category) },
        sender: friendSender(s.host),
        sentAt: scheduled ? s.createdAt : addMinutes(s.startTime, 1),
        priority: 'high',
        actions: scheduled ? [{ kind: 'remind_space', label: 'Remind me' }] : [{ kind: 'join_space', label: 'Join' }],
        payload: spacePayload(s, s.host),
        groupKey: `invite_${oid(s.key).toHexString()}`,
        openedAt: joinedAt ?? (remindSet ? addMinutes(s.createdAt, 3) : undefined),
        actionTaken: joinedAt ? 'joined' : remindSet ? 'reminder_set' : undefined,
      });
    }
  }

  // Friends going live → users with that friend's bell on (grouped).
  for (const s of [...spaces].filter((x) => x.host && x.status !== 'scheduled' && x.status !== 'cancelled').sort((a, b) => a.startTime.getTime() - b.startTime.getTime())) {
    for (const u of users.values()) {
      const alerts = u.persona.notificationPrefs?.friendAlerts ?? [];
      if (!alerts.includes(s.host!) || !areFriendsAt(u.key, s.host!, s.startTime, now)) continue;
      if (now.getTime() - s.startTime.getTime() > 14 * DAY) continue;
      notify({
        user: u.key,
        type: 'friend_started_space',
        eventId: `started_${oid(s.key).toHexString()}`,
        variants: NOTIFICATION_COPY.friend_started_space,
        vars: { friend: firstName(name(s.host!)), space: s.name, theme: categoryName(s.category) },
        sender: friendSender(s.host!),
        sentAt: s.startTime,
        actions: [{ kind: 'join_space', label: `Join ${firstName(name(s.host!))}` }],
        payload: spacePayload(s, s.host!),
        groupKey: 'friend_started',
      });
    }
  }

  // Guests joining a host's space (last 3 days), grouped per space.
  for (const s of spaces) {
    if (!s.host || now.getTime() - s.startTime.getTime() > 3 * DAY) continue;
    const guests = sessions.filter((x) => x.spaceKey === s.key && x.user !== s.host).sort((a, b) => a.start.getTime() - b.start.getTime());
    for (const g of guests) {
      notify({
        user: s.host,
        type: 'space_joined',
        eventId: `joined_${oid(s.key).toHexString()}_${userId(g.user).toHexString()}`,
        variants: NOTIFICATION_COPY.space_joined,
        vars: { friend: firstName(name(g.user)), space: s.name },
        sender: friendSender(g.user),
        sentAt: g.start,
        payload: spacePayload(s, g.user),
        groupKey: `joined_${oid(s.key).toHexString()}`,
      });
    }
  }

  // Main user's own scheduled-then-started space + a reminder she'd set.
  const yesterdayLibrary = spaceById.get('space:library:d1');
  if (yesterdayLibrary) {
    notify({
      user: MAIN_USER,
      type: 'own_space_due',
      eventId: `due_${oid(yesterdayLibrary.key).toHexString()}`,
      variants: NOTIFICATION_COPY.own_space_due,
      vars: { space: yesterdayLibrary.name, time: '9:00 PM' },
      sender: spark,
      sentAt: addMinutes(yesterdayLibrary.startTime, -1),
      priority: 'high',
      actions: [
        { kind: 'start_space_now', label: 'Start now' },
        { kind: 'snooze', label: 'Snooze 10 min' },
      ],
      payload: spacePayload(yesterdayLibrary),
      openedAt: yesterdayLibrary.startTime,
      actionTaken: 'started',
    });
  }
  const yesterdayGraph = spaceById.get('space:graph:d1');
  if (yesterdayGraph && joinTimeOf(MAIN_USER, yesterdayGraph)) {
    notify({
      user: MAIN_USER,
      type: 'space_reminder',
      eventId: `reminder_${oid(yesterdayGraph.key).toHexString()}`,
      variants: NOTIFICATION_COPY.space_reminder,
      vars: { space: yesterdayGraph.name, friend: 'Riya', minutes: 5, time: '6:00 PM' },
      sender: friendSender('riya'),
      sentAt: addMinutes(yesterdayGraph.startTime, -5),
      priority: 'high',
      payload: spacePayload(yesterdayGraph, 'riya'),
      openedAt: addMinutes(yesterdayGraph.startTime, -4),
    });
  }

  // Friend requests (pending → still actionable) and acceptances.
  for (const f of FRIENDSHIPS) {
    const other = f.requestedBy === f.a ? f.b : f.a;
    const fid = friendshipIdOf(f.a, f.b);
    if (f.status === 'pending') {
      notify({
        user: other,
        type: 'friend_request',
        eventId: `request_${fid.toHexString()}`,
        variants: NOTIFICATION_COPY.friend_request,
        vars: { friend: firstName(name(f.requestedBy)) },
        sender: friendSender(f.requestedBy),
        sentAt: new Date(now.getTime() - f.requestedDaysAgo * DAY),
        actions: [
          { kind: 'accept_friend', label: 'Accept' },
          { kind: 'decline_friend', label: 'Decline' },
        ],
        payload: { friendshipId: fid, fromUserId: userId(f.requestedBy), fromUserIds: [userId(f.requestedBy)] },
        openedAt: null,
      });
    } else if (f.respondedDaysAgo! <= 60) {
      notify({
        user: f.requestedBy,
        type: 'friend_accepted',
        eventId: `accepted_${fid.toHexString()}`,
        variants: NOTIFICATION_COPY.friend_accepted,
        vars: { friend: firstName(name(other)) },
        sender: friendSender(other),
        sentAt: friendshipAcceptedAt(f.a, f.b, now)!,
        payload: { friendshipId: fid, fromUserId: userId(other), fromUserIds: [userId(other)] },
      });
    }
  }

  // Friend streak milestones (last 14 days) — the main user 🔥s the latest one.
  const milestoneReactions: Doc[] = [];
  const recentMilestones: { friend: string; streak: number; at: Date }[] = [];
  for (const f of users.values()) {
    for (const e of states.get(f.key)!.events) {
      if (e.type === 'streak_milestone' && now.getTime() - e.at.getTime() <= 14 * DAY) recentMilestones.push({ friend: f.key, streak: e.streak, at: e.at });
    }
  }
  recentMilestones.sort((a, b) => a.at.getTime() - b.at.getTime());
  const mainLatest = [...recentMilestones].reverse().find((m) => areFriendsAt(MAIN_USER, m.friend, m.at, now));
  for (const m of recentMilestones) {
    for (const u of users.values()) {
      if (u.key === m.friend || !areFriendsAt(u.key, m.friend, m.at, now)) continue;
      const contextId = `milestone_${userId(m.friend).toHexString()}_${m.streak}_${dayKey(m.at, users.get(m.friend)!.tz)}`;
      const sentFire = u.key === MAIN_USER && m === mainLatest;
      notify({
        user: u.key,
        type: 'friend_milestone',
        eventId: contextId,
        variants: NOTIFICATION_COPY.friend_milestone,
        vars: { friend: firstName(name(m.friend)), milestone: m.streak },
        sender: friendSender(m.friend),
        sentAt: m.at,
        actions: sentFire ? [] : [{ kind: 'send_fire', label: 'Send 🔥' }],
        payload: { fromUserId: userId(m.friend), fromUserIds: [userId(m.friend)], milestone: m.streak },
        openedAt: sentFire ? addMinutes(m.at, 30) : undefined,
        actionTaken: sentFire ? 'sent_fire' : undefined,
      });
      if (sentFire) {
        milestoneReactions.push({
          _id: oid(`reaction:${contextId}:${MAIN_USER}:fire`),
          contextType: 'milestone',
          contextId,
          fromUserId: userId(MAIN_USER),
          toUserId: userId(m.friend),
          type: 'fire',
          createdAt: addMinutes(m.at, 30),
        });
      }
    }
  }

  // Reactions (space context) + reactions_received (last 7 days, grouped per space/day).
  const reactionKeys = new Set<string>();
  for (const r of [...activity.reactions].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const key = `${r.contextKey}|${r.from}|${r.to}|${r.type}`;
    if (reactionKeys.has(key)) continue; // unique index — toggle semantics
    reactionKeys.add(key);
    const space = spaceById.get(r.contextKey);
    if (!space) continue;
    data.reactions.push({
      _id: oid(`reaction:${key}`),
      contextType: 'space',
      contextId: oid(r.contextKey),
      fromUserId: userId(r.from),
      toUserId: userId(r.to),
      type: r.type,
      createdAt: r.at,
    });
    if (now.getTime() - r.at.getTime() > 7 * DAY) continue;
    const toTz = users.get(r.to)!.tz;
    notify({
      user: r.to,
      type: 'reactions_received',
      eventId: `react_${oid(r.contextKey).toHexString()}_${userId(r.from).toHexString()}_${r.type}`,
      variants: NOTIFICATION_COPY.reactions_received,
      vars: { friend: firstName(name(r.from)), emoji: REACTION_EMOJI[r.type], space: space.name },
      sender: friendSender(r.from),
      sentAt: r.at,
      payload: { ...spacePayload(space, r.from), reactionEmoji: REACTION_EMOJI[r.type] },
      groupKey: `reactions_${oid(r.contextKey).toHexString()}_${dayKey(r.at, toTz)}`,
    });
  }
  data.reactions.push(...milestoneReactions);

  // Together-streak nudge for the main user: strongest live pair whose friend is in a space now.
  const main = users.get(MAIN_USER)!;
  const liveCandidates = [...together.values()]
    .filter((t) => t.users.includes(MAIN_USER) && t.lastTogetherDay === addDays(main.today, -1))
    .map((t) => ({ t, friend: t.users.find((x) => x !== MAIN_USER)! }))
    .map((c) => ({ ...c, live: sessions.find((s) => s.user === c.friend && s.end === null && s.spaceKey) }))
    .filter((c) => c.live)
    .sort((a, b) => b.t.current - a.t.current);
  const best = liveCandidates[0];
  if (best?.live?.spaceKey && !openSessionAt(MAIN_USER, now)) {
    const space = spaceById.get(best.live.spaceKey)!;
    notify({
      user: MAIN_USER,
      type: 'together_streak_risk',
      eventId: `together_${main.today}`,
      variants: NOTIFICATION_COPY.together_streak_risk,
      vars: { friend: firstName(name(best.friend)), days: best.t.current, next: best.t.current + 1 },
      sender: friendSender(best.friend),
      sentAt: new Date(Math.max(best.live.start.getTime() + MINUTE, now.getTime() - 10 * MINUTE)),
      actions: [{ kind: 'join_space', label: `Join ${firstName(name(best.friend))}` }],
      payload: spacePayload(space, best.friend),
    });
  }

  // Time-of-day progress nudges, last 7 days + today, for everyone.
  for (const u of users.values()) {
    const state = states.get(u.key)!;
    const target = u.persona.dailyTargetMin;
    const threshold = creditThreshold(target);
    const mine = sessionsOf(u.key);
    const totalBy = (day: string, at: Date) =>
      mine.filter((s) => s.end && s.end <= at && dayKey(s.end, u.tz) === day).reduce((sum, s) => sum + closed.get(s.key)!.durationMin, 0);
    for (let k = 7; k >= 0; k--) {
      const day = addDays(u.today, -k);
      const riskAt = zonedTime(day, 19, 30, u.tz);
      const streakToday = state.streakAtDayStart.get(day) ?? 0;
      if (riskAt <= now && riskAt >= u.createdAt && streakToday > 0 && !openSessionAt(u.key, riskAt)) {
        const total = totalBy(day, riskAt);
        if (total < threshold) {
          const needed = roundUp5(threshold - total);
          notify({
            user: u.key,
            type: 'streak_at_risk',
            eventId: `risk_${day}`,
            variants: NOTIFICATION_COPY.streak_at_risk,
            vars: { streak: streakToday, needed },
            sender: spark,
            sentAt: riskAt,
            tone: 'nudge',
            actions: [
              { kind: 'quick_start', label: `Start ${needed} min` },
              { kind: 'snooze', label: 'Snooze 10 min' },
            ],
            payload: { durationMin: needed },
          });
          data.mascotEvents.push(mascotEvent(u.key, 'streak_at_risk', { streak: streakToday, needed }, riskAt, 'nudgeTick'));
        }
      }
      const checks = [zonedTime(day, 17, 0, u.tz), ...mine.filter((s) => s.end && dayKey(s.end, u.tz) === day && localHour(s.end, u.tz) >= 17).map((s) => s.end!)]
        .filter((t) => t <= now)
        .sort((a, b) => a.getTime() - b.getTime());
      for (const at of checks) {
        const remaining = target - totalBy(day, at);
        if (remaining > 0 && remaining <= 20 && !openSessionAt(u.key, at)) {
          notify({
            user: u.key,
            type: 'goal_close',
            eventId: `goalclose_${day}`,
            variants: NOTIFICATION_COPY.goal_close,
            vars: { remaining },
            sender: spark,
            sentAt: at,
            actions: [{ kind: 'quick_start', label: `Start ${roundUp5(remaining)} min` }],
            payload: { durationMin: roundUp5(remaining) },
          });
          break;
        }
      }
    }

    // Reward events from the replay.
    const levelUps = state.events.filter((e) => e.type === 'level_up').slice(-3);
    for (const e of state.events) {
      const age = now.getTime() - e.at.getTime();
      if (e.type === 'badge_earned' && age <= 90 * DAY) {
        const b = BADGES.find((x) => x.key === e.badgeKey)!;
        notify({
          user: u.key,
          type: 'badge_earned',
          eventId: `badge_${b.key}`,
          variants: NOTIFICATION_COPY.badge_earned,
          vars: { badge: b.name, icon: b.icon, description: b.description },
          sender: { kind: 'system', emoji: b.icon },
          sentAt: e.at,
          tone: 'reward',
          priority: 'high',
          actions: [{ kind: 'celebrate', label: 'Celebrate 🎉' }],
          payload: { badgeId: badgeId(b.key) },
        });
        if (age <= 14 * DAY) data.mascotEvents.push(mascotEvent(u.key, 'badge_earned', { badgeId: badgeId(b.key) }, e.at, 'progress'));
      } else if (e.type === 'level_up' && levelUps.includes(e) && age <= 90 * DAY) {
        notify({
          user: u.key,
          type: 'level_up',
          eventId: `level_${e.level}`,
          variants: NOTIFICATION_COPY.level_up,
          vars: { level: e.level },
          sender: spark,
          sentAt: e.at,
          tone: 'reward',
          priority: 'high',
          actions: [{ kind: 'celebrate', label: 'Celebrate ✨' }],
          payload: { level: e.level },
        });
        if (age <= 14 * DAY) data.mascotEvents.push(mascotEvent(u.key, 'level_up', { level: e.level }, e.at, 'progress'));
      } else if (e.type === 'freeze_earned' && age <= 60 * DAY) {
        notify({
          user: u.key,
          type: 'streak_freeze_earned',
          eventId: `freezeearned_${dayKey(e.at, u.tz)}`,
          variants: NOTIFICATION_COPY.streak_freeze_earned,
          vars: { streak: e.streak, count: e.count },
          sender: { kind: 'system', emoji: '❄️' },
          sentAt: e.at,
          tone: 'reward',
          priority: 'high',
        });
      } else if (e.type === 'freeze_used' && age <= 60 * DAY) {
        notify({
          user: u.key,
          type: 'streak_freeze_used',
          eventId: `freezeused_${e.freezesUsed}`,
          variants: NOTIFICATION_COPY.streak_freeze_used,
          vars: { streak: e.streak },
          sender: spark,
          sentAt: e.at,
          priority: 'high',
        });
      }
    }

    // Welcome back after a ≥3-day gap (last 30 days), on the return visit.
    const closedMine = mine.filter((s) => s.end).sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 1; i < closedMine.length; i++) {
      const gapDays = (closedMine[i].start.getTime() - closedMine[i - 1].end!.getTime()) / DAY;
      const at = addMinutes(closedMine[i].start, -3);
      if (gapDays < 3 || now.getTime() - at.getTime() > 30 * DAY) continue;
      notify({
        user: u.key,
        type: 'welcome_back',
        eventId: `welcome_${dayKey(at, u.tz)}`,
        variants: NOTIFICATION_COPY.welcome_back,
        vars: {},
        sender: spark,
        sentAt: at,
        actions: [{ kind: 'open_spaces', label: 'Browse spaces' }],
      });
      data.mascotEvents.push(mascotEvent(u.key, 'welcome_back', {}, at, 'auth'));
    }
  }

  // A playful nudge the main user snoozed yesterday morning, then got back.
  const nudgeAt = zonedTime(addDays(main.today, -1), 8, 40, main.tz);
  if (!openSessionAt(MAIN_USER, nudgeAt)) {
    const nudgeId = `nudge_${addDays(main.today, -1)}_morning`;
    const snoozedAt = addMinutes(nudgeAt, 1);
    notify({
      user: MAIN_USER,
      type: 'join_nudge',
      eventId: nudgeId,
      variants: JOIN_NUDGE_COPY.morning,
      vars: {},
      sender: spark,
      sentAt: nudgeAt,
      actions: [
        { kind: 'quick_start', label: 'Start a space' },
        { kind: 'snooze', label: 'Maybe later' },
      ],
      payload: { durationMin: 25 },
      openedAt: snoozedAt,
      actionTaken: 'snoozed',
    });
    notify({
      user: MAIN_USER,
      type: 'join_nudge',
      eventId: `${nudgeId}_snz_${addMinutes(snoozedAt, 10).getTime()}`,
      variants: JOIN_NUDGE_COPY.morning,
      vars: {},
      sender: spark,
      sentAt: addMinutes(snoozedAt, 10),
      priority: 'high',
      actions: [{ kind: 'quick_start', label: 'Start a space' }],
      payload: { durationMin: 25 },
    });
  }

  // ── Weekly recaps (last 4 complete weeks) + their notification ─────────
  for (const u of users.values()) {
    const state = states.get(u.key)!;
    const thisWeek = weekStart(u.today);
    const createdDay = dayKey(u.createdAt, u.tz);
    for (let w = 4; w >= 1; w--) {
      const ws = addDays(thisWeek, -7 * w);
      const we = addDays(ws, 6);
      if (we < createdDay) continue;
      const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((date) => ({ date, minutes: state.daily.get(date)?.total ?? 0 }));
      const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0);
      const inWeek = (s: RawSession) => s.end !== null && closed.has(s.key) && closed.get(s.key)!.dayKey >= ws && closed.get(s.key)!.dayKey <= we;
      const weekSessions = sessionsOf(u.key).filter(inWeek);
      const catMinutes = new Map<CatSlug, number>();
      for (const d of days) for (const [cat, v] of state.daily.get(d.date)?.byCat ?? []) catMinutes.set(cat, (catMinutes.get(cat) ?? 0) + v.minutes);
      const focusedWith = new Set<string>();
      for (const s of weekSessions) {
        if (!s.spaceKey) continue;
        for (const o of sessions) {
          if (o.spaceKey !== s.spaceKey || o.user === s.user || !o.end) continue;
          const from = o.start > s.start ? o.start : s.start;
          const to = o.end < s.end! ? o.end : s.end!;
          if (minutesBetween(from, to) >= TOGETHER_MIN_OVERLAP_MIN && areFriendsAt(u.key, o.user, from, now)) focusedWith.add(o.user);
        }
      }
      const cheersReceived = data.reactions.filter(
        (r) => (r.toUserId as ObjectId).equals(u.id) && dayKey(r.createdAt as Date, u.tz) >= ws && dayKey(r.createdAt as Date, u.tz) <= we
      ).length;
      const bestDay = days.reduce((b, d) => (d.minutes > b.minutes ? d : b), days[0]);
      const recapAt = zonedTime(we, 18, 0, u.tz);
      data.weeklyRecaps.push({
        _id: oid(`recap:${u.key}:${ws}`),
        userId: u.id,
        weekStart: ws,
        totalMinutes,
        days,
        bestDay,
        topCategoryId: catMinutes.size ? categoryId([...catMinutes].sort((a, b) => b[1] - a[1])[0][0]) : null,
        sessionsCompleted: weekSessions.length,
        spacesJoined: new Set(weekSessions.filter((s) => s.spaceKey).map((s) => s.spaceKey)).size,
        focusedWithFriendIds: [...focusedWith].map(userId),
        cheersReceived,
        xpEarned: weekSessions.reduce((sum, s) => sum + closed.get(s.key)!.xpEarned, 0),
        createdAt: recapAt,
      });
      if (totalMinutes > 0) {
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        notify({
          user: u.key,
          type: 'weekly_recap',
          eventId: `recap_${we}`,
          variants: NOTIFICATION_COPY.weekly_recap,
          vars: {
            hours: hours ? (mins ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`,
            bestDay: new Date(`${bestDay.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
          },
          sender: { kind: 'system', emoji: '📊' },
          sentAt: recapAt,
          actions: [{ kind: 'open_recap', label: 'See my week' }],
          payload: { weekStart: ws },
        });
      }
    }
  }

  // Mascot queue extras for the main user: a friend's achievement + a generic nudge.
  if (mainLatest) {
    data.mascotEvents.push(mascotEvent(MAIN_USER, 'friend_achievement', { fromUserId: userId(mainLatest.friend), milestone: mainLatest.streak }, mainLatest.at, 'friendships'));
  }
  data.mascotEvents.push(mascotEvent(MAIN_USER, 'generic_encouragement', {}, addMinutes(now, -30), 'mascot'));

  function mascotEvent(user: string, eventType: string, payload: Doc, at: Date, sourceService: string): Doc {
    return {
      _id: oid(`mascot:${user}:${eventType}:${at.getTime()}`),
      userId: userId(user),
      eventType,
      payload,
      priority: MASCOT_PRIORITY[eventType],
      // Older than a day → Spark already said it.
      deliveredAt: now.getTime() - at.getTime() > DAY ? addMinutes(at, 15) : null,
      sourceService,
      createdAt: at,
    };
  }

  return data;
}
