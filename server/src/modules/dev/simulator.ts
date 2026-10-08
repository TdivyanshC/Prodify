import { ObjectId } from 'mongodb';
import { col } from '../../db/mongo';
import { emit } from '../../events/bus';
import { logger } from '../../lib/logger';
import { presence } from '../../realtime/presence';
import { acceptFriendship } from '../social/routes';
import { joinSpace } from '../spaces/service';
import { canonicalPair } from '../views';

// Dev-only "the friends are real" simulator. Seed friends act through the
// SAME service functions a real client hits, so every effect (sessions,
// notifications, sockets, together streaks) is the production code path.
// Replaces the app's deleted mocks/notificationSimulations.ts. It only ever
// acts as seeded *friend* users — never bot-seeded rooms (CLAUDE.md §4).

const TICK_MS = 20_000;
const INVITEE_JOIN_AFTER_MS = 40_000;
const CHEER_AFTER_MS = 60_000;
const ACCEPT_AFTER_MS = 150_000;

let timer: NodeJS.Timeout | null = null;

export function startSimulator() {
  if (timer) return;
  timer = setInterval(() => void tick().catch((err) => logger.error({ err }, 'simulator tick failed')), TICK_MS);
  timer.unref();
  logger.info('dev simulator on — seeded friends will join, cheer and accept for real clients');
}

export function stopSimulator() {
  if (timer) clearInterval(timer);
  timer = null;
}

const isSeedBot = async (id: ObjectId) => {
  const u = await col('users').findOne({ _id: id });
  return u && u.firebaseUid.startsWith('seed-') && !presence.isOnline(id.toHexString()) ? u : null;
};

async function tick() {
  for (const onlineId of presence.onlineUserIds()) {
    const realUser = new ObjectId(onlineId);
    const since = presence.onlineSince(onlineId) ?? Date.now();

    // 1) Friends invited into this user's live space show up.
    const hosted = await col('spaces').find({ hostId: realUser, status: 'active' }).toArray();
    for (const space of hosted) {
      if (Date.now() - space.startTime.getTime() < INVITEE_JOIN_AFTER_MS) continue;
      for (const inviteeId of space.invitedUserIds) {
        const friend = await isSeedBot(inviteeId);
        if (!friend || (await col('sessions').countDocuments({ userId: inviteeId, status: 'active' }))) continue;
        await joinSpace(friend, space._id).catch(() => undefined);
        break; // one arrival per tick feels natural
      }
    }

    // 2) Friends sitting with this user cheer them once per session.
    const open = await col('sessions').findOne({ userId: realUser, status: 'active', spaceId: { $ne: null } });
    if (open && Date.now() - open.startTime.getTime() > CHEER_AFTER_MS) {
      const companions = await col('sessions').find({ spaceId: open.spaceId, status: 'active', userId: { $ne: realUser } }).toArray();
      for (const c of companions) {
        const friend = await isSeedBot(c.userId);
        if (!friend) continue;
        const [userIdA, userIdB] = canonicalPair(realUser, c.userId);
        if (!(await col('friendships').countDocuments({ userIdA, userIdB, status: 'accepted' }))) continue;
        const already = await col('reactions').countDocuments({ contextType: 'space', contextId: open.spaceId!, fromUserId: c.userId, toUserId: realUser });
        if (already) continue;
        const reaction = {
          _id: new ObjectId(),
          contextType: 'space' as const,
          contextId: open.spaceId!,
          fromUserId: c.userId,
          toUserId: realUser,
          type: (['fire', 'clap', 'fist_bump'] as const)[Math.floor(Math.random() * 3)],
          createdAt: new Date(),
        };
        await col('reactions').insertOne(reaction);
        emit('reaction.toggled', { reaction, on: true });
        break;
      }
    }

    // 3) Someone this user asked eventually says yes.
    if (Date.now() - since > ACCEPT_AFTER_MS) {
      const outgoing = await col('friendships').find({ status: 'pending', requestedBy: realUser }).toArray();
      for (const f of outgoing) {
        const otherId = f.userIdA.equals(realUser) ? f.userIdB : f.userIdA;
        const friend = await isSeedBot(otherId);
        if (friend) {
          await acceptFriendship(friend, f).catch(() => undefined);
          break;
        }
      }
    }
  }
}
