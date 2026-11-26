import type { ObjectId } from 'mongodb';
import { col, withTransaction } from '../../db/mongo';

// Permanently removes a user and everything that is theirs. Runs in one transaction so a failure
// leaves nothing half-deleted. Things that belong to other people are kept but stop pointing at
// this account: a space they hosted loses its host (hostId is nullable), and friends' friend
// counters are corrected. Abuse reports FILED AGAINST this account are kept (they hold no personal
// data, only the id) so safety history survives; reports they filed are deleted.
export async function deleteAccount(userId: ObjectId): Promise<void> {
  await withTransaction(async (session) => {
    const opts = { session };

    // Friends: fix the other side's counter for every accepted friendship, then drop them all.
    const friendships = await col('friendships').find({ $or: [{ userIdA: userId }, { userIdB: userId }] }, opts).toArray();
    const friendIds = friendships.filter((f) => f.status === 'accepted').map((f) => (f.userIdA.equals(userId) ? f.userIdB : f.userIdA));
    if (friendIds.length > 0) await col('users').updateMany({ _id: { $in: friendIds }, 'counters.friends': { $gt: 0 } }, { $inc: { 'counters.friends': -1 } }, opts);
    await col('friendships').deleteMany({ $or: [{ userIdA: userId }, { userIdB: userId }] }, opts);
    await col('blocks').deleteMany({ $or: [{ blockerId: userId }, { blockedId: userId }] }, opts);
    await col('reports').deleteMany({ reporterId: userId }, opts);

    // Reactions, together streaks, reminders.
    await col('reactions').deleteMany({ $or: [{ fromUserId: userId }, { toUserId: userId }] }, opts);
    await col('togetherStreaks').deleteMany({ userIds: userId }, opts);
    await col('spaceReminders').deleteMany({ userId }, opts);

    // Spaces: no host any more, and no dangling invites.
    await col('spaces').updateMany({ hostId: userId }, { $set: { hostId: null } }, opts);
    await col('spaces').updateMany({ $or: [{ invitedUserIds: userId }, { declinedUserIds: userId }] }, { $pull: { invitedUserIds: userId, declinedUserIds: userId } }, opts);

    // Notifications (theirs, and ones other people got from them), Spark events, recaps.
    await col('notifications').deleteMany({ $or: [{ userId }, { 'sender.userId': userId }] }, opts);
    await col('mascotEvents').deleteMany({ userId }, opts);
    await col('weeklyRecaps').deleteMany({ userId }, opts);

    // If they were live in a space, take them out of its live count first (and end the space if
    // they were the last one in it), the same bookkeeping a normal session close does.
    const live = await col('sessions').find({ userId, spaceId: { $ne: null }, status: { $in: ['active', 'closing'] } }, opts).toArray();
    const liveSpaceIds = live.map((l) => l.spaceId!) ;
    for (const spaceId of liveSpaceIds) await col('spaces').updateOne({ _id: spaceId, liveCount: { $gt: 0 } }, { $inc: { liveCount: -1 } }, opts);
    if (liveSpaceIds.length > 0) await col('spaces').updateMany({ _id: { $in: liveSpaceIds }, status: 'active', liveCount: 0 }, { $set: { status: 'completed', endedAt: new Date() } }, opts);

    // Progress and history.
    await col('sessions').deleteMany({ userId }, opts);
    await col('dailyStats').deleteMany({ userId }, opts);
    await col('userDailyTotal').deleteMany({ userId }, opts);
    await col('pointsLedger').deleteMany({ userId }, opts);

    // Sign-in sessions (this also kills every token the account still holds), then the account.
    await col('authSessions').deleteMany({ userId }, opts);
    await col('users').deleteOne({ _id: userId }, opts);
  });
}
