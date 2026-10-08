import type { ObjectId } from 'mongodb';
import { creditThreshold, levelFor, sessionCapMin, stageFor, xpFor } from '../lib/rules';
import { addDays, dayKey, MINUTE } from '../lib/time';
import type { Doc, SeedData } from './assemble';

// Cross-collection invariants a correct backend must never violate. Runs
// against freshly built data (seed:check) and against what was read back
// out of MongoDB (seed:verify), so it doubles as a regression net for the
// Phase 2 write paths once they exist.

// ObjectIds and the catalogs' string ids both stringify to their id.
const hex = (v: unknown) => String(v);
const time = (v: unknown) => (v as Date).getTime();

export function checkInvariants(data: SeedData, now: Date): string[] {
  const failures: string[] = [];
  const fail = (msg: string) => failures.push(msg);
  const index = (name: string) => new Map(data[name].map((d) => [hex(d._id), d]));

  for (const [name, docs] of Object.entries(data)) {
    const ids = new Set(docs.map((d) => hex(d._id)));
    if (ids.size !== docs.length) fail(`${name}: duplicate _id`);
  }

  const users = index('users');
  const categories = index('sessionCategories');
  const spaces = index('spaces');
  const badges = index('badges');
  const sessionsById = index('sessions');
  const ref = (where: string, map: Map<string, Doc>, id: unknown, nullable = false) => {
    if (id == null) {
      if (!nullable) fail(`${where}: missing reference`);
      return;
    }
    if (!map.has(hex(id))) fail(`${where}: dangling reference ${hex(id)}`);
  };

  // ── Sessions ──
  const byUser = new Map<string, Doc[]>();
  for (const s of data.sessions) {
    const where = `session ${hex(s._id)}`;
    ref(where, users, s.userId);
    ref(where, categories, s.categoryId);
    ref(where, spaces, s.spaceId, true);
    const user = users.get(hex(s.userId));
    if (user && time(s.startTime) < time(user.createdAt)) fail(`${where}: starts before account creation`);
    if (s.spaceId) {
      const space = spaces.get(hex(s.spaceId));
      if (space && hex(space.categoryId) !== hex(s.categoryId)) fail(`${where}: category differs from its space`);
      if (space && ['scheduled', 'cancelled'].includes(space.status as string)) fail(`${where}: session in a ${space.status} space`);
      if (space && s.status === 'active' && space.status !== 'active') fail(`${where}: open session in a ${space.status} space`);
    }
    if (s.status === 'completed') {
      const raw = Math.round((time(s.endTime) - time(s.startTime)) / MINUTE);
      const expected = Math.min(raw, sessionCapMin(s.targetDurationMin as number));
      if (s.durationMin !== expected) fail(`${where}: durationMin ${s.durationMin} ≠ ${expected}`);
      if (s.xpEarned !== xpFor(expected)) fail(`${where}: xp ${s.xpEarned} ≠ ${xpFor(expected)}`);
      if (s.targetHit !== expected >= (s.targetDurationMin as number)) fail(`${where}: targetHit wrong`);
      if (time(s.endTime) > now.getTime()) fail(`${where}: ends in the future`);
    } else if (s.endTime !== null) fail(`${where}: active session has endTime`);
    const list = byUser.get(hex(s.userId)) ?? [];
    list.push(s);
    byUser.set(hex(s.userId), list);
  }
  for (const [uid, list] of byUser) {
    if (list.filter((s) => s.status === 'active').length > 1) fail(`user ${uid}: more than one open session`);
    const sorted = [...list].sort((a, b) => time(a.startTime) - time(b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1].endTime ? time(sorted[i - 1].endTime) : Infinity;
      if (time(sorted[i].startTime) < prevEnd) fail(`user ${uid}: overlapping sessions ${hex(sorted[i - 1]._id)} / ${hex(sorted[i]._id)}`);
    }
  }

  // ── Spaces ──
  const friendsAt = (a: string, b: string, at: number) =>
    data.friendships.some(
      (f) =>
        f.status === 'accepted' &&
        time(f.respondedAt) <= at &&
        ((hex(f.userIdA) === a && hex(f.userIdB) === b) || (hex(f.userIdA) === b && hex(f.userIdB) === a))
    );
  for (const sp of data.spaces) {
    const where = `space ${sp.name} ${hex(sp._id)}`;
    ref(where, categories, sp.categoryId);
    ref(where, users, sp.hostId, sp.isBotSeeded as boolean);
    const inSpace = data.sessions.filter((s) => s.spaceId && hex(s.spaceId) === hex(sp._id));
    const open = inSpace.filter((s) => s.status === 'active').length;
    if (sp.liveCount !== (sp.status === 'active' ? open : 0)) fail(`${where}: liveCount ${sp.liveCount} ≠ ${open}`);
    if (sp.isBotSeeded && sp.hostId !== null) fail(`${where}: bot room with a host`);
    if (sp.status === 'completed' && !sp.endedAt) fail(`${where}: completed without endedAt`);
    if (!sp.isPublic && sp.hostId) {
      const host = hex(sp.hostId);
      const invited = new Set((sp.invitedUserIds as ObjectId[]).map(hex));
      for (const s of inSpace) {
        const u = hex(s.userId);
        if (u !== host && !invited.has(u) && !friendsAt(host, u, time(s.startTime))) fail(`${where}: non-friend, non-invitee ${u} in friends-only space`);
      }
    }
  }

  // ── Rollups recomputed from raw sessions ──
  const expectedTotals = new Map<string, { minutes: number; xp: number }>();
  const expectedStats = new Map<string, { minutes: number; xp: number; count: number }>();
  for (const s of data.sessions) {
    if (s.status !== 'completed') continue;
    const user = users.get(hex(s.userId))!;
    const day = dayKey(s.endTime as Date, user.timezone as string);
    const tKey = `${hex(s.userId)}|${day}`;
    const t = expectedTotals.get(tKey) ?? { minutes: 0, xp: 0 };
    t.minutes += s.durationMin as number;
    t.xp += s.xpEarned as number;
    expectedTotals.set(tKey, t);
    const sKey = `${hex(s.userId)}|${hex(s.categoryId)}|${day}`;
    const st = expectedStats.get(sKey) ?? { minutes: 0, xp: 0, count: 0 };
    st.minutes += s.durationMin as number;
    st.xp += s.xpEarned as number;
    st.count += 1;
    expectedStats.set(sKey, st);
  }
  if (data.userDailyTotal.length !== expectedTotals.size) fail(`userDailyTotal: ${data.userDailyTotal.length} docs ≠ ${expectedTotals.size} expected`);
  for (const d of data.userDailyTotal) {
    const e = expectedTotals.get(`${hex(d.userId)}|${d.date}`);
    if (!e || e.minutes !== d.totalMinutes || e.xp !== d.xpEarned) fail(`userDailyTotal ${hex(d.userId)} ${d.date}: mismatch`);
  }
  if (data.dailyStats.length !== expectedStats.size) fail(`dailyStats: ${data.dailyStats.length} docs ≠ ${expectedStats.size} expected`);
  for (const d of data.dailyStats) {
    const e = expectedStats.get(`${hex(d.userId)}|${hex(d.categoryId)}|${d.date}`);
    if (!e || e.minutes !== d.totalMinutes || e.xp !== d.xpEarned || e.count !== d.sessionCount) fail(`dailyStats ${hex(d.userId)} ${d.date}: mismatch`);
  }

  // ── Users: points, level, badges, streak, counters ──
  for (const u of data.users) {
    const uid = hex(u._id);
    const where = `user ${u.handle}`;
    const ledger = data.pointsLedger.filter((l) => hex(l.userId) === uid);
    const ledgerSum = ledger.reduce((sum, l) => sum + (l.amount as number), 0);
    const completed = (byUser.get(uid) ?? []).filter((s) => s.status === 'completed');
    const sessionXp = completed.reduce((sum, s) => sum + (s.xpEarned as number), 0);
    if (u.points !== ledgerSum || u.points !== sessionXp) fail(`${where}: points ${u.points}, ledger ${ledgerSum}, sessions ${sessionXp}`);
    for (const l of ledger) {
      if (l.sessionId) ref(`${where} ledger`, sessionsById, l.sessionId);
      if (l.badgeId) ref(`${where} ledger`, badges, l.badgeId);
    }
    if (u.level !== levelFor(u.points as number)) fail(`${where}: level ${u.level} ≠ ${levelFor(u.points as number)}`);
    if (u.mascotStage !== stageFor(u.level as number)) fail(`${where}: mascotStage wrong`);
    const counters = u.counters as Record<string, number>;
    if (counters.sessionsCompleted !== completed.length) fail(`${where}: sessionsCompleted ${counters.sessionsCompleted} ≠ ${completed.length}`);
    const friendCount = data.friendships.filter((f) => f.status === 'accepted' && (hex(f.userIdA) === uid || hex(f.userIdB) === uid)).length;
    if (counters.friends !== friendCount) fail(`${where}: friends counter ${counters.friends} ≠ ${friendCount}`);
    const streak = u.streak as Record<string, number | string | null>;
    if ((streak.current as number) > (streak.longest as number)) fail(`${where}: current > longest streak`);
    if ((streak.freezesAvailable as number) > 3 || (streak.freezesAvailable as number) < 0) fail(`${where}: freezesAvailable out of range`);
    if (streak.lastActiveDate && (streak.lastActiveDate as string) > dayKey(now, u.timezone as string)) fail(`${where}: lastActiveDate in the future`);
    // A live streak means yesterday or today was credited (or frozen).
    if ((streak.current as number) > 0) {
      const today = dayKey(now, u.timezone as string);
      if (![today, addDays(today, -1)].includes(streak.lastActiveDate as string)) fail(`${where}: live streak but lastActiveDate ${streak.lastActiveDate}`);
    }
    if (streak.lastActiveDate === dayKey(now, u.timezone as string)) {
      const todayTotal = data.userDailyTotal.find((d) => hex(d.userId) === uid && d.date === streak.lastActiveDate);
      if (!todayTotal || (todayTotal.totalMinutes as number) < creditThreshold(u.dailyTargetMin as number)) fail(`${where}: today credited below threshold`);
    }
    for (const bid of u.badgeIds as ObjectId[]) {
      const b = badges.get(hex(bid));
      if (!b) {
        fail(`${where}: unknown badge`);
        continue;
      }
      const v = b.criteriaValue as number;
      const ok =
        b.criteriaType === 'total_xp' ? (u.points as number) >= v
        : b.criteriaType === 'streak' ? (streak.longest as number) >= v
        : b.criteriaType === 'sessions_completed' ? counters.sessionsCompleted >= v
        : b.criteriaType === 'early_sessions' ? counters.earlySessions >= v
        : b.criteriaType === 'late_sessions' ? counters.lateSessions >= v
        : b.criteriaType === 'friend_count' ? counters.friends >= v
        : false;
      if (!ok) fail(`${where}: holds ${b.key} without meeting it`);
    }
    for (const b of data.badges) {
      if (b.criteriaType === 'total_xp' && (u.points as number) >= (b.criteriaValue as number) && !(u.badgeIds as ObjectId[]).some((x) => hex(x) === hex(b._id))) {
        fail(`${where}: crossed ${b.key} but doesn't hold it`);
      }
    }
  }

  // ── Social ──
  const pairs = new Set<string>();
  const blocked = new Set(data.blocks.flatMap((b) => [`${hex(b.blockerId)}|${hex(b.blockedId)}`, `${hex(b.blockedId)}|${hex(b.blockerId)}`]));
  for (const f of data.friendships) {
    ref('friendship', users, f.userIdA);
    ref('friendship', users, f.userIdB);
    if (hex(f.userIdA) >= hex(f.userIdB)) fail(`friendship ${hex(f._id)}: not canonical (userIdA < userIdB)`);
    const key = `${hex(f.userIdA)}|${hex(f.userIdB)}`;
    if (pairs.has(key)) fail(`friendship ${key}: duplicate pair`);
    pairs.add(key);
    if (blocked.has(key)) fail(`friendship ${key}: exists across a block`);
  }
  const reactionKeys = new Set<string>();
  for (const r of data.reactions) {
    ref('reaction', users, r.fromUserId);
    ref('reaction', users, r.toUserId);
    const contextId = r.contextType === 'space' ? hex(r.contextId) : (r.contextId as string);
    const key = `${r.contextType}|${contextId}|${hex(r.fromUserId)}|${hex(r.toUserId)}|${r.type}`;
    if (reactionKeys.has(key)) fail(`reaction ${key}: duplicate (breaks toggle index)`);
    reactionKeys.add(key);
    if (r.contextType === 'space') {
      ref('reaction', spaces, r.contextId);
      const present = (uid: string) => data.sessions.some((s) => s.spaceId && hex(s.spaceId) === contextId && hex(s.userId) === uid);
      if (!present(hex(r.fromUserId)) || !present(hex(r.toUserId))) fail(`reaction ${key}: sender/recipient never in that space`);
    }
  }
  for (const t of data.togetherStreaks) {
    const [a, b] = (t.userIds as ObjectId[]).map(hex);
    if (!friendsAt(a, b, now.getTime())) fail(`togetherStreak ${t.pairKey}: not friends`);
    if ((t.current as number) > (t.longest as number)) fail(`togetherStreak ${t.pairKey}: current > longest`);
  }

  // ── Notifications / mascot / recaps ──
  const notifKeys = new Set<string>();
  for (const n of data.notifications) {
    ref('notification', users, n.userId);
    const key = `${hex(n.userId)}|${n.eventId}`;
    if (notifKeys.has(key)) fail(`notification ${key}: duplicate eventId`);
    notifKeys.add(key);
    if (n.delivery === 'held') {
      const s = n.heldForSessionId ? sessionsById.get(hex(n.heldForSessionId)) : undefined;
      if (!s || s.status !== 'active') fail(`notification ${key}: held without an open session`);
    }
    if (time(n.sentAt) > now.getTime()) fail(`notification ${key}: sent in the future`);
    if (n.tone === 'reward' && !['badge_earned', 'level_up', 'streak_freeze_earned'].includes(n.type as string)) fail(`notification ${key}: gold reward tone on ${n.type}`);
  }
  for (const m of data.mascotEvents) ref('mascotEvent', users, m.userId);
  for (const r of data.weeklyRecaps) {
    const sum = data.userDailyTotal
      .filter((d) => hex(d.userId) === hex(r.userId) && (d.date as string) >= (r.weekStart as string) && (d.date as string) <= addDays(r.weekStart as string, 6))
      .reduce((s, d) => s + (d.totalMinutes as number), 0);
    if (sum !== r.totalMinutes) fail(`weeklyRecap ${hex(r.userId)} ${r.weekStart}: total ${r.totalMinutes} ≠ ${sum}`);
  }

  return failures;
}
