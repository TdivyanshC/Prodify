import { MongoClient } from 'mongodb';
import { summarize } from './summary';
import { seedDatabase } from './write';

// npm run seed — wipes and reseeds the dev database in MONGO_URI.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env — fall back to the default below
}

const uri = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/prodify_dev';
const host = new URL(uri.replace(/^mongodb(\+srv)?:/, 'http:')).hostname;
if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host) && process.env.SEED_ALLOW_REMOTE !== '1') {
  console.error(`Refusing to seed non-local host "${host}" — it drops collections. Set SEED_ALLOW_REMOTE=1 if you really mean it.`);
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  // Same database the API uses — an Atlas URI usually has no db in its path.
  const db = client.db(process.env.MONGO_DB ?? 'prodify_dev');
  const now = new Date();
  const data = await seedDatabase(db, now);
  console.log(`Seeded ${db.databaseName} at ${host}\n`);
  console.log(summarize(data, now));
} finally {
  await client.close();
}
