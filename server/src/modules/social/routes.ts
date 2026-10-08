import { Router } from 'express';
import { MongoServerError, ObjectId } from 'mongodb';
import { z } from 'zod';
import { col } from '../../db/mongo';
import type { FriendshipDoc, ReactionDoc, UserDoc } from '../../db/schemas';
import { emit } from '../../events/bus';
import { badRequest, conflict, forbidden, notFound, parseId } from '../../lib/errors';
import { crossedBadges } from '../../lib/progress';
import { me } from '../../middleware/auth';
import { rateLimit, validate } from '../../middleware/common';
import { blockedIdSet, canonicalPair, friendIdList, friendIdSet, getBadges, isBlockedEitherWay, toProfileDTO, toTogetherDTO, usersById } from '../views';

// Friendships (DB doc §3 state machine), blocks, suggestions, search,
// profiles, reactions, reports.
export const socialRoutes = Router();

const objectIdStr = z.string().regex(/^[a-f0-9]{24}$/);

const friendshipDTO = (f: FriendshipDoc) => ({
  _id: f._id.toHexString(),
  userIdA: f.userIdA.toHexString(),
  userIdB: f.userIdB.toHexString(),
  status: f.status,
  requestedBy: f.requestedBy.toHexString(),
  createdAt: f.createdAt.toISOString(),
  respondedAt: f.respondedAt?.toISOString() ?? null,
});
const otherOf = (f: FriendshipDoc, id: ObjectId) => (f.userIdA.equals(id) ? f.userIdB : f.userIdA);

// ── Friendships ─────────────────────────────────────────────────────────
socialRoutes.get('/friendships', async (req, res) => {
  const user = me(req);
  const rows = await col('friendships').find({ $or: [{ userIdA: user._id }, { userIdB: user._id }] }).toArray();
  const people = await usersById(rows.map((f) => otherOf(f, user._id)));
  const together = await col('togetherStreaks').find({ userIds: user._id }).toArray();
  const profiles = await Promise.all(
    rows.map((f) => {
      const other = people.get(otherOf(f, user._id).toHexString());
      return other ? toProfileDTO(other, f.status === 'accepted') : null;
    })
  );
  res.json({
    friendships: rows.map(friendshipDTO),
    profiles: profiles.filter(Boolean),
    togetherStreaks: Object.fromEntries(
      together.map((t) => [t.userIds.find((id) => !id.equals(user._id))!.toHexString(), toTogetherDTO(t, user.timezone)])
    ),
  });
});

socialRoutes.post('/friendships', rateLimit('friend_request', 20, 24 * 3600_000), validate(z.object({ toUserId: objectIdStr })), async (req, res) => {
  const user = me(req);
  const toUserId = new ObjectId(req.body.toUserId as string);
  if (toUserId.equals(user._id)) throw badRequest('SELF', 'That’s you');
  const target = await col('users').findOne({ _id: toUserId, status: 'active' });
  if (!target || (await isBlockedEitherWay(user._id, toUserId))) throw notFound('User');
  const [userIdA, userIdB] = canonicalPair(user._id, toUserId);
  const doc: FriendshipDoc = { _id: new ObjectId(), userIdA, userIdB, status: 'pending', requestedBy: user._id, createdAt: new Date(), respondedAt: null };
  try {
    await col('friendships').insertOne(doc);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) throw conflict('ALREADY_CONNECTED', 'You’re already friends or a request is pending');
    throw err;
  }
  emit('friendship.requested', { friendship: doc });
  res.status(201).json({ friendship: friendshipDTO(doc), profile: await toProfileDTO(target, false) });
});

async function loadOwnFriendship(user: UserDoc, id: string) {
  const f = await col('friendships').findOne({ _id: parseId(id, 'friendship id'), $or: [{ userIdA: user._id }, { userIdB: user._id }] });
  if (!f) throw notFound('Friendship');
  return f;
}

socialRoutes.post('/friendships/:id/accept', async (req, res) => {
  const user = me(req);
  const f = await loadOwnFriendship(user, String(req.params.id));
  res.json({ friendship: friendshipDTO(await acceptFriendship(user, f)) });
});

export async function acceptFriendship(user: UserDoc, f: FriendshipDoc): Promise<FriendshipDoc> {
  if (f.status !== 'pending' || f.requestedBy.equals(user._id)) throw conflict('NOT_ACCEPTABLE', 'Only the person who got the request can accept it');
  const accepted = await col('friendships').findOneAndUpdate(
    { _id: f._id, status: 'pending' },
    { $set: { status: 'accepted', respondedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!accepted) throw conflict('NOT_ACCEPTABLE', 'That request is no longer pending');
  await bumpFriendCount([accepted.userIdA, accepted.userIdB], +1);
  await col('notifications').updateMany({ userId: user._id, type: 'friend_request', 'payload.friendshipId': f._id }, { $set: { actionTaken: 'accepted', openedAt: new Date() } });
  emit('friendship.accepted', { friendship: accepted });
  return accepted;
}

socialRoutes.post('/friendships/:id/decline', async (req, res) => {
  const user = me(req);
  const f = await loadOwnFriendship(user, String(req.params.id));
  if (f.status !== 'pending' || f.requestedBy.equals(user._id)) throw conflict('NOT_DECLINABLE', 'Only the person who got the request can decline it');
  await col('friendships').deleteOne({ _id: f._id }); // no tombstone (DB doc §3)
  await col('notifications').updateMany({ userId: user._id, type: 'friend_request', 'payload.friendshipId': f._id }, { $set: { actionTaken: 'declined', openedAt: new Date() } });
  res.json({ ok: true });
});

// Unfriend (either side) or cancel an outgoing request.
socialRoutes.delete('/friendships/:id', async (req, res) => {
  const user = me(req);
  const f = await loadOwnFriendship(user, String(req.params.id));
  await removeFriendship(f, user._id);
  res.json({ ok: true });
});

async function removeFriendship(f: FriendshipDoc, by: ObjectId) {
  await col('friendships').deleteOne({ _id: f._id });
  if (f.status === 'accepted') {
    await bumpFriendCount([f.userIdA, f.userIdB], -1);
    await col('users').updateOne({ _id: f.userIdA }, { $pull: { 'notificationPrefs.friendAlertIds': f.userIdB } });
    await col('users').updateOne({ _id: f.userIdB }, { $pull: { 'notificationPrefs.friendAlertIds': f.userIdA } });
  }
  emit('friendship.removed', { friendship: f, by });
}

async function bumpFriendCount(ids: ObjectId[], delta: number) {
  const catalog = await getBadges();
  for (const id of ids) {
    const u = await col('users').findOneAndUpdate({ _id: id }, { $inc: { 'counters.friends': delta } }, { returnDocument: 'after' });
    if (!u || delta < 0) continue;
    const earned = crossedBadges(catalog, 'friend_count', u.counters.friends - 1, u.counters.friends, u.badgeIds);
    if (earned.length) {
      await col('users').updateOne({ _id: id }, { $addToSet: { badgeIds: { $each: earned } } });
      for (const badgeId of earned) {
        await col('pointsLedger').insertOne({ _id: new ObjectId(), userId: id, source: 'badge', amount: 0, sessionId: null, badgeId, timestamp: new Date() });
      }
      emit('user.updated', { userId: id });
    }
  }
}

// ── Suggestions & search ────────────────────────────────────────────────
socialRoutes.get('/friends/suggestions', async (req, res) => {
  const user = me(req);
  const [friends, blocked, connected] = await Promise.all([
    friendIdList(user._id),
    blockedIdSet(user._id),
    col('friendships').find({ $or: [{ userIdA: user._id }, { userIdB: user._id }] }).toArray(),
  ]);
  const exclude = new Set([user._id.toHexString(), ...blocked, ...connected.map((f) => otherOf(f, user._id).toHexString())]);
  // Friends-of-friends, ranked by mutual count.
  const fof = await col('friendships')
    .find({ status: 'accepted', $or: [{ userIdA: { $in: friends } }, { userIdB: { $in: friends } }] })
    .toArray();
  const mutuals = new Map<string, number>();
  const friendSet = new Set(friends.map((f) => f.toHexString()));
  for (const f of fof) {
    for (const [a, b] of [
      [f.userIdA, f.userIdB],
      [f.userIdB, f.userIdA],
    ]) {
      if (friendSet.has(a.toHexString()) && !exclude.has(b.toHexString())) mutuals.set(b.toHexString(), (mutuals.get(b.toHexString()) ?? 0) + 1);
    }
  }
  const ranked = [...mutuals].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const people = await usersById(ranked.map(([id]) => new ObjectId(id)));
  const items = [];
  for (const [id, count] of ranked) {
    const u = people.get(id);
    if (u && u.status === 'active') items.push({ ...(await toProfileDTO(u, false)), mutualCount: count });
  }
  res.json({ items });
});

socialRoutes.get('/users/search', rateLimit('search', 30, 60_000), validate(z.object({ handle: z.string().trim().min(2).max(20) }), 'query'), async (req, res) => {
  const user = me(req);
  const prefix = String((req.query as { handle: string }).handle).toLowerCase().replace(/[^a-z0-9._]/g, '');
  const blocked = await blockedIdSet(user._id);
  const docs = await col('users')
    .find({ handle: { $regex: `^${prefix.replace(/\./g, '\\.')}` }, status: 'active', _id: { $ne: user._id } })
    .limit(10)
    .toArray();
  const friends = await friendIdSet(user._id);
  res.json({ items: await Promise.all(docs.filter((d) => !blocked.has(d._id.toHexString())).map((d) => toProfileDTO(d, friends.has(d._id.toHexString())))) });
});

socialRoutes.get('/users/:id/profile', async (req, res) => {
  const user = me(req);
  const id = parseId(req.params.id, 'user id');
  const target = await col('users').findOne({ _id: id, status: 'active' });
  if (!target || (await isBlockedEitherWay(user._id, id))) throw notFound('User');
  const [userIdA, userIdB] = canonicalPair(user._id, id);
  const f = id.equals(user._id) ? null : await col('friendships').findOne({ userIdA, userIdB });
  const isFriend = f?.status === 'accepted';
  const pair = isFriend ? await col('togetherStreaks').findOne({ pairKey: `${userIdA.toHexString()}_${userIdB.toHexString()}` }) : null;
  const status = id.equals(user._id) ? 'self' : !f ? 'none' : isFriend ? 'friends' : f.requestedBy.equals(user._id) ? 'pending_out' : 'pending_in';
  res.json({
    profile: await toProfileDTO(target, isFriend),
    stats: { points: target.points, level: target.level, sessionsCompleted: target.counters.sessionsCompleted, badgeIds: target.badgeIds, friends: target.counters.friends },
    // §4: social handles only to friends, and only if the owner opted in.
    socialHandles: isFriend
      ? Object.fromEntries(Object.entries(target.socialHandles).filter(([, h]) => h.isVisible && h.value).map(([k, h]) => [k, h.value]))
      : {},
    relationship: {
      status,
      friendshipId: f?._id.toHexString() ?? null,
      since: f?.respondedAt?.toISOString() ?? null,
      togetherStreak: isFriend ? toTogetherDTO(pair, user.timezone) : null,
      alertOn: user.notificationPrefs.friendAlertIds.some((x) => x.equals(id)),
    },
  });
});

// ── Blocks ──────────────────────────────────────────────────────────────
socialRoutes.get('/blocks', async (req, res) => {
  const rows = await col('blocks').find({ blockerId: me(req)._id }).toArray();
  const people = await usersById(rows.map((b) => b.blockedId));
  res.json({ items: rows.map((b) => ({ userId: b.blockedId.toHexString(), displayName: people.get(b.blockedId.toHexString())?.displayName ?? '', createdAt: b.createdAt })) });
});

socialRoutes.post('/blocks', validate(z.object({ userId: objectIdStr })), async (req, res) => {
  const user = me(req);
  const blockedId = new ObjectId(req.body.userId as string);
  if (blockedId.equals(user._id)) throw badRequest('SELF', 'You can’t block yourself');
  await col('blocks').updateOne({ blockerId: user._id, blockedId }, { $setOnInsert: { _id: new ObjectId(), createdAt: new Date() } }, { upsert: true });
  // Blocking deletes any friendship or pending request, either direction (DB doc §3).
  const [userIdA, userIdB] = canonicalPair(user._id, blockedId);
  const f = await col('friendships').findOne({ userIdA, userIdB });
  if (f) await removeFriendship(f, user._id);
  res.status(201).json({ ok: true });
});

socialRoutes.delete('/blocks/:userId', async (req, res) => {
  await col('blocks').deleteOne({ blockerId: me(req)._id, blockedId: parseId(req.params.userId, 'user id') });
  res.json({ ok: true });
});

// ── Reactions (toggle semantics, DB doc §2) ─────────────────────────────
const reactionSchema = z.object({
  contextType: z.enum(['space', 'milestone']),
  contextId: z.string().min(1).max(120),
  toUserId: objectIdStr,
  type: z.enum(['clap', 'fire', 'fist_bump']),
  on: z.boolean(),
});

socialRoutes.put('/reactions', rateLimit('reactions', 60, 60_000), validate(reactionSchema), async (req, res) => {
  const user = me(req);
  const body = req.body as z.infer<typeof reactionSchema>;
  const toUserId = new ObjectId(body.toUserId);
  if (toUserId.equals(user._id)) throw badRequest('SELF', 'Cheer someone else');
  if (await isBlockedEitherWay(user._id, toUserId)) throw notFound('User');
  let contextId: ObjectId | string;
  if (body.contextType === 'space') {
    contextId = parseId(body.contextId, 'space id');
    const recipientThere = await col('sessions').countDocuments({ spaceId: contextId, userId: toUserId });
    if (!recipientThere) throw badRequest('NOT_IN_SPACE', 'They aren’t in that space');
  } else {
    if (!body.contextId.startsWith(`milestone_${body.toUserId}_`)) throw badRequest('BAD_CONTEXT', 'That milestone isn’t theirs');
    if (!(await friendIdSet(user._id)).has(body.toUserId)) throw forbidden('NOT_FRIENDS', 'Only friends can cheer milestones');
    contextId = body.contextId;
  }
  const key = { contextType: body.contextType, contextId, fromUserId: user._id, toUserId, type: body.type };
  if (body.on) {
    const doc: ReactionDoc = { _id: new ObjectId(), ...key, createdAt: new Date() };
    try {
      await col('reactions').insertOne(doc);
      emit('reaction.toggled', { reaction: doc, on: true });
    } catch (err) {
      if (!(err instanceof MongoServerError && err.code === 11000)) throw err; // already on — idempotent
    }
  } else {
    const removed = await col('reactions').findOneAndDelete(key);
    if (removed) emit('reaction.toggled', { reaction: removed, on: false });
  }
  res.json({ ok: true, on: body.on });
});

socialRoutes.get('/reactions/mine', async (req, res) => {
  const since = new Date(Date.now() - 3 * 24 * 3600_000);
  const rows = await col('reactions').find({ fromUserId: me(req)._id, createdAt: { $gte: since } }).toArray();
  res.json({ items: rows.map((r) => ({ ...r, _id: r._id.toHexString(), contextId: String(r.contextId), fromUserId: r.fromUserId.toHexString(), toUserId: r.toUserId.toHexString() })) });
});

socialRoutes.get(
  '/reactions',
  validate(z.object({ contextType: z.enum(['space', 'milestone']), contextId: z.string() }), 'query'),
  async (req, res) => {
    const { contextType, contextId } = req.query as { contextType: string; contextId: string };
    const rows = await col('reactions')
      .find({ contextType: contextType as 'space', contextId: contextType === 'space' ? parseId(contextId) : contextId })
      .toArray();
    const counts = { clap: 0, fire: 0, fist_bump: 0 };
    for (const r of rows) counts[r.type] += 1;
    res.json({ counts, total: rows.length });
  }
);

// ── Reports ─────────────────────────────────────────────────────────────
socialRoutes.post(
  '/reports',
  rateLimit('reports', 10, 24 * 3600_000),
  validate(z.object({ reportedUserId: objectIdStr, spaceId: objectIdStr.optional(), reason: z.string().trim().min(3).max(500) })),
  async (req, res) => {
    const user = me(req);
    await col('reports').insertOne({
      _id: new ObjectId(),
      reporterId: user._id,
      reportedUserId: new ObjectId(req.body.reportedUserId as string),
      sessionId: null,
      spaceId: req.body.spaceId ? new ObjectId(req.body.spaceId as string) : null,
      reason: req.body.reason,
      createdAt: new Date(),
      status: 'open',
    });
    res.status(201).json({ ok: true });
  }
);
