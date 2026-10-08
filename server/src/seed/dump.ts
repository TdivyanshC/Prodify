import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BSON } from 'mongodb';
import { buildSeed } from './build';

// npm run seed:dump — writes each collection to seed-output/<name>.json
// (Extended JSON, so ObjectIds/dates survive `mongoimport --jsonArray`).
const now = process.argv[2] ? new Date(process.argv[2]) : new Date();
const data = buildSeed(now);
const dir = join(process.cwd(), 'seed-output');
mkdirSync(dir, { recursive: true });
for (const [name, docs] of Object.entries(data)) {
  writeFileSync(join(dir, `${name}.json`), BSON.EJSON.stringify(docs, undefined, 2, { relaxed: true }));
}
console.log(`Wrote ${Object.keys(data).length} collections to ${dir}`);
