import { MongoClient, MongoServerError } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { COLLECTIONS, type SeedData } from './assemble';
import { MAIN_USER } from './fixtures';
import { checkInvariants } from './invariants';
import { seedDatabase } from './write';

// npm run seed:verify — seeds a throwaway in-memory replica set (no local
// MongoDB needed), reads everything back, re-runs the invariants on what
// Mongo actually stored, and proves the unique indexes reject the writes
// the API must never make.
const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const client = new MongoClient(replSet.getUri());
let ok = true;
try {
  await client.connect();
  const db = client.db('prodify_verify');
  const now = new Date();
  await seedDatabase(db, now);

  const readBack: SeedData = {};
  for (const name of COLLECTIONS) readBack[name] = await db.collection(name).find().toArray();
  const failures = checkInvariants(readBack, now);
  console.log(`Read back ${COLLECTIONS.length} collections, ${Object.values(readBack).reduce((n, d) => n + d.length, 0)} docs`);
  if (failures.length) {
    ok = false;
    console.error(`✗ ${failures.length} invariant failure(s) after round-trip:`);
    for (const f of failures.slice(0, 30)) console.error(`  - ${f}`);
  } else {
    console.log('✓ invariants hold on data read back from MongoDB');
  }

  // Each probe clones a valid doc, so only the unique index can reject it.
  ok = (await expectDuplicateRejected('second open session for one user', async () => {
    const { _id, ...open } = (await db.collection('sessions').findOne({ status: 'active' }))!;
    await db.collection('sessions').insertOne({ ...open, startTime: new Date() });
  })) && ok;
  ok = (await expectDuplicateRejected('duplicate notification eventId', async () => {
    const { _id, ...n } = (await db.collection('notifications').findOne())!;
    await db.collection('notifications').insertOne(n);
  })) && ok;
  ok = (await expectDuplicateRejected('second reaction of the same type (toggle)', async () => {
    const { _id, ...r } = (await db.collection('reactions').findOne())!;
    await db.collection('reactions').insertOne(r);
  })) && ok;
  ok = (await expectDuplicateRejected('duplicate friendship pair', async () => {
    const { _id, ...f } = (await db.collection('friendships').findOne())!;
    await db.collection('friendships').insertOne(f);
  })) && ok;
  ok = (await expectRejected('schema: space with a 300-char name and unknown status', 121, async () => {
    const { _id, ...sp } = (await db.collection('spaces').findOne())!;
    await db.collection('spaces').insertOne({ ...sp, name: 'x'.repeat(300), status: 'paused' });
  })) && ok;
  ok = (await expectRejected('schema: streak with 5 freezes', 121, async () => {
    await db.collection('users').updateOne({ handle: MAIN_USER }, { $set: { 'streak.freezesAvailable': 5 } });
  })) && ok;

  // The session-close flow needs multi-document transactions → replica set.
  const session = client.startSession();
  await session.withTransaction(async () => {
    await db.collection('pointsLedger').insertOne({ probe: true }, { session });
    await session.abortTransaction();
  }).catch(() => undefined);
  await session.endSession();
  const leaked = await db.collection('pointsLedger').countDocuments({ probe: true });
  console.log(leaked === 0 ? '✓ transactions work (aborted write rolled back)' : '✗ aborted transaction leaked a write');
  ok = ok && leaked === 0;
} finally {
  await client.close();
  await replSet.stop();
}
process.exit(ok ? 0 : 1);

async function expectDuplicateRejected(label: string, attempt: () => Promise<unknown>): Promise<boolean> {
  return expectRejected(`index: ${label}`, 11000, attempt);
}

async function expectRejected(label: string, code: number, attempt: () => Promise<unknown>): Promise<boolean> {
  try {
    await attempt();
    console.error(`✗ not rejected: ${label}`);
    return false;
  } catch (e) {
    if (e instanceof MongoServerError && e.code === code) {
      console.log(`✓ rejects ${label}`);
      return true;
    }
    throw e;
  }
}
