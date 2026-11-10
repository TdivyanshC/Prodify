import { MongoClient, type ClientSession, type Collection, type Db } from 'mongodb';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../seed/assemble';
import { seedDatabase } from '../seed/write';
import { ensureIndexes } from './indexes';
import { VALIDATORS, type CollectionName, type Collections } from './schemas';

let client: MongoClient | null = null;
let db: Db | null = null;
let stopMemory: (() => Promise<unknown>) | null = null;

export async function connectDb(): Promise<Db> {
  let uri = env.MONGO_URI;
  let inMemory = false;
  if (!uri) {
    // Transactions (session close) need a replica set, so the dev fallback is one.
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    const replSet = await MongoMemoryReplSet.create({
      // The default 10s launch limit is too short for a cold start on Windows
      // (antivirus scans the freshly downloaded mongod on first run).
      replSet: { count: 1 },
      instanceOpts: [{ launchTimeout: 60_000 }],
    });
    uri = replSet.getUri();
    stopMemory = () => replSet.stop();
    inMemory = true;
    logger.info('MONGO_URI not set — using an in-memory replica set');
  }
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  db = client.db(env.MONGO_DB);

  const hasUsers = (await db.collection('users').estimatedDocumentCount()) > 0;
  const seed = inMemory || env.SEED_ON_BOOT === 'always' || (env.SEED_ON_BOOT === 'if-empty' && !hasUsers);
  if (seed) {
    await seedDatabase(db);
    logger.info('database seeded with dev test data');
  } else {
    await ensureSchema(db);
  }
  return db;
}

// Create missing collections with validators, re-apply validators to
// existing ones, and make sure every index exists.
async function ensureSchema(database: Db) {
  const existing = new Set((await database.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of COLLECTIONS) {
    if (existing.has(name)) {
      try {
        await database.command({ collMod: name, validator: VALIDATORS[name], validationLevel: 'strict' });
      } catch (err) {
        // Atlas's readWrite role can create collections but not collMod them.
        // Skipping only means validator changes need a more privileged user.
        if ((err as { code?: number }).code !== 13) throw err;
        logger.warn({ collection: name }, 'not authorized to update the collection validator; leaving it as is');
      }
    }
    else await database.createCollection(name, { validator: VALIDATORS[name], validationLevel: 'strict' });
  }
  await ensureIndexes(database);
}

export function getDb(): Db {
  if (!db) throw new Error('Database not connected');
  return db;
}

export function col<K extends CollectionName>(name: K): Collection<Collections[K]> {
  return getDb().collection<Collections[K]>(name);
}

// Multi-document ACID transaction with the driver's retry-on-transient-error.
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  if (!client) throw new Error('Database not connected');
  const session = client.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

export async function closeDb() {
  await client?.close();
  await stopMemory?.();
  client = null;
  db = null;
}
