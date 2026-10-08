// Load test: N users sign in, M hold sockets, K do the core loop.
// Usage: tsx src/tests/load.ts <baseUrl> <users> <sockets> <actors> [concurrency]
// Prints every status/error code with counts and latency percentiles.
import { io } from 'socket.io-client';

const [base = 'http://localhost:4001', usersArg = '10000', socketsArg = '2000', actorsArg = '500', concArg = '50'] = process.argv.slice(2);
const USERS = Number(usersArg);
const SOCKETS = Number(socketsArg);
const ACTORS = Number(actorsArg);
const CONCURRENCY = Number(concArg);

type Result = { status: number; code: string; ms: number };
const results = new Map<string, Result[]>();
function record(step: string, r: Result) {
  const list = results.get(step) ?? [];
  list.push(r);
  results.set(step, list);
}

async function call(step: string, uid: string, method: string, path: string, body?: unknown) {
  const started = performance.now();
  try {
    const res = await fetch(`${base}/v1${path}`, {
      method,
      headers: { authorization: `Bearer dev:${uid}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json().catch(() => null)) as { error?: { code: string } } | null;
    record(step, { status: res.status, code: json?.error?.code ?? 'OK', ms: performance.now() - started });
    return res.ok ? json : null;
  } catch (err) {
    const name = (err as Error).name === 'TimeoutError' ? 'TIMEOUT_30s' : `NETWORK:${(err as Error & { cause?: { code?: string } }).cause?.code ?? (err as Error).message}`;
    record(step, { status: 0, code: name, ms: performance.now() - started });
    return null;
  }
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<unknown>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
function report(title: string, wallMs: number) {
  console.log(`\n=== ${title} (${(wallMs / 1000).toFixed(1)}s) ===`);
  for (const [step, list] of results) {
    const byCode = new Map<string, number>();
    for (const r of list) byCode.set(`${r.status} ${r.code}`, (byCode.get(`${r.status} ${r.code}`) ?? 0) + 1);
    const ms = list.map((r) => r.ms).sort((a, b) => a - b);
    console.log(`${step.padEnd(14)} n=${list.length}  p50=${pct(ms, 50).toFixed(0)}ms p95=${pct(ms, 95).toFixed(0)}ms max=${pct(ms, 100).toFixed(0)}ms  ${[...byCode].map(([k, v]) => `[${k}]×${v}`).join(' ')}`);
  }
  results.clear();
}

const uids = Array.from({ length: USERS }, (_, i) => `load-${i}`);

// 1) Sign-in: every user hits POST /auth/session (creates the account).
let t = performance.now();
await pool(uids, CONCURRENCY, (uid) => call('auth/session', uid, 'POST', '/auth/session', { timezone: 'Asia/Kolkata', deviceId: 'load', platform: 'load' }));
report(`Phase 1: ${USERS} sign-ins, concurrency ${CONCURRENCY}`, performance.now() - t);

// 2) Sockets: the app opens one per signed-in user.
t = performance.now();
const sockets: ReturnType<typeof io>[] = [];
const socketOutcome = new Map<string, number>();
await pool(uids.slice(0, SOCKETS), CONCURRENCY, (uid) =>
  new Promise<void>((resolve) => {
    const s = io(base, { auth: { token: `dev:${uid}` }, transports: ['websocket'], reconnection: false, timeout: 20_000 });
    sockets.push(s);
    const done = (k: string) => {
      socketOutcome.set(k, (socketOutcome.get(k) ?? 0) + 1);
      resolve();
    };
    s.once('connect', () => done('connected'));
    s.once('connect_error', (e) => done(`connect_error: ${e.message}`));
  })
);
console.log(`\n=== Phase 2: ${SOCKETS} sockets (${((performance.now() - t) / 1000).toFixed(1)}s) ===`);
for (const [k, v] of socketOutcome) console.log(`  ${k} ×${v}`);

// 3) Core loop for the app's bootstrap + a space round-trip.
t = performance.now();
await pool(uids.slice(0, ACTORS), CONCURRENCY, async (uid) => {
  await call('me/summary', uid, 'GET', '/me/summary');
  await call('spaces/feed', uid, 'GET', '/spaces/feed');
  await call('friendships', uid, 'GET', '/friendships');
  await call('notifications', uid, 'GET', '/notifications?limit=100');
  const created = (await call('spaces POST', uid, 'POST', '/spaces', { name: `Load ${uid}`, categoryId: 'cat_study', durationTargetMin: 25, isPublic: true })) as { space?: { _id: string } } | null;
  if (created?.space) await call('spaces/leave', uid, 'POST', `/spaces/${created.space._id}/leave`);
});
report(`Phase 3: ${ACTORS} users × bootstrap + create/leave space`, performance.now() - t);

for (const s of sockets) s.close();
process.exit(0);
