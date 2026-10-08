import { ObjectId, type UpdateFilter } from 'mongodb';
import { col, withTransaction } from '../../db/mongo';
import type { SessionDoc, SpaceDoc, UserDoc } from '../../db/schemas';
import { emit } from '../../events/bus';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { DAY, HOUR, MINUTE } from '../../lib/time';
import { cancelJob, scheduleJob } from '../../jobs/scheduler';
import { closeSession, type SessionCloseResult } from '../sessions/close';
import { blockedIdSet, friendIdList, getCategories, toSpaceDTO, toTogetherDTO, usersById, type SpaceDTO } from '../views';

// Spaces (backend doc §6): occurrence lifecycle scheduled → active →
// completed | cancelled, visibility/access rules, invites, capacity.

export const EXPIRE_AFTER_MIN = 30;
export const REMINDER_LEAD_MIN = 5;
export const EMPTY_GRACE_MIN = 5;

interface ViewerCtx {
  me: UserDoc;
  friendIds: Set<string>;
  blocked: Set<string>;
}

async function viewerCtx(me: UserDoc): Promise<ViewerCtx> {
  const [friends, blocked] = await Promise.all([friendIdList(me._id), blockedIdSet(me._id)]);
  return { me, friendIds: new Set(friends.map((f) => f.toHexString())), blocked };
}

// §6.2 — who can see / join a space.
function canView(space: SpaceDoc, v: ViewerCtx): boolean {
  if (space.isBotSeeded) return true;
  const host = space.hostId?.toHexString();
  if (!host || v.blocked.has(host)) return false;
  if (space.hostId!.equals(v.me._id)) return true;
  if (space.isPublic) return true;
  return v.friendIds.has(host) || space.invitedUserIds.some((id) => id.equals(v.me._id));
}

// Friends-only: host only. Public: anyone currently in it.
function canInvite(space: SpaceDoc, v: ViewerCtx, isIn: boolean): boolean {
  if (space.isBotSeeded || !['active', 'scheduled'].includes(space.status)) return false;
  if (space.hostId?.equals(v.me._id)) return true;
  return space.isPublic && isIn;
}

export async function spaceDTOs(spaces: SpaceDoc[], v: ViewerCtx): Promise<SpaceDTO[]> {
  if (spaces.length === 0) return [];
  const ids = spaces.map((s) => s._id);
  const [sessions, reminders, invites] = await Promise.all([
    col('sessions').find({ spaceId: { $in: ids } }).toArray(),
    col('spaceReminders').find({ userId: v.me._id, spaceId: { $in: ids } }).toArray(),
    col('notifications').find({ userId: v.me._id, type: 'space_invite', 'payload.spaceId': { $in: ids } }).toArray(),
  ]);
  const people = await usersById(sessions.map((s) => s.userId));
  return spaces.map((space) => {
    const isIn = sessions.some((s) => s.spaceId?.equals(space._id) && s.userId.equals(v.me._id) && s.status === 'active');
    const isHostOrInvitee = space.hostId?.equals(v.me._id) || space.invitedUserIds.some((id) => id.equals(v.me._id));
    return toSpaceDTO(space, sessions, people, {
      id: v.me._id,
      canSeeInvites: Boolean(isHostOrInvitee),
      canInvite: canInvite(space, v, isIn),
      reminderOn: reminders.some((r) => r.spaceId.equals(space._id)),
      inviteId: invites.find((n) => (n.payload.spaceId as ObjectId)?.equals(space._id))?._id.toHexString() ?? null,
    });
  });
}

// §6.4 — the whole Spaces tab in one round-trip.
export async function getFeed(me: UserDoc) {
  const v = await viewerCtx(me);
  const now = new Date();
  const friendOids = [...v.friendIds].map((id) => new ObjectId(id));
  const recentEnd = { status: 'completed' as const, endedAt: { $gte: new Date(now.getTime() - DAY) } };
  const [friendSpaces, ownSpaces, publicSpaces, invitedSpaces, bots] = await Promise.all([
    col('spaces')
      .find({ hostId: { $in: friendOids }, $or: [{ status: 'active' }, { status: 'scheduled', startTime: { $lte: new Date(now.getTime() + 7 * DAY) } }, recentEnd] })
      .toArray(),
    col('spaces').find({ hostId: me._id, $or: [{ status: { $in: ['active', 'scheduled'] } }, recentEnd] }).toArray(),
    col('spaces')
      .find({ status: 'active', isPublic: true, isBotSeeded: false, hostId: { $nin: [...friendOids, me._id] } })
      .sort({ liveCount: -1, startTime: -1 })
      .limit(30)
      .toArray(),
    col('spaces').find({ status: 'active', invitedUserIds: me._id }).toArray(),
    col('spaces').find({ status: 'active', isBotSeeded: true }).toArray(),
  ]);
  const byId = new Map<string, SpaceDoc>();
  for (const s of [...friendSpaces, ...ownSpaces, ...publicSpaces, ...invitedSpaces, ...bots]) {
    if (canView(s, v)) byId.set(s._id.toHexString(), s);
  }
  const spaces = await spaceDTOs([...byId.values()], v);

  const [inviteDocs, reminders, together] = await Promise.all([
    col('notifications').find({ userId: me._id, type: 'space_invite', createdAt: { $gte: new Date(now.getTime() - 2 * DAY) } }).toArray(),
    col('spaceReminders').find({ userId: me._id }).toArray(),
    col('togetherStreaks').find({ userIds: me._id }).toArray(),
  ]);
  const invites = inviteDocs
    .filter((n) => n.payload.spaceId && n.payload.fromUserId)
    .map((n) => ({
      _id: n._id.toHexString(),
      spaceId: String(n.payload.spaceId),
      fromUserId: String(n.payload.fromUserId),
      toUserId: me._id.toHexString(),
      status: n.actionTaken === 'joined' ? 'accepted' : n.actionTaken === 'declined' ? 'declined' : 'pending',
      createdAt: n.createdAt.toISOString(),
    }));
  const togetherStreaks: Record<string, ReturnType<typeof toTogetherDTO>> = {};
  for (const t of together) {
    const friend = t.userIds.find((id) => !id.equals(me._id))!;
    togetherStreaks[friend.toHexString()] = toTogetherDTO(t, me.timezone);
  }
  return {
    spaces,
    invites,
    togetherStreaks,
    friendAlertIds: me.notificationPrefs.friendAlertIds.map((id) => id.toHexString()),
    reminderSpaceIds: reminders.map((r) => r.spaceId.toHexString()),
    serverTime: now.toISOString(),
  };
}

export async function browsePublic(me: UserDoc, opts: { categoryId?: string; cursor?: string; limit: number }) {
  const v = await viewerCtx(me);
  const filter: Record<string, unknown> = { status: 'active', isPublic: true };
  if (opts.categoryId) filter.categoryId = opts.categoryId;
  if (opts.cursor) filter._id = { $lt: new ObjectId(Buffer.from(opts.cursor, 'base64url').toString()) };
  const docs = (await col('spaces').find(filter).sort({ _id: -1 }).limit(opts.limit + 1).toArray()).filter((s) => canView(s, v));
  const page = docs.slice(0, opts.limit);
  return {
    items: await spaceDTOs(page, v),
    nextCursor: docs.length > opts.limit ? Buffer.from(page[page.length - 1]._id.toHexString()).toString('base64url') : null,
  };
}

async function loadVisible(me: UserDoc, spaceId: ObjectId) {
  const v = await viewerCtx(me);
  const space = await col('spaces').findOne({ _id: spaceId });
  if (!space || !canView(space, v)) throw notFound('Space');
  return { space, v };
}

export async function getSpace(me: UserDoc, spaceId: ObjectId) {
  const { space, v } = await loadVisible(me, spaceId);
  return (await spaceDTOs([space], v))[0];
}

export interface CreateSpaceInput {
  name: string;
  categoryId: string;
  durationTargetMin: number;
  description?: string | null;
  isPublic: boolean;
  invitedUserIds?: string[];
  startTime?: string;
  maxParticipants?: number | null;
}

export async function createSpace(me: UserDoc, input: CreateSpaceInput) {
  if (!(await getCategories()).some((c) => c._id === input.categoryId)) throw badRequest('UNKNOWN_CATEGORY', 'Pick one of the themes');
  const v = await viewerCtx(me);
  const invitees = (input.invitedUserIds ?? []).filter((id) => v.friendIds.has(id)).map((id) => new ObjectId(id));
  if ((input.invitedUserIds?.length ?? 0) !== invitees.length) throw badRequest('NOT_FRIENDS', 'You can only invite friends');

  const requested = input.startTime ? new Date(input.startTime) : new Date();
  const scheduled = requested.getTime() > Date.now() + MINUTE;
  if (scheduled && requested.getTime() > Date.now() + 30 * DAY) throw badRequest('TOO_FAR', 'Schedule within the next 30 days');
  // Starting now means sitting down now — leave whatever room you were in,
  // and only then stamp the time so the two sessions can't overlap.
  const switched = scheduled ? null : await closeOpenSession(me._id);
  const now = new Date();
  const start = scheduled ? requested : now;

  const space: SpaceDoc = {
    _id: new ObjectId(),
    categoryId: input.categoryId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    hostId: me._id,
    isPublic: input.isPublic,
    maxParticipants: input.maxParticipants ?? null,
    durationTargetMin: input.durationTargetMin,
    status: scheduled ? 'scheduled' : 'active',
    startTime: scheduled ? start : now,
    endedAt: null,
    invitedUserIds: invitees,
    declinedUserIds: [],
    liveCount: scheduled ? 0 : 1,
    isBotSeeded: false,
    syntheticCount: 0,
    createdAt: now,
  };
  const session = await withTransaction(async (txn) => {
    await col('spaces').insertOne(space, { session: txn });
    return scheduled ? null : insertSession(txn, me._id, space, now);
  });
  if (scheduled) scheduleSpaceJobs(space);
  emit('space.created', { space, inviteeIds: invitees, by: me._id });
  if (session) {
    emit('space.started', { space });
    emit('session.opened', { session });
  }
  return { space: (await spaceDTOs([space], v))[0], session: session && sessionDTO(session), switchedFrom: switched };
}

function insertSession(txn: import('mongodb').ClientSession, userId: ObjectId, space: SpaceDoc, now: Date) {
  const session: SessionDoc = {
    _id: new ObjectId(),
    userId,
    categoryId: space.categoryId,
    spaceId: space._id,
    type: 'space',
    startTime: now,
    endTime: null,
    durationMin: 0,
    targetDurationMin: space.durationTargetMin,
    status: 'active',
    closedReason: null,
    completed: false,
    targetHit: false,
    xpEarned: 0,
    createdAt: now,
  };
  return col('sessions').insertOne(session, { session: txn }).then(() => session);
}

export function sessionDTO(s: SessionDoc) {
  return JSON.parse(JSON.stringify(s));
}

// Closes the user's open session (if any) before they sit down elsewhere.
export async function closeOpenSession(userId: ObjectId, exceptSpaceId?: ObjectId): Promise<SessionCloseResult | null> {
  const open = await col('sessions').findOne({ userId, status: 'active' });
  if (!open || (exceptSpaceId && open.spaceId?.equals(exceptSpaceId))) return null;
  const outcome = await closeSession(open._id, 'left');
  if (outcome) emit('session.closed', outcome);
  return outcome?.result ?? null;
}

export async function joinSpace(me: UserDoc, spaceId: ObjectId) {
  const { space, v } = await loadVisible(me, spaceId);
  // Bot-seeded rooms are joinable (backend doc §10.2): the user's session is
  // real; the bots stay synthetic counts that never react or notify.
  if (space.status !== 'active') throw conflict('SPACE_NOT_LIVE', 'This space isn’t live right now');
  const already = await col('sessions').findOne({ userId: me._id, spaceId, status: 'active' });
  if (already) return { space: (await spaceDTOs([space], v))[0], session: sessionDTO(already), switchedFrom: null };

  const present = await col('sessions').find({ spaceId, status: 'active' }, { projection: { userId: 1 } }).toArray();
  if (present.some((p) => v.blocked.has(p.userId.toHexString()))) throw forbidden('BLOCKED_MEMBER_PRESENT', 'You can’t join this space');

  const switchedFrom = await closeOpenSession(me._id, spaceId);
  const now = new Date();
  const { updated, session } = await withTransaction(async (txn) => {
    const updated = await col('spaces').findOneAndUpdate(
      { _id: spaceId, status: 'active', $or: [{ maxParticipants: null }, { $expr: { $lt: ['$liveCount', '$maxParticipants'] } }] },
      { $inc: { liveCount: 1 } },
      { session: txn, returnDocument: 'after' }
    );
    if (!updated) throw conflict('SPACE_FULL', 'This space is full');
    return { updated, session: await insertSession(txn, me._id, updated, now) };
  });
  cancelJob(`emptyCheck:${spaceId.toHexString()}`);
  await col('notifications').updateMany(
    { userId: me._id, type: 'space_invite', 'payload.spaceId': spaceId, actionTaken: null },
    { $set: { actionTaken: 'joined', openedAt: now } }
  );
  emit('space.member_joined', { space: updated, userId: me._id });
  emit('session.opened', { session });
  return { space: (await spaceDTOs([updated], v))[0], session: sessionDTO(session), switchedFrom };
}

export async function leaveSpace(me: UserDoc, spaceId: ObjectId): Promise<SessionCloseResult> {
  const open = await col('sessions').findOne({ userId: me._id, spaceId, status: 'active' });
  if (!open) throw notFound('Open session in this space');
  const outcome = await closeSession(open._id, 'left');
  if (!outcome) throw conflict('ALREADY_CLOSED', 'That session already ended');
  emit('session.closed', outcome);
  return outcome.result;
}

export async function startScheduled(me: UserDoc, spaceId: ObjectId) {
  const v = await viewerCtx(me);
  await closeOpenSession(me._id);
  const now = new Date();
  const result = await withTransaction(async (txn) => {
    const space = await col('spaces').findOneAndUpdate(
      { _id: spaceId, hostId: me._id, status: 'scheduled' },
      { $set: { status: 'active', startTime: now }, $inc: { liveCount: 1 } },
      { session: txn, returnDocument: 'after' }
    );
    if (!space) throw notFound('Scheduled space you host');
    return { space, session: await insertSession(txn, me._id, space, now) };
  });
  cancelSpaceJobs(spaceId);
  emit('space.started', { space: result.space });
  emit('session.opened', { session: result.session });
  return { space: (await spaceDTOs([result.space], v))[0], session: sessionDTO(result.session) };
}

export async function cancelScheduled(me: UserDoc, spaceId: ObjectId) {
  const space = await col('spaces').findOneAndUpdate(
    { _id: spaceId, hostId: me._id, status: 'scheduled' },
    { $set: { status: 'cancelled', endedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!space) throw notFound('Scheduled space you host');
  cancelSpaceJobs(spaceId);
  emit('space.updated', { space });
  return { ok: true };
}

export async function inviteToSpace(me: UserDoc, spaceId: ObjectId, userIds: string[]) {
  const { space, v } = await loadVisible(me, spaceId);
  const isIn = (await col('sessions').countDocuments({ userId: me._id, spaceId, status: 'active' })) > 0;
  if (!canInvite(space, v, isIn)) throw forbidden('CANNOT_INVITE', space.isPublic ? 'Join the space to invite friends' : 'Only the host can invite to a friends-only space');
  const invitees = userIds.filter((id) => v.friendIds.has(id)).map((id) => new ObjectId(id));
  if (invitees.length !== userIds.length) throw badRequest('NOT_FRIENDS', 'You can only invite friends');
  if (space.invitedUserIds.length + invitees.length > 50) throw badRequest('TOO_MANY_INVITES', 'A space can have up to 50 invites');
  const updated = (await col('spaces').findOneAndUpdate(
    { _id: spaceId },
    { $addToSet: { invitedUserIds: { $each: invitees } }, $pull: { declinedUserIds: { $in: invitees } } } as UpdateFilter<SpaceDoc>,
    { returnDocument: 'after' }
  ))!;
  emit('space.invited', { space: updated, inviteeIds: invitees, by: me._id });
  return (await spaceDTOs([updated], v))[0];
}

export async function declineInvite(me: UserDoc, spaceId: ObjectId) {
  await col('spaces').updateOne({ _id: spaceId, invitedUserIds: me._id }, { $addToSet: { declinedUserIds: me._id } });
  await col('notifications').updateMany(
    { userId: me._id, type: 'space_invite', 'payload.spaceId': spaceId },
    { $set: { actionTaken: 'declined', openedAt: new Date() } }
  );
  return { ok: true };
}

// ── Delayed jobs for one scheduled space (deterministic ids) ────────────
export function scheduleSpaceJobs(space: SpaceDoc) {
  const id = space._id.toHexString();
  scheduleJob(`due:${id}`, space.startTime, 'space.due', { spaceId: id });
  scheduleJob(`expire:${id}`, new Date(space.startTime.getTime() + EXPIRE_AFTER_MIN * MINUTE), 'space.expire', { spaceId: id });
  scheduleJob(`reminder:${id}`, new Date(space.startTime.getTime() - REMINDER_LEAD_MIN * MINUTE), 'space.reminder', { spaceId: id });
}
export function cancelSpaceJobs(spaceId: ObjectId) {
  const id = spaceId.toHexString();
  for (const prefix of ['due', 'expire', 'reminder']) cancelJob(`${prefix}:${id}`);
}
export function scheduleEmptyCheck(spaceId: ObjectId) {
  scheduleJob(`emptyCheck:${spaceId.toHexString()}`, new Date(Date.now() + EMPTY_GRACE_MIN * MINUTE), 'space.emptyCheck', { spaceId: spaceId.toHexString() });
}

export const SPACE_HARD_CEILING_MS = (space: SpaceDoc) => space.durationTargetMin * MINUTE + 3 * HOUR;
