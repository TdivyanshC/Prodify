import { ObjectId } from 'mongodb';
import { col } from '../../db/mongo';
import type { UserDoc, WeeklyRecapDoc } from '../../db/schemas';
import { TOGETHER_MIN_OVERLAP_MIN } from '../../lib/rules';
import { addDays, dayKey, minutesBetween } from '../../lib/time';
import { friendIdList } from '../views';

// Reads come from the rollup layer (dailyStats / userDailyTotal), never a
// scan of raw sessions — except the weekly recap's social bits, which are
// bounded to one user's one week (DB doc §6).

const WEEKDAY = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

export async function todayTotals(user: UserDoc) {
  const today = dayKey(new Date(), user.timezone);
  const t = await col('userDailyTotal').findOne({ userId: user._id, date: today });
  return { today, minutes: t?.totalMinutes ?? 0, xp: t?.xpEarned ?? 0 };
}

export async function homeSummary(user: UserDoc) {
  const { minutes, xp } = await todayTotals(user);
  const open = await col('sessions').findOne({ userId: user._id, status: 'active' });
  const friends = await friendIdList(user._id);
  const friendSessions = await col('sessions').find({ userId: { $in: friends }, status: 'active', spaceId: { $ne: null } }).toArray();
  const spaces = await col('spaces').find({ _id: { $in: friendSessions.map((s) => s.spaceId!) } }).toArray();
  const friendSet = new Set(friends.map((f) => f.toHexString()));
  const focusingFriends = friendSessions
    .map((s) => ({ s, space: spaces.find((sp) => sp._id.equals(s.spaceId!)) }))
    // Only spaces this user could open: public, theirs, a friend's, or invited.
    .filter(({ space }) => space && (space.isPublic || space.hostId?.equals(user._id) || (space.hostId && friendSet.has(space.hostId.toHexString())) || space.invitedUserIds.some((id) => id.equals(user._id))))
    .map(({ s, space }) => ({ userId: s.userId.toHexString(), spaceId: space!._id.toHexString(), spaceName: space!.name, joinedAt: s.startTime.toISOString() }));
  return {
    todayMinutes: minutes,
    dailyTargetMin: user.dailyTargetMin,
    xpToday: xp,
    sessionsCompletedTotal: user.counters.sessionsCompleted,
    openSession: open ? { _id: open._id.toHexString(), spaceId: open.spaceId?.toHexString() ?? null, startTime: open.startTime.toISOString(), targetDurationMin: open.targetDurationMin } : null,
    focusingFriends,
  };
}

export async function activity(user: UserDoc, from: string, to: string) {
  const rows = await col('userDailyTotal').find({ userId: user._id, date: { $gte: from, $lte: to } }).sort({ date: 1 }).toArray();
  return rows.map((r) => ({ date: r.date, totalMinutes: r.totalMinutes }));
}

export async function stats(user: UserDoc, range: 'week' | 'month', categoryId?: string) {
  const today = dayKey(new Date(), user.timezone);
  const span = range === 'week' ? 7 : 30;
  const from = addDays(today, -(span - 1));
  const source = categoryId
    ? await col('dailyStats').find({ userId: user._id, categoryId, date: { $gte: from, $lte: today } }).toArray()
    : await col('userDailyTotal').find({ userId: user._id, date: { $gte: from, $lte: today } }).toArray();
  const byDate = new Map(source.map((r) => [r.date, r.totalMinutes]));
  const days = Array.from({ length: span }, (_, i) => addDays(from, i)).map((date) => ({ date, day: WEEKDAY(date), minutes: byDate.get(date) ?? 0 }));
  const cats = await col('dailyStats')
    .aggregate<{ _id: string; minutes: number }>([
      { $match: { userId: user._id, date: { $gte: from, $lte: today } } },
      { $group: { _id: '$categoryId', minutes: { $sum: '$totalMinutes' } } },
      { $sort: { minutes: -1 } },
    ])
    .toArray();
  return {
    range,
    days,
    totalMinutes: days.reduce((sum, d) => sum + d.minutes, 0),
    byCategory: cats.map((c) => ({ categoryId: c._id, minutes: c.minutes })),
  };
}

// Builds one week's recap (Mon–Sun, user-local) — used by the weeklyRecap
// job and as an on-demand fallback when a week has no stored doc yet.
export async function buildRecap(user: UserDoc, weekStart: string): Promise<WeeklyRecapDoc> {
  const weekEnd = addDays(weekStart, 6);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const totals = await col('userDailyTotal').find({ userId: user._id, date: { $gte: weekStart, $lte: weekEnd } }).toArray();
  const byDate = new Map(totals.map((t) => [t.date, t]));
  const days = dates.map((date) => ({ date, minutes: byDate.get(date)?.totalMinutes ?? 0 }));
  const cats = await col('dailyStats')
    .aggregate<{ _id: string; minutes: number }>([
      { $match: { userId: user._id, date: { $gte: weekStart, $lte: weekEnd } } },
      { $group: { _id: '$categoryId', minutes: { $sum: '$totalMinutes' } } },
      { $sort: { minutes: -1 } },
      { $limit: 1 },
    ])
    .toArray();
  // Sessions are bucketed by the local day they END on (backend doc §5.4).
  const sessions = (
    await col('sessions')
      .find({ userId: user._id, status: 'completed', endTime: { $gte: new Date(Date.parse(`${weekStart}T00:00:00Z`) - 86_400_000), $lte: new Date(Date.parse(`${weekEnd}T23:59:59Z`) + 86_400_000) } })
      .toArray()
  ).filter((s) => {
    const d = dayKey(s.endTime!, user.timezone);
    return d >= weekStart && d <= weekEnd;
  });
  const friends = new Set((await friendIdList(user._id)).map((f) => f.toHexString()));
  const spaceIds = [...new Set(sessions.filter((s) => s.spaceId).map((s) => s.spaceId!.toHexString()))].map((id) => new ObjectId(id));
  const others = spaceIds.length ? await col('sessions').find({ spaceId: { $in: spaceIds }, userId: { $ne: user._id }, status: 'completed' }).toArray() : [];
  const focusedWith = new Set<string>();
  for (const s of sessions.filter((x) => x.spaceId)) {
    for (const o of others) {
      if (!o.spaceId!.equals(s.spaceId!) || !friends.has(o.userId.toHexString())) continue;
      const from = o.startTime > s.startTime ? o.startTime : s.startTime;
      const to = o.endTime! < s.endTime! ? o.endTime! : s.endTime!;
      if (minutesBetween(from, to) >= TOGETHER_MIN_OVERLAP_MIN) focusedWith.add(o.userId.toHexString());
    }
  }
  const cheers = await col('reactions').find({ toUserId: user._id, createdAt: { $gte: new Date(Date.parse(`${weekStart}T00:00:00Z`) - 86_400_000), $lte: new Date(Date.parse(`${weekEnd}T23:59:59Z`) + 86_400_000) } }).toArray();
  const bestDay = days.reduce((b, d) => (d.minutes > b.minutes ? d : b), days[0]);
  return {
    _id: new ObjectId(),
    userId: user._id,
    weekStart,
    totalMinutes: days.reduce((sum, d) => sum + d.minutes, 0),
    days,
    bestDay,
    topCategoryId: cats[0]?._id ?? null,
    sessionsCompleted: sessions.length,
    spacesJoined: spaceIds.length,
    focusedWithFriendIds: [...focusedWith].map((id) => new ObjectId(id)),
    cheersReceived: cheers.filter((c) => {
      const d = dayKey(c.createdAt, user.timezone);
      return d >= weekStart && d <= weekEnd;
    }).length,
    xpEarned: totals.reduce((sum, t) => sum + t.xpEarned, 0),
    createdAt: new Date(),
  };
}

export function recapDTO(r: WeeklyRecapDoc) {
  const days = r.days.map((d) => ({ ...d, day: WEEKDAY(d.date) }));
  return {
    weekStart: r.weekStart,
    totalMinutes: r.totalMinutes,
    days,
    bestDay: { ...r.bestDay, day: WEEKDAY(r.bestDay.date) },
    topCategoryId: r.topCategoryId,
    sessionsCompleted: r.sessionsCompleted,
    spacesJoined: r.spacesJoined,
    focusedWithFriendIds: r.focusedWithFriendIds.map((id) => id.toHexString()),
    cheersReceived: r.cheersReceived,
    xpEarned: r.xpEarned,
  };
}
