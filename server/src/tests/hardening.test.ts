import assert from 'node:assert/strict';
// Production-safety checks: secure env defaults, the rate limiter's memory
// sweep. Run: npm test (also standalone: tsx src/tests/hardening.test.ts)
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';

const { execFileSync } = await import('node:child_process');

let passed = 0;
let failed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(err as Error).message}`);
  }
}

// Boots config/env in a fresh process with exactly the given variables.
function loadEnv(vars: Record<string, string>): { ok: boolean; out: string } {
  const base: Record<string, string> = { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' };
  try {
    const out = execFileSync(
      process.execPath,
      ['--import', 'tsx', '--eval', "const { env, isDev } = await import('./src/config/env.ts'); console.log(JSON.stringify({ n: env.NODE_ENV, a: env.AUTH_MODE, isDev, seed: env.SEED_ON_BOOT }))"],
      { env: { ...base, ...vars }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: String((err as { stderr?: string }).stderr ?? err) };
  }
}

const prod = {
  MONGO_URI: 'mongodb://example/x',
  JWT_SECRET: 'x'.repeat(40),
  GOOGLE_WEB_CLIENT_ID: 'web',
  GOOGLE_ANDROID_CLIENT_ID: 'android',
};

console.log('\nProdify hardening\n');

await check('an unconfigured server is production, not dev: refuses to boot without real settings', () => {
  const r = loadEnv({});
  assert.equal(r.ok, false);
  assert.match(r.out, /production requires/);
});

await check('unset NODE_ENV with full production settings → production + google auth, dev routes off', () => {
  const r = loadEnv(prod);
  assert.equal(r.ok, true, r.out);
  assert.deepEqual(JSON.parse(r.out), { n: 'production', a: 'google', isDev: false, seed: 'never' });
});

await check('production rejects AUTH_MODE=dev, a missing Android client, and a * CORS origin', () => {
  assert.match(loadEnv({ ...prod, AUTH_MODE: 'dev' }).out, /AUTH_MODE/);
  const { GOOGLE_ANDROID_CLIENT_ID: _drop, ...noAndroid } = prod;
  assert.match(loadEnv(noAndroid).out, /GOOGLE_ANDROID_CLIENT_ID/);
  assert.match(loadEnv({ ...prod, CORS_ORIGINS: '*' }).out, /CORS/);
  assert.match(loadEnv({ ...prod, SEED_ON_BOOT: 'if-empty' }).out, /SEED_ON_BOOT/);
});

await check('NODE_ENV=development opts into dev auth', () => {
  const r = loadEnv({ NODE_ENV: 'development' });
  assert.equal(r.ok, true, r.out);
  assert.deepEqual(JSON.parse(r.out), { n: 'development', a: 'dev', isDev: true, seed: 'if-empty' });
});

await check('rate limiter: blocks past the limit, and the sweep frees expired keys', async () => {
  const { rateLimit, sweepRateLimits, rateLimitKeyCount } = await import('../middleware/common');
  const limited = rateLimit('hardening', 2, 1000, (req) => (req as unknown as { who: string }).who);
  const hit = (who: string) => limited({ who } as never, {} as never, () => undefined);
  const before = rateLimitKeyCount();
  hit('a');
  hit('a');
  assert.throws(() => hit('a'), /Slow down/);
  hit('b');
  assert.equal(rateLimitKeyCount(), before + 2);
  sweepRateLimits(Date.now() + 500); // inside the window: nothing to free
  assert.equal(rateLimitKeyCount(), before + 2);
  sweepRateLimits(Date.now() + 5000); // everything expired
  assert.equal(rateLimitKeyCount(), before);
});

await check('app retry: transient errors back off then succeed; permanent errors and exhausted retries throw', async () => {
  const { withRetry } = await import('../../../src/api/retry');
  const waits: number[] = [];
  const sleep = async (ms: number) => void waits.push(ms);
  const transient = (e: unknown) => e === 'wake';

  let calls = 0;
  const woke = await withRetry(async () => (++calls < 3 ? Promise.reject('wake') : 'ok'), transient, [10, 20, 30], sleep);
  assert.equal(woke, 'ok');
  assert.deepEqual(waits, [10, 20]); // two failures → two waits, then success

  calls = 0;
  await assert.rejects(() => withRetry(async () => (++calls, Promise.reject('bad')), transient, [10, 20], sleep), /bad/);
  assert.equal(calls, 1); // permanent error: no retry

  calls = 0;
  await assert.rejects(() => withRetry(async () => (++calls, Promise.reject('wake')), transient, [10, 20], sleep), /wake/);
  assert.equal(calls, 3); // 1 try + 2 retries, then gives up
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
