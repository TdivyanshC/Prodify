import { ObjectId } from 'mongodb';
import { col } from '../db/mongo';
import type { BadgeDoc, CategoryDoc, SessionDoc, SpaceDoc, UserDoc } from '../db/schemas';
import { liveTogether } from '../lib/progress';
import { levelStartXp, nextLevelXp } from '../lib/rules';
import { dayKey } from '../lib/time';
import { presence } from '../realtime/presence';

// Shared read helpers + DTO mappers. DTOs keep the Phase 1 client field
// names (src/types/models.ts, social.ts) so each client service swap is a
// drop-in (backend doc §5.5).

// ── Catalog (fixed, cached) ─────────────────────────────────────────────
let categories: CategoryDoc[] | null = null;
let badges: BadgeDoc[] | null = null;
export async function getCategories() {
  categories ??= await col('sessionCategories').find().sort({ sortOrder: 1 }).toArray();
  return categories;
}
export async function getBadges() {
  badges ??= await col('badges').find().toArray();
  return badges;
}
export function resetCatalogCache() {
  categories = null;
  badges = null;
}
export async function categoryName(id: string) {
  return (await getCategories()).find((c) => c._id === id)?.name ?? '';
}

// ── Social graph ────────────────────────────────────────────────────────
export async function friendIdList(userId: ObjectId): Promise<ObjectId[]> {
  const rows = await col('friendships')
    .find({ status: 'accepted', $or: [{ userIdA: userId }, { userIdB: userId }] }, { projection: { userIdA: 1, userIdB: 1 } })
    .toArray();
  return rows.map((f) => (f.userIdA.equals(userId) ? f.userIdB : f.userIdA));
}
export async function friendIdSet(userId: ObjectId): Promise<Set<string>> {
  return new Set((await friendIdList(userId)).map((id) => id.toHexString()));
}
export async function areFriends(a: ObjectId, b: ObjectId): Promise<boolean> {
  const [userIdA, userIdB] = canonicalPair(a, b);
  return (await col('friendships').countDocuments({ userIdA, userIdB, status: 'accepted' })) > 0;
}
export function canonicalPair(a: ObjectId, b: ObjectId): [ObjectId, ObjectId] {
  return a.toHexString() < b.toHexString() ? [a, b] : [b, a];
}
export async function blockedIdSet(userId: ObjectId): Promise<Set<string>> {
  const rows = await col('blocks').find({ $or: [{ blockerId: userId }, { blockedId: userId }] }).toArray();
  return new Set(rows.map((b) => (b.blockerId.equals(userId) ? b.blockedId : b.blockerId).toHexString()));
}
export async function isBlockedEitherWay(a: ObjectId, b: ObjectId): Promise<boolean> {
  return (
    (await col('blocks').countDocuments({
      $or: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    })) > 0
  );
}

export async function usersById(ids: ObjectId[]): Promise<Map<string, UserDoc>> {
  const unique = [...new Map(ids.map((id) => [id.toHexString(), id])).values()];
  if (unique.length === 0) return new Map();
  const docs = await col('users').find({ _id: { $in: unique } }).toArray();
  return new Map(docs.map((u) => [u._id.toHexString(), u]));
}

// ── DTOs ────────────────────────────────────────────────────────────────
export const avatarInitial = (name: string) => name.trim().charAt(0).toUpperCase() || '·';

export function toUserDTO(u: UserDoc) {
  return {
    _id: u._id.toHexString(),
    googleId: u.googleId,
    handle: u.handle,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    tagline: u.tagline,
    mascotStage: u.mascotStage,
    level: u.level,
    levelProgress: { level: u.level, levelStartXp: levelStartXp(u.level), nextLevelXp: nextLevelXp(u.level) },
    dailyTargetMin: u.dailyTargetMin,
    timezone: u.timezone,
    streak: {
      current: u.streak.current,
      longest: u.streak.longest,
      lastActiveDate: u.streak.lastActiveDate,
      freezesAvailable: u.streak.freezesAvailable,
      freezesUsed: u.streak.freezesUsed,
    },
    points: u.points,
    badgeIds: u.badgeIds,
    counters: u.counters,
    socialHandles: u.socialHandles,
    createdAt: u.createdAt.toISOString(),
    lastActiveAt: u.lastActiveAt.toISOString(),
  };
}

// FriendProfile (src/types/social.ts). `isOnline` only means anything to
// accepted friends — callers pass `showOnline` accordingly (§12 privacy).
export async function toProfileDTO(u: UserDoc, showOnline: boolean) {
  const favorite = u.favoriteCategoryId ? (await getCategories()).find((c) => c._id === u.favoriteCategoryId) : undefined;
  return {
    _id: u._id.toHexString(),
    displayName: u.displayName,
    handle: u.handle,
    avatarInitial: avatarInitial(u.displayName),
    tagline: u.tagline,
    favoriteCategoryIcon: favorite?.icon ?? '✨',
    streak: { current: u.streak.current, longest: u.streak.longest },
    isOnline: showOnline && presence.isOnline(u._id.toHexString()),
    mascotStage: u.mascotStage,
    level: u.level,
  };
}

export function toTogetherDTO(pair: { current: number; longest: number; lastTogetherDay: string } | null, tz: string) {
  const today = dayKey(new Date(), tz);
  return {
    current: liveTogether(pair, today) === 0 ? 0 : (pair?.current ?? 0),
    longest: pair?.longest ?? 0,
    lastTogetherDate: pair?.lastTogetherDay ?? null,
  };
}

// Space → the client's `Session` shape. `participants` lists open sessions
// for live spaces and everyone who came for ended ones (leftAt set).
export function toSpaceDTO(
  space: SpaceDoc,
  sessions: SessionDoc[],
  people: Map<string, UserDoc>,
  viewer: { id: ObjectId; canSeeInvites: boolean; canInvite: boolean; reminderOn: boolean; inviteId: string | null }
) {
  const mine = sessions.filter((s) => s.spaceId?.equals(space._id));
  const shown = space.status === 'active' ? mine.filter((s) => s.status === 'active') : mine;
  // One row per person — someone who left and came back shows once.
  const byUser = new Map<string, SessionDoc>();
  for (const s of shown.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())) {
    const prev = byUser.get(s.userId.toHexString());
    if (!prev || s.status === 'active') byUser.set(s.userId.toHexString(), s);
  }
  const participants = [...byUser.values()].map((s) => {
    const u = people.get(s.userId.toHexString());
    const name = u?.displayName ?? 'Someone';
    return {
      userId: s.userId.toHexString(),
      joinedAt: s.startTime.toISOString(),
      leftAt: s.endTime?.toISOString() ?? null,
      completed: s.completed,
      targetHit: s.targetHit,
      displayName: name,
      avatarInitial: avatarInitial(name),
    };
  });
  return {
    _id: space._id.toHexString(),
    categoryId: space.categoryId,
    templateId: null,
    name: space.name,
    description: space.description,
    isPublic: space.isPublic,
    maxParticipants: space.maxParticipants,
    participantCount: space.liveCount + space.syntheticCount,
    type: 'multiplayer' as const,
    hostId: space.hostId?.toHexString() ?? null,
    isBotSeeded: space.isBotSeeded,
    startTime: space.startTime.toISOString(),
    endedAt: space.endedAt?.toISOString() ?? null,
    durationTargetMin: space.durationTargetMin,
    status: space.status,
    participants,
    invitedUserIds: viewer.canSeeInvites ? space.invitedUserIds.filter((id) => !space.declinedUserIds.some((d) => d.equals(id))).map((id) => id.toHexString()) : [],
    viewer: {
      isIn: mine.some((s) => s.status === 'active' && s.userId.equals(viewer.id)),
      isHost: space.hostId?.equals(viewer.id) ?? false,
      canInvite: viewer.canInvite,
      reminderOn: viewer.reminderOn,
      inviteId: viewer.inviteId,
    },
  };
}

export type SpaceDTO = ReturnType<typeof toSpaceDTO>;

export const idStr = (id: ObjectId | string) => (typeof id === 'string' ? id : id.toHexString());
export const toObjectIds = (ids: string[]) => ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
