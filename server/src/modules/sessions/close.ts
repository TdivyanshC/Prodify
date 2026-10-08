import { ObjectId, type ClientSession } from 'mongodb';
import { col, withTransaction } from '../../db/mongo';
import type { NotificationDoc, SessionDoc, SpaceDoc, UserDoc } from '../../db/schemas';
import { advanceTogether, creditDay, crossedBadges, type StreakEvent } from '../../lib/progress';
import {
  creditThreshold,
  EARLY_BEFORE_HOUR,
  LATE_FROM_HOUR,
  levelFor,
  sessionCapMin,
  stageFor,
  TOGETHER_MIN_OVERLAP_MIN,
  xpFor,
} from '../../lib/rules';
import { addMinutes, dayKey, localHour, minutesBetween } from '../../lib/time';
import { canonicalPair, getBadges } from '../views';

// The one transaction every session close goes through (backend doc §7.3):
// leave, solo complete, the sweep, space end. Server timestamps only — the
// client never sends durations or targetHit (§3 C6).

export interface SessionCloseResult {
  session: {
    _id: string;
    spaceId: string | null;
    categoryId: string;
    durationMin: number;
    targetDurationMin: number;
    targetHit: boolean;
    xpEarned: number;
    closedReason: string;
  };
  day: { dayKey: string; totalMinutes: number; dailyTargetMin: number; credited: boolean; creditedNow: boolean };
  streak: { before: number; after: number; freezesAvailable: number; freezeEarned: boolean };
  xp: { before: number; after: number; levelBefore: number; levelAfter: number };
  badgesEarned: { _id: string; name: string; icon: string; description: string }[];
  togetherStreaks: { userId: string; displayName: string; days: number; grew: boolean }[];
  heldNotifications: unknown[];
}

export interface SessionCloseOutcome {
  user: UserDoc;
  session: SessionDoc;
  space: SpaceDoc | null;
  result: SessionCloseResult;
  streakEvents: StreakEvent[];
  levelUp: number | null;
  spaceNowEmpty: boolean;
}

type CloseReason = 'left' | 'timeout' | 'space_ended';

export async function closeSession(sessionId: ObjectId, reason: CloseReason, at?: Date): Promise<SessionCloseOutcome | null> {
  const catalog = (await getBadges()).map((b) => ({ _id: b._id, criteriaType: b.criteriaType, criteriaValue: b.criteriaValue }));
  const outcome = await withTransaction((txn) => closeInTxn(txn, sessionId, reason, at, catalog));
  if (!outcome) return null;

  // Focus mode is over: everything held during it goes to the inbox and
  // back to the client as "While you focused" (§8.2).
  const held = await col('notifications')
    .find({ userId: outcome.user._id, heldForSessionId: sessionId, delivery: 'held' })
    .sort({ sentAt: 1 })
    .toArray();
  if (held.length) {
    await col('notifications').updateMany({ _id: { $in: held.map((n) => n._id) } }, { $set: { delivery: 'inbox' } });
  }
  outcome.result.heldNotifications = held.map((n: NotificationDoc) => JSON.parse(JSON.stringify({ ...n, delivery: 'inbox' })));
  return outcome;
}

async function closeInTxn(
  txn: ClientSession,
  sessionId: ObjectId,
  reason: CloseReason,
  at: Date | undefined,
  catalog: { _id: string; criteriaType: string; criteriaValue: number }[]
): Promise<SessionCloseOutcome | null> {
  // The status guard makes a double close (retry, sweep race) a no-op.
  const s = await col('sessions').findOneAndUpdate({ _id: sessionId, status: 'active' }, { $set: { status: 'closing' } }, { session: txn, returnDocument: 'after' });
  if (!s) return null;
  const user = (await col('users').findOne({ _id: s.userId }, { session: txn }))!;

  const cap = sessionCapMin(s.targetDurationMin);
  const end = reason === 'timeout' ? addMinutes(s.startTime, cap) : (at ?? new Date());
  const durationMin = Math.max(0, Math.min(Math.round(minutesBetween(s.startTime, end)), cap));
  const xpEarned = xpFor(durationMin);
  const targetHit = durationMin >= s.targetDurationMin;
  const closedReason = reason === 'left' && targetHit ? 'completed' : reason;
  const day = dayKey(end, user.timezone);

  const session: SessionDoc = { ...s, status: 'completed', endTime: end, durationMin, xpEarned, targetHit, completed: true, closedReason };
  await col('sessions').updateOne(
    { _id: s._id },
    { $set: { status: 'completed', endTime: end, durationMin, xpEarned, targetHit, completed: true, closedReason } },
    { session: txn }
  );
  await col('pointsLedger').insertOne(
    { _id: new ObjectId(), userId: user._id, source: 'session_complete', amount: xpEarned, sessionId: s._id, badgeId: null, timestamp: end },
    { session: txn }
  );
  await col('dailyStats').updateOne(
    { userId: user._id, categoryId: s.categoryId, date: day },
    { $inc: { totalMinutes: durationMin, sessionCount: 1, xpEarned }, $setOnInsert: { _id: new ObjectId() } },
    { upsert: true, session: txn }
  );
  const total = (await col('userDailyTotal').findOneAndUpdate(
    { userId: user._id, date: day },
    { $inc: { totalMinutes: durationMin, xpEarned }, $setOnInsert: { _id: new ObjectId() } },
    { upsert: true, returnDocument: 'after', session: txn }
  ))!;

  // Counters + streak (daily-total basis, CLAUDE.md §4) + badges + level.
  const counters = { ...user.counters, sessionsCompleted: user.counters.sessionsCompleted + 1 };
  const startHour = localHour(s.startTime, user.timezone);
  if (startHour < EARLY_BEFORE_HOUR) counters.earlySessions += 1;
  if (startHour >= LATE_FROM_HOUR) counters.lateSessions += 1;

  let streak = user.streak;
  let streakEvents: StreakEvent[] = [];
  let creditedNow = false;
  if (total.totalMinutes >= creditThreshold(user.dailyTargetMin)) {
    const credit = creditDay(user.streak, day);
    streak = credit.next;
    streakEvents = credit.events;
    creditedNow = credit.credited;
  }
  const points = user.points + xpEarned;
  const held = [...user.badgeIds];
  const newBadges = [
    ...crossedBadges(catalog, 'sessions_completed', user.counters.sessionsCompleted, counters.sessionsCompleted, held),
    ...crossedBadges(catalog, 'early_sessions', user.counters.earlySessions, counters.earlySessions, held),
    ...crossedBadges(catalog, 'late_sessions', user.counters.lateSessions, counters.lateSessions, held),
    ...crossedBadges(catalog, 'streak', user.streak.current, streak.current, held),
    ...crossedBadges(catalog, 'total_xp', user.points, points, held),
  ];
  for (const badgeId of newBadges) {
    await col('pointsLedger').insertOne(
      { _id: new ObjectId(), userId: user._id, source: 'badge', amount: 0, sessionId: s._id, badgeId, timestamp: end },
      { session: txn }
    );
  }
  const level = levelFor(points);
  const updatedUser: UserDoc = {
    ...user,
    streak,
    points,
    level,
    mascotStage: stageFor(level),
    badgeIds: [...held, ...newBadges],
    counters,
    lastActiveAt: new Date(),
  };
  await col('users').updateOne(
    { _id: user._id },
    {
      $set: {
        streak,
        points,
        level,
        mascotStage: updatedUser.mascotStage,
        counters,
        lastActiveAt: updatedUser.lastActiveAt,
      },
      $addToSet: { badgeIds: { $each: newBadges } },
    },
    { session: txn }
  );

  // Together streaks (§7.4): same space, ≥10 min overlap, accepted friends,
  // closer's day credited. Friends present are reported even if today's
  // shared day was already counted.
  const together: SessionCloseResult['togetherStreaks'] = [];
  let space: SpaceDoc | null = null;
  let spaceNowEmpty = false;
  if (s.spaceId) {
    const overlapping = await col('sessions')
      .find({ spaceId: s.spaceId, userId: { $ne: user._id }, startTime: { $lt: end }, $or: [{ endTime: null }, { endTime: { $gt: s.startTime } }] }, { session: txn })
      .toArray();
    const dayCredited = streak.lastActiveDate === day && streak.lastFreezeDate !== day;
    const seen = new Set<string>();
    for (const other of overlapping) {
      const otherId = other.userId.toHexString();
      if (seen.has(otherId)) continue;
      const from = other.startTime > s.startTime ? other.startTime : s.startTime;
      const to = other.endTime && other.endTime < end ? other.endTime : end;
      if (minutesBetween(from, to) < TOGETHER_MIN_OVERLAP_MIN) continue;
      const [userIdA, userIdB] = canonicalPair(user._id, other.userId);
      const friendship = await col('friendships').findOne({ userIdA, userIdB, status: 'accepted' }, { session: txn });
      if (!friendship || (friendship.respondedAt && friendship.respondedAt > end)) continue;
      seen.add(otherId);
      const pairKey = `${userIdA.toHexString()}_${userIdB.toHexString()}`;
      const existing = await col('togetherStreaks').findOne({ pairKey }, { session: txn });
      const advanced = dayCredited ? advanceTogether(existing, day) : null;
      if (advanced) {
        await col('togetherStreaks').updateOne(
          { pairKey },
          { $set: advanced, $setOnInsert: { _id: new ObjectId(), userIds: [userIdA, userIdB] } },
          { upsert: true, session: txn }
        );
      }
      const friend = await col('users').findOne({ _id: other.userId }, { session: txn, projection: { displayName: 1 } });
      together.push({
        userId: otherId,
        displayName: friend?.displayName.split(' ')[0] ?? 'A friend',
        days: advanced?.current ?? existing?.current ?? 0,
        grew: Boolean(advanced),
      });
    }
    space = await col('spaces').findOneAndUpdate(
      { _id: s.spaceId, liveCount: { $gt: 0 } },
      { $inc: { liveCount: -1 } },
      { session: txn, returnDocument: 'after' }
    );
    space ??= await col('spaces').findOne({ _id: s.spaceId }, { session: txn });
    spaceNowEmpty = Boolean(space && space.status === 'active' && space.liveCount === 0);
  }

  const badgeDocs = newBadges.length ? await col('badges').find({ _id: { $in: newBadges } }, { session: txn }).toArray() : [];
  const result: SessionCloseResult = {
    session: {
      _id: s._id.toHexString(),
      spaceId: s.spaceId?.toHexString() ?? null,
      categoryId: s.categoryId,
      durationMin,
      targetDurationMin: s.targetDurationMin,
      targetHit,
      xpEarned,
      closedReason,
    },
    day: {
      dayKey: day,
      totalMinutes: total.totalMinutes,
      dailyTargetMin: user.dailyTargetMin,
      credited: streak.lastActiveDate === day,
      creditedNow,
    },
    streak: {
      before: user.streak.current,
      after: streak.current,
      freezesAvailable: streak.freezesAvailable,
      freezeEarned: streakEvents.some((e) => e.type === 'freeze_earned'),
    },
    xp: { before: user.points, after: points, levelBefore: user.level, levelAfter: level },
    badgesEarned: badgeDocs.map((b) => ({ _id: b._id, name: b.name, icon: b.icon, description: b.description })),
    togetherStreaks: together,
    heldNotifications: [],
  };
  return {
    user: updatedUser,
    session,
    space,
    result,
    streakEvents,
    levelUp: level > user.level ? level : null,
    spaceNowEmpty,
  };
}
