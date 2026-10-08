import type { CreateIndexesOptions, Db, IndexSpecification } from 'mongodb';

// Index set from docs/phase2-database-design.md §11 (2026-10-05 revision).
// The seed applies these so a seeded dev DB enforces the same uniqueness
// rules the real API will rely on.
export const INDEXES: { collection: string; key: IndexSpecification; options?: CreateIndexesOptions }[] = [
  // Partial, not sparse: a sparse index still indexes explicit nulls, so every
  // new account (googleId: null until Google auth links it) collided with the first.
  { collection: 'users', key: { googleId: 1 }, options: { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } } },
  { collection: 'users', key: { firebaseUid: 1 }, options: { unique: true } },
  { collection: 'users', key: { handle: 1 }, options: { unique: true, partialFilterExpression: { handle: { $type: 'string' } } } },
  { collection: 'users', key: { timezone: 1 } },
  { collection: 'users', key: { 'notificationPrefs.friendAlertIds': 1 } },
  { collection: 'authSessions', key: { userId: 1, revokedAt: 1 } },
  { collection: 'spaces', key: { status: 1, isPublic: 1, categoryId: 1, startTime: -1 } },
  { collection: 'spaces', key: { hostId: 1, status: 1, startTime: -1 } },
  { collection: 'spaces', key: { invitedUserIds: 1, status: 1 } },
  { collection: 'sessions', key: { userId: 1, startTime: -1 } },
  { collection: 'sessions', key: { spaceId: 1, startTime: 1 } },
  { collection: 'sessions', key: { categoryId: 1, status: 1 } },
  { collection: 'sessions', key: { userId: 1 }, options: { unique: true, partialFilterExpression: { status: 'active' }, name: 'one_open_session_per_user' } },
  { collection: 'dailyStats', key: { userId: 1, categoryId: 1, date: 1 }, options: { unique: true } },
  { collection: 'userDailyTotal', key: { userId: 1, date: 1 }, options: { unique: true } },
  { collection: 'pointsLedger', key: { userId: 1, timestamp: 1 } },
  { collection: 'friendships', key: { userIdA: 1, userIdB: 1 }, options: { unique: true } },
  { collection: 'friendships', key: { userIdB: 1, status: 1 } },
  { collection: 'blocks', key: { blockerId: 1, blockedId: 1 }, options: { unique: true } },
  { collection: 'reactions', key: { contextType: 1, contextId: 1, fromUserId: 1, toUserId: 1, type: 1 }, options: { unique: true } },
  { collection: 'reactions', key: { toUserId: 1, createdAt: -1 } },
  { collection: 'togetherStreaks', key: { pairKey: 1 }, options: { unique: true } },
  { collection: 'togetherStreaks', key: { userIds: 1 } },
  { collection: 'spaceReminders', key: { userId: 1, spaceId: 1 }, options: { unique: true } },
  { collection: 'spaceReminders', key: { spaceId: 1 } },
  { collection: 'spaceReminders', key: { remindAt: 1 }, options: { expireAfterSeconds: 86_400 } },
  { collection: 'notifications', key: { userId: 1, eventId: 1 }, options: { unique: true } },
  { collection: 'notifications', key: { userId: 1, createdAt: -1 } },
  { collection: 'notifications', key: { userId: 1, category: 1, createdAt: -1 } },
  { collection: 'notifications', key: { userId: 1, groupKey: 1, openedAt: 1 } },
  { collection: 'notifications', key: { userId: 1, heldForSessionId: 1 } },
  { collection: 'notifications', key: { createdAt: 1 }, options: { expireAfterSeconds: 90 * 86_400 } },
  { collection: 'mascotEvents', key: { userId: 1, deliveredAt: 1 } },
  { collection: 'mascotEvents', key: { createdAt: 1 }, options: { expireAfterSeconds: 30 * 86_400 } },
  { collection: 'weeklyRecaps', key: { userId: 1, weekStart: 1 }, options: { unique: true } },
];

export async function ensureIndexes(db: Db): Promise<void> {
  for (const { collection, key, options } of INDEXES) {
    try {
      await db.collection(collection).createIndex(key, options ?? {});
    } catch (err) {
      // Same keys, changed options (85 IndexOptionsConflict / 86 IndexKeySpecsConflict):
      // replace the old definition.
      const code = (err as { code?: number }).code;
      if (code !== 85 && code !== 86) throw err;
      const existing = (await db.collection(collection).indexes()).find((i) => JSON.stringify(i.key) === JSON.stringify(key));
      if (existing?.name) await db.collection(collection).dropIndex(existing.name);
      await db.collection(collection).createIndex(key, options ?? {});
    }
  }
}
