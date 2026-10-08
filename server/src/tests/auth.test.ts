export {};
// Google sign-in + authorization, end to end, in production auth mode
// (AUTH_MODE=google). A real Google ID token needs a phone and an account, so
// the test signs Google-shaped ID tokens with its own RSA key and points the
// verifier at that key — every other check (audience, azp, issuer, expiry,
// verified email) runs exactly as in production. Run: npm run test:auth
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = '';
process.env.LOG_LEVEL = 'fatal';
process.env.AUTH_MODE = 'google';
process.env.JOBS_ENABLED = 'false';
const WEB = 'test-web.apps.googleusercontent.com';
const ANDROID = 'test-android.apps.googleusercontent.com';
process.env.GOOGLE_WEB_CLIENT_ID = WEB;
process.env.GOOGLE_ANDROID_CLIENT_ID = ANDROID;

const { createServer } = await import('node:http');
const { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } = await import('jose');
const { io: ioClient } = await import('socket.io-client');
const { createApp } = await import('../app');
const { closeDb, col, connectDb } = await import('../db/mongo');
const { registerEventHandlers } = await import('../events/handlers');
const { closeRealtime, initRealtime } = await import('../realtime/io');
const { useGoogleKeysForTests } = await import('../lib/authTokens');

// "Google's" signing key, plus an attacker's key Google never published.
const google = await generateKeyPair('RS256');
const attacker = await generateKeyPair('RS256');
useGoogleKeysForTests(createLocalJWKSet({ keys: [{ ...(await exportJWK(google.publicKey)), kid: 'google-1', alg: 'RS256' }] }));

delete process.env.MONGO_URI;
await connectDb();
registerEventHandlers();
const server = createServer(createApp());
initRealtime(server);
await new Promise<void>((resolve) => server.listen(0, resolve));
const port = (server.address() as { port: number }).port;
const base = `http://localhost:${port}/v1`;

let passed = 0;
const failures: string[] = [];
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(`${name}: ${(err as Error).message}`);
    console.log(`  ✗ ${name}\n      ${(err as Error).message}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

interface IdTokenOpts {
  sub?: string;
  email?: string;
  emailVerified?: boolean;
  aud?: string;
  azp?: string;
  iss?: string;
  exp?: string | number;
  key?: CryptoKey;
  kid?: string;
}
function idToken(o: IdTokenOpts = {}) {
  return new SignJWT({
    email: o.email ?? 'riya.test@gmail.com',
    email_verified: o.emailVerified ?? true,
    name: 'Riya Test',
    picture: 'https://lh3.googleusercontent.com/a/riya',
    azp: o.azp ?? ANDROID,
  })
    .setProtectedHeader({ alg: 'RS256', kid: o.kid ?? 'google-1' })
    .setSubject(o.sub ?? '109876543210')
    .setIssuer(o.iss ?? 'https://accounts.google.com')
    .setAudience(o.aud ?? WEB)
    .setIssuedAt()
    .setExpirationTime(o.exp ?? '1h')
    .sign(o.key ?? google.privateKey);
}

async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(opts.body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}
const signIn = async (token: Promise<string> | string, deviceId = 'phone-1') =>
  call('POST', '/auth/google', { body: { idToken: await token, deviceId, platform: 'android', timezone: 'Asia/Kolkata' } });

function socketConnects(token: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = ioClient(`http://localhost:${port}`, { auth: { token }, transports: ['websocket'], reconnection: false });
    s.on('connect', () => (s.close(), resolve(true)));
    s.on('connect_error', () => (s.close(), resolve(false)));
  });
}

console.log('\nProdify Google auth (AUTH_MODE=google)\n');
let token = '';
let userId = '';

await step('exchange: a valid Google ID token creates the account and returns a session token', async () => {
  const r = await signIn(idToken());
  assert(r.status === 200, `${r.status} ${JSON.stringify(r.body)}`);
  assert(typeof r.body.token === 'string' && r.body.token.split('.').length === 3, 'session token is a JWT');
  assert(r.body.isNew === true, 'first sign-in is new');
  assert(r.body.user.displayName === 'Riya Test', `name from Google: ${r.body.user.displayName}`);
  const doc = await col('users').findOne({ firebaseUid: 'google:109876543210' });
  assert(doc && doc.googleId === '109876543210' && doc.email === 'riya.test@gmail.com', 'user stored with googleId + email');
  assert(doc.avatarUrl === 'https://lh3.googleusercontent.com/a/riya', 'avatar from Google');
  token = r.body.token;
  userId = doc._id.toHexString();
});

await step('exchange: signing in again finds the same account (isNew false)', async () => {
  const r = await signIn(idToken(), 'phone-2');
  assert(r.status === 200 && r.body.isNew === false, JSON.stringify(r.body));
  assert((await col('users').countDocuments({ googleId: '109876543210' })) === 1, 'no duplicate user');
});

await step('authorization: the session token opens every protected area', async () => {
  for (const path of ['/me', '/me/summary', '/friendships', '/spaces', '/notifications', '/me/notification-settings', '/reactions/mine']) {
    const r = await call('GET', path, { token });
    assert(r.status === 200, `GET ${path} → ${r.status} ${JSON.stringify(r.body)}`);
  }
  const me = await call('GET', '/me', { token });
  assert(me.body._id === userId, 'GET /me is the signed-in user');
});

await step('authorization: the realtime socket accepts the session token', async () => {
  assert(await socketConnects(token), 'socket rejected a valid session token');
});

await step('app relaunch: POST /auth/session with the saved token restores the user', async () => {
  const r = await call('POST', '/auth/session', { token, body: { deviceId: 'phone-1', timezone: 'Asia/Kolkata', platform: 'android' } });
  assert(r.status === 200 && r.body.user._id === userId && r.body.isNew === false, `${r.status} ${JSON.stringify(r.body)}`);
});

await step('rejected ID tokens: wrong audience, foreign client, wrong issuer, expired, unverified email, forged key', async () => {
  const cases: [string, Promise<string>][] = [
    ['wrong audience (another app’s token)', idToken({ aud: 'someone-else.apps.googleusercontent.com' })],
    ['unknown azp (unregistered Android client)', idToken({ azp: 'rogue.apps.googleusercontent.com' })],
    ['wrong issuer', idToken({ iss: 'https://evil.example.com' })],
    ['expired', idToken({ exp: Math.floor(Date.now() / 1000) - 60 })],
    ['email not verified', idToken({ emailVerified: false })],
    ['signed with an unpublished key', idToken({ key: attacker.privateKey })],
    ['garbage', Promise.resolve('not-a-jwt')],
  ];
  for (const [label, t] of cases) {
    const r = await signIn(t);
    assert(r.status === 401, `${label} → ${r.status}`);
  }
  const missing = await call('POST', '/auth/google', { body: {} });
  assert(missing.status === 400, `missing idToken → ${missing.status}`);
});

await step('rejected session tokens: none, tampered, foreign secret, expired, and dev tokens in google mode', async () => {
  const [h, p, sig] = token.split('.');
  const flipped = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA');
  const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), sub: 'seed-simran' })).toString('base64url');
  const foreign = await new SignJWT({ sid: 'x' }).setProtectedHeader({ alg: 'HS256' }).setSubject('google:109876543210').setIssuer('prodify').setExpirationTime('1h').sign(new TextEncoder().encode('x'.repeat(40)));
  const { issueSessionToken } = await import('../lib/authTokens');
  const cases: [string, string | undefined][] = [
    ['no token', undefined],
    ['tampered signature', `${h}.${p}.${flipped}`],
    ['payload swapped to another user', `${h}.${forgedPayload}.${sig}`],
    ['signed with a different secret', foreign],
    ['dev token (disabled in google mode)', 'dev:seed-simran'],
  ];
  for (const [label, t] of cases) {
    const r = await call('GET', '/me', { token: t });
    assert(r.status === 401, `${label} → ${r.status}`);
  }
  // Expired: a token whose exp has passed, otherwise valid.
  const sid = (await col('authSessions').findOne({ deviceId: 'phone-1', revokedAt: null }))!._id.toHexString();
  const { SignJWT: Sign } = await import('jose');
  const { env } = await import('../config/env');
  const expired = await new Sign({ sid }).setProtectedHeader({ alg: 'HS256' }).setSubject('google:109876543210').setIssuer('prodify').setIssuedAt(1).setExpirationTime(2).sign(new TextEncoder().encode(env.JWT_SECRET));
  assert((await call('GET', '/me', { token: expired })).status === 401, 'expired session token accepted');
  assert(typeof (await issueSessionToken('google:109876543210', sid)) === 'string', 'issuer sanity');
  assert(!(await socketConnects('dev:seed-simran')), 'socket accepted a dev token in google mode');
});

await step('logout: revokes only this device — the token, the socket and a relaunch all stop working', async () => {
  const other = await signIn(idToken(), 'tablet');
  const out = await call('POST', '/auth/logout', { token });
  assert(out.status === 200, `logout → ${out.status}`);
  assert((await call('GET', '/me', { token })).status === 401, 'revoked token still opens /me');
  assert(!(await socketConnects(token)), 'socket accepted a revoked token');
  assert((await call('POST', '/auth/session', { token, body: { deviceId: 'phone-1' } })).status === 401, 'relaunch revived a revoked token');
  assert((await call('GET', '/me', { token: other.body.token })).status === 200, 'logout leaked to another device');
});

await step('re-sign-in on the same phone issues a new token and keeps the old one dead', async () => {
  const again = await signIn(idToken(), 'phone-1');
  assert(again.status === 200, `re-sign-in → ${again.status}`);
  assert((await call('GET', '/me', { token: again.body.token })).status === 200, 'new token rejected');
  assert((await call('GET', '/me', { token })).status === 401, 'old revoked token came back to life');
  // A relaunch with the new token must not revive the old row either.
  await call('POST', '/auth/session', { token: again.body.token, body: { deviceId: 'phone-1' } });
  assert((await call('GET', '/me', { token })).status === 401, 'relaunch revived the old token');
});

await step('suspended account: sign-in → 403 and existing tokens stop working', async () => {
  const live = await signIn(idToken(), 'phone-3');
  await col('users').updateOne({ googleId: '109876543210' }, { $set: { status: 'suspended' } });
  const r = await signIn(idToken(), 'phone-4');
  assert(r.status === 403 && r.body.error.code === 'ACCOUNT_SUSPENDED', `${r.status} ${JSON.stringify(r.body)}`);
  assert((await call('GET', '/me', { token: live.body.token })).status === 403, 'suspended user still authorized');
  await col('users').updateOne({ googleId: '109876543210' }, { $set: { status: 'active' } });
});

await step('a second Google account gets its own separate user', async () => {
  const r = await signIn(idToken({ sub: '555', email: 'arjun.test@gmail.com' }));
  assert(r.status === 200 && r.body.isNew === true && r.body.user._id !== userId, JSON.stringify(r.body));
  const me = await call('GET', '/me', { token: r.body.token });
  assert(me.body._id === r.body.user._id, 'token maps to the wrong user');
});

closeRealtime();
server.close();
await closeDb();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
process.exit(0);
