import type { ObjectId } from 'mongodb';
import { col } from '../db/mongo';
import type { SpaceDoc } from '../db/schemas';
import { dayKey } from '../lib/time';
import { scheduleEmptyCheck } from '../modules/spaces/service';
import { deliver, firstName, plain, pushMascotEvent } from '../modules/notifications/deliver';
import { categoryName, friendIdList, getBadges, toUserDTO } from '../modules/views';
import { emitToFriendsOf, emitToSpace, emitToUser, refreshFriendRooms } from '../realtime/io';
import { on } from './bus';

// Domain events → notifications, mascot queue, socket pushes (backend doc
// §5.3/§8.3/§9.3). Everything here runs after the write committed.

const name = async (id: ObjectId) => (await col('users').findOne({ _id: id }, { projection: { displayName: 1 } }))?.displayName;

// Spaces carry per-viewer fields, so sockets announce *that* a space changed
// and clients refetch their own view. Only people who care hear it — the
// host's friends, invitees, and whoever is in the room. Never everyone: a
// broadcast to all sockets made every public change cost O(online users)
// pushes plus O(online users) feed refetches (10k load test). Strangers'
// public spaces reach the "Open to everyone" grid on the next tab visit.
export function announceSpace(space: SpaceDoc) {
  const payload = { spaceId: space._id.toHexString(), status: space.status, liveCount: space.liveCount };
  if (space.hostId) {
    emitToFriendsOf(space.hostId, 'space:changed', payload);
    emitToUser(space.hostId, 'space:changed', payload);
  }
  for (const id of space.invitedUserIds) emitToUser(id, 'space:changed', payload);
  emitToSpace(space._id, 'space:changed', payload);
}

async function sendInvites(space: SpaceDoc, inviteeIds: ObjectId[], by: ObjectId) {
  const from = await name(by);
  const scheduled = space.status === 'scheduled';
  for (const userId of inviteeIds) {
    await deliver({
      userId,
      type: 'space_invite',
      eventId: `invite_${space._id.toHexString()}_${userId.toHexString()}`,
      vars: { friend: firstName(from), space: space.name, theme: await categoryName(space.categoryId) },
      sender: { kind: 'friend', userId: by },
      priority: 'high',
      actions: scheduled ? [{ kind: 'remind_space', label: 'Remind me' }] : [{ kind: 'join_space', label: 'Join' }],
      payload: { spaceId: space._id, spaceName: space.name, fromUserId: by, fromUserIds: [by] },
      groupKey: `invite_${space._id.toHexString()}`,
    });
  }
}

export function registerEventHandlers() {
  on('space.created', async ({ space, inviteeIds, by }) => {
    await sendInvites(space, inviteeIds, by);
    announceSpace(space);
  });

  on('space.invited', async ({ space, inviteeIds, by }) => {
    await sendInvites(space, inviteeIds, by);
    announceSpace(space);
  });

  // A friend went live → everyone who rang their bell, or asked to be reminded.
  on('space.started', async ({ space }) => {
    announceSpace(space);
    if (!space.hostId) return;
    const hostName = firstName(await name(space.hostId));
    const friends = await friendIdList(space.hostId);
    const alerted = await col('users').find({ _id: { $in: friends }, 'notificationPrefs.friendAlertIds': space.hostId }, { projection: { _id: 1 } }).toArray();
    const reminded = await col('spaceReminders').find({ spaceId: space._id }).toArray();
    const audience = new Map<string, { id: ObjectId; reminder: boolean }>();
    for (const u of alerted) audience.set(u._id.toHexString(), { id: u._id, reminder: false });
    for (const r of reminded) audience.set(r.userId.toHexString(), { id: r.userId, reminder: true });
    for (const { id, reminder } of audience.values()) {
      if (id.equals(space.hostId)) continue;
      await deliver({
        userId: id,
        type: 'friend_started_space',
        eventId: `started_${space._id.toHexString()}`,
        vars: { friend: hostName, space: space.name, theme: await categoryName(space.categoryId) },
        sender: { kind: 'friend', userId: space.hostId },
        priority: reminder ? 'high' : 'normal',
        actions: [{ kind: 'join_space', label: `Join ${hostName}` }],
        payload: { spaceId: space._id, spaceName: space.name, fromUserId: space.hostId, fromUserIds: [space.hostId] },
        groupKey: 'friend_started',
      });
    }
  });

  on('space.updated', ({ space }) => announceSpace(space));

  on('space.member_joined', async ({ space, userId }) => {
    announceSpace(space);
    emitToSpace(space._id, 'presence:update', { spaceId: space._id.toHexString(), userId: userId.toHexString(), joined: true });
    if (!space.hostId || space.hostId.equals(userId)) return;
    await deliver({
      userId: space.hostId,
      type: 'space_joined',
      eventId: `joined_${space._id.toHexString()}_${userId.toHexString()}`,
      vars: { friend: firstName(await name(userId)), space: space.name },
      sender: { kind: 'friend', userId },
      payload: { spaceId: space._id, spaceName: space.name, fromUserId: userId, fromUserIds: [userId] },
      groupKey: `joined_${space._id.toHexString()}`,
    });
  });

  // Rewards, milestones, presence and space bookkeeping after a close.
  on('session.closed', async ({ user, session, space, result, streakEvents, levelUp, spaceNowEmpty }) => {
    emitToUser(user._id, 'progress:updated', toUserDTO(user));
    if (space) {
      emitToSpace(space._id, 'presence:update', { spaceId: space._id.toHexString(), userId: user._id.toHexString(), left: true });
      if (spaceNowEmpty) scheduleEmptyCheck(space._id);
      announceSpace(space);
    }
    const badges = await getBadges();
    for (const earned of result.badgesEarned) {
      const b = badges.find((x) => x._id === earned._id)!;
      await deliver({
        userId: user._id,
        type: 'badge_earned',
        eventId: `badge_${b._id}`,
        vars: { badge: b.name, icon: b.icon, description: b.description },
        sender: { kind: 'system', emoji: b.icon },
        tone: 'reward',
        priority: 'high',
        actions: [{ kind: 'celebrate', label: 'Celebrate 🎉' }],
        payload: { badgeId: b._id },
      });
      await pushMascotEvent(user._id, 'badge_earned', { badgeId: b._id }, 'progress');
    }
    if (levelUp) {
      await deliver({
        userId: user._id,
        type: 'level_up',
        eventId: `level_${levelUp}`,
        vars: { level: levelUp },
        sender: { kind: 'spark' },
        tone: 'reward',
        priority: 'high',
        actions: [{ kind: 'celebrate', label: 'Celebrate ✨' }],
        payload: { level: levelUp },
      });
      await pushMascotEvent(user._id, 'level_up', { level: levelUp }, 'progress');
    }
    const today = dayKey(session.endTime!, user.timezone);
    for (const e of streakEvents) {
      if (e.type === 'freeze_earned') {
        await deliver({
          userId: user._id,
          type: 'streak_freeze_earned',
          eventId: `freezeearned_${today}`,
          vars: { streak: e.streak, count: e.count },
          sender: { kind: 'system', emoji: '❄️' },
          tone: 'reward',
          priority: 'high',
        });
      }
      if (e.type === 'streak_milestone') {
        // Friends hear about it, with a one-tap 🔥 (fixed reaction set, §4).
        const contextId = `milestone_${user._id.toHexString()}_${e.streak}_${today}`;
        for (const friendId of await friendIdList(user._id)) {
          await deliver({
            userId: friendId,
            type: 'friend_milestone',
            eventId: contextId,
            vars: { friend: firstName(user.displayName), milestone: e.streak },
            sender: { kind: 'friend', userId: user._id },
            actions: [{ kind: 'send_fire', label: 'Send 🔥' }],
            payload: { fromUserId: user._id, fromUserIds: [user._id], milestone: e.streak, milestoneContextId: contextId },
          });
          await pushMascotEvent(friendId, 'friend_achievement', { fromUserId: user._id, milestone: e.streak }, 'friendships');
        }
      }
    }
  });

  on('session.opened', ({ session }) => {
    emitToUser(session.userId, 'session:opened', plain(session));
  });

  on('friendship.requested', async ({ friendship }) => {
    const to = friendship.userIdA.equals(friendship.requestedBy) ? friendship.userIdB : friendship.userIdA;
    await deliver({
      userId: to,
      type: 'friend_request',
      eventId: `request_${friendship._id.toHexString()}`,
      vars: { friend: firstName(await name(friendship.requestedBy)) },
      sender: { kind: 'friend', userId: friendship.requestedBy },
      actions: [
        { kind: 'accept_friend', label: 'Accept' },
        { kind: 'decline_friend', label: 'Decline' },
      ],
      payload: { friendshipId: friendship._id, fromUserId: friendship.requestedBy, fromUserIds: [friendship.requestedBy] },
    });
    for (const id of [friendship.userIdA, friendship.userIdB]) emitToUser(id, 'friendship:changed', { friendshipId: friendship._id.toHexString() });
  });

  on('friendship.accepted', async ({ friendship }) => {
    const accepter = friendship.userIdA.equals(friendship.requestedBy) ? friendship.userIdB : friendship.userIdA;
    await deliver({
      userId: friendship.requestedBy,
      type: 'friend_accepted',
      eventId: `accepted_${friendship._id.toHexString()}`,
      vars: { friend: firstName(await name(accepter)) },
      sender: { kind: 'friend', userId: accepter },
      payload: { friendshipId: friendship._id, fromUserId: accepter, fromUserIds: [accepter] },
    });
    for (const id of [friendship.userIdA, friendship.userIdB]) {
      await refreshFriendRooms(id);
      emitToUser(id, 'friendship:changed', { friendshipId: friendship._id.toHexString() });
    }
  });

  on('friendship.removed', async ({ friendship }) => {
    for (const id of [friendship.userIdA, friendship.userIdB]) {
      await refreshFriendRooms(id);
      emitToUser(id, 'friendship:changed', { friendshipId: friendship._id.toHexString(), removed: true });
    }
  });

  on('reaction.toggled', async ({ reaction, on: isOn }) => {
    if (reaction.contextType === 'space') {
      emitToSpace(String(reaction.contextId), 'reaction:changed', { ...plain(reaction), on: isOn });
    }
    emitToUser(reaction.toUserId, 'reaction:changed', { ...plain(reaction), on: isOn });
    if (!isOn || reaction.contextType !== 'space') return;
    const space = await col('spaces').findOne({ _id: reaction.contextId as ObjectId });
    const recipient = await col('users').findOne({ _id: reaction.toUserId }, { projection: { timezone: 1 } });
    if (!space || !recipient) return;
    const emoji = { clap: '👏', fire: '🔥', fist_bump: '🤜' }[reaction.type];
    await deliver({
      userId: reaction.toUserId,
      type: 'reactions_received',
      eventId: `react_${space._id.toHexString()}_${reaction.fromUserId.toHexString()}_${reaction.type}`,
      vars: { friend: firstName(await name(reaction.fromUserId)), emoji, space: space.name },
      sender: { kind: 'friend', userId: reaction.fromUserId },
      payload: { spaceId: space._id, spaceName: space.name, fromUserId: reaction.fromUserId, fromUserIds: [reaction.fromUserId], reactionEmoji: emoji },
      groupKey: `reactions_${space._id.toHexString()}_${dayKey(new Date(), recipient.timezone)}`,
    });
  });

  on('user.updated', async ({ userId }) => {
    const u = await col('users').findOne({ _id: userId });
    if (u) emitToUser(userId, 'progress:updated', toUserDTO(u));
  });
}
