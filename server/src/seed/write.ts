import type { Db } from 'mongodb';
import { ensureIndexes } from '../db/indexes';
import { VALIDATORS } from '../db/schemas';
import { COLLECTIONS, type SeedData } from './assemble';
import { buildSeed } from './build';

// Drops every collection the seed owns, re-creates them with their
// $jsonSchema validators + indexes, then inserts.
export async function seedDatabase(db: Db, now: Date = new Date()): Promise<SeedData> {
  const data = buildSeed(now);
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of COLLECTIONS) {
    if (existing.has(name)) await db.collection(name).drop();
    await db.createCollection(name, { validator: VALIDATORS[name], validationLevel: 'strict', validationAction: 'error' });
  }
  await ensureIndexes(db);
  for (const name of COLLECTIONS) {
    if (data[name].length) await db.collection(name).insertMany(data[name], { ordered: true });
  }
  return data;
}
