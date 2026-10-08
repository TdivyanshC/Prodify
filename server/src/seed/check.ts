import { buildSeed } from './build';
import { checkInvariants } from './invariants';
import { summarize } from './summary';

// Builds the seed in memory (no MongoDB needed) and asserts every invariant.
// Pass an ISO date to pin "now": `npm run seed:check -- 2026-10-05T19:45:00+05:30`
const now = process.argv[2] ? new Date(process.argv[2]) : new Date();
const data = buildSeed(now);
console.log(summarize(data, now));
const failures = checkInvariants(data, now);
if (failures.length) {
  console.error(`\n✗ ${failures.length} invariant failure(s):`);
  for (const f of failures.slice(0, 50)) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✓ all invariants hold');
