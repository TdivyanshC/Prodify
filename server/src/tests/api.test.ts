export {};
// End-to-end API test: boots the real app + Socket.IO on a random port over
// an in-memory replica set seeded with the dev data, drives the main write
// flows as real users, and finishes by re-running every seed invariant on
// what the live code wrote. Run: npm test
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = '';
process.env.LOG_LEVEL = 'warn';
process.env.AUTH_MODE = 'dev';
process.env.GOOGLE_WEB_CLIENT_ID = 'test-web-client';

const { createServer } = await import('node:http');
const { ObjectId } = await import('mongodb');
const { io: ioClient } = await import('socket.io-client');
const { createApp } = await import('../app');
const { closeDb, col, connectDb, getDb } = await import('../db/mongo');
const { registerEventHandlers } = await import('../events/handlers');
const { registerJobs } = await import('../jobs/index');
const { runJobNow, stopJobs } = await import('../jobs/scheduler');
const { closeRealtime, initRealtime } = await import('../realtime/io');
const { COLLECTIONS } = await import('../seed/assemble');
const { checkInvariants } = await import('../seed/invariants');

delete process.env.MONGO_URI;
await connectDb();
registerEventHandlers();
registerJobs();
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
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(as: string, method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { authorization: `Bearer dev:${as}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json as any };
}
const ok = async (as: string, method: string, path: string, body?: unknown) => {
  const r = await api(as, method, path, body);
  assert(r.status < 300, `${method} ${path} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};
const userId = async (handle: string) => (await col('users').findOne({ handle }))!._id;

function socketFor(uid: string) {
  const events: { event: string; payload: any }[] = [];
  const socket = ioClient(`http://localhost:${port}`, { auth: { token: `dev:${uid}` }, transports: ['websocket'] });
  socket.onAny((event, payload) => events.push({ event, payload }));
  return { socket, events, connected: new Promise<void>((r) => socket.on('connect', () => r())) };
}

console.log('\nProdify API end-to-end\n');
const simranId = await userId('simran');
const meeraId = await userId('meera.reads');
const graph = (await col('spaces').findOne({ name: 'Graph Problems Sprint', status: 'active' }))!;
const simSock = socketFor('seed-simran');
await simSock.connected;

await step('auth: seeded user signs in, a brand-new uid is onboarded', async () => {
  const a = await ok('seed-simran', 'POST', '/auth/session', { timezone: 'Asia/Kolkata', deviceId: 'test' });
  assert(a.user.displayName === 'Simran Kaur' && !a.isNew, 'seed user');
  const b = await ok('fresh-tester', 'POST', '/auth/session', { timezone: 'Europe/London' });
  assert(b.isNew && b.user.dailyTargetMin === 30 && b.user.timezone === 'Europe/London', 'new user defaults');
});

await step('auth: missing / malformed token → 401, unknown route → 404', async () => {
  assert((await fetch(`${base}/me`)).status === 401, 'no token');
  assert((await api('', 'GET', '/me')).status === 401, 'empty dev token');
  assert((await api('seed-simran', 'GET', '/nope')).status === 404, 'route 404');
});

await step('auth: session tokens work until that device signs out; bad Google tokens → 401', async () => {
  const { issueSessionToken } = await import('../lib/authTokens');
  await ok('seed-simran', 'POST', '/auth/session', { deviceId: 'token-test' });
  const session = (await col('authSessions').findOne({ userId: simranId, deviceId: 'token-test' }))!;
  const token = await issueSessionToken('seed-simran', session._id.toHexString());
  const call = (path: string, method = 'GET') => fetch(base + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
  assert((await call('/me')).status === 200, 'session token accepted');
  assert((await call('/auth/logout', 'POST')).status === 200, 'logout');
  assert((await call('/me')).status === 401, 'revoked token rejected');
  assert((await call('/auth/session', 'POST')).status === 401, 'revoked token cannot re-open its session');
  const google = await fetch(`${base}/auth/google`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: 'not-a-jwt' }) });
  assert(google.status === 401, `garbage Google token → ${google.status}`);
});

await step('validation: bad space input → 400 with field errors', async () => {
  const r = await api('seed-simran', 'POST', '/spaces', { name: '', categoryId: 'cat_nope', durationTargetMin: 2, isPublic: true });
  assert(r.status === 400 && r.body.error.code === 'VALIDATION_FAILED' && r.body.error.details.name, JSON.stringify(r.body));
});

await step('visibility: a friends-only space is invisible to a non-friend (404)', async () => {
  const r = await api('seed-troll', 'GET', `/spaces/${graph._id}`);
  assert(r.status === 404, `got ${r.status}`);
  const invited = await api('seed-ishaan', 'GET', `/spaces/${graph._id}`);
  assert(invited.status === 200, 'invitee can see it');
});

let closeResult: any;
await step('join: invited user joins live space; invite marked joined; host notified', async () => {
  const r = await ok('seed-simran', 'POST', `/spaces/${graph._id}/join`);
  assert(r.space.viewer.isIn && r.space.participants.some((p: any) => p.userId === simranId.toHexString()), 'in participants');
  const invite = await col('notifications').findOne({ userId: simranId, type: 'space_invite', 'payload.spaceId': graph._id });
  assert(invite?.actionTaken === 'joined', 'invite actionTaken');
  await wait(150);
  const hostNote = await col('notifications').findOne({ userId: graph.hostId!, type: 'space_joined', $or: [{ eventId: `joined_${graph._id}_${simranId}` }, { absorbedEventIds: `joined_${graph._id}_${simranId}` }] });
  assert(hostNote, 'host got space_joined (or it merged into the group)');
  assert((await col('spaces').findOne({ _id: graph._id }))!.liveCount === 4, 'liveCount 4');
});

await step('focus mode: a cheer mid-session is HELD, pushed over the socket as held', async () => {
  // Pretend Simran sat down 70 min ago so the close below has real minutes.
  await col('sessions').updateOne({ userId: simranId, status: 'active' }, { $set: { startTime: new Date(Date.now() - 70 * 60_000) } });
  await ok('seed-meera', 'PUT', '/reactions', { contextType: 'space', contextId: graph._id.toHexString(), toUserId: simranId.toHexString(), type: 'fire', on: true });
  await wait(250);
  const held = await col('notifications').findOne({ userId: simranId, type: 'reactions_received', delivery: 'held' });
  assert(held, 'held notification stored');
  assert(simSock.events.some((e) => e.event === 'notification:new' && e.payload.delivery === 'held'), 'socket said held');
});

await step('reactions: toggle semantics — on twice is idempotent, off removes', async () => {
  const body = { contextType: 'space', contextId: graph._id.toHexString(), toUserId: meeraId.toHexString(), type: 'clap' };
  await ok('seed-simran', 'PUT', '/reactions', { ...body, on: true });
  await ok('seed-simran', 'PUT', '/reactions', { ...body, on: true });
  const count = () => col('reactions').countDocuments({ contextId: graph._id, fromUserId: simranId, toUserId: meeraId, type: 'clap' });
  assert((await count()) === 1, 'one reaction');
  await ok('seed-simran', 'PUT', '/reactions', { ...body, on: false });
  assert((await count()) === 0, 'removed');
});

await step('close transaction: leave → XP, rollups, day credit, streak, level, together streaks', async () => {
  const before = (await col('users').findOne({ _id: simranId }))!;
  closeResult = await ok('seed-simran', 'POST', `/spaces/${graph._id}/leave`);
  const r = closeResult;
  assert(r.session.durationMin === 70 && r.session.xpEarned === 58, `duration/xp ${r.session.durationMin}/${r.session.xpEarned}`);
  assert(r.day.totalMinutes === 125 && r.day.credited && r.day.creditedNow, `day ${JSON.stringify(r.day)}`);
  assert(r.streak.before === 8 && r.streak.after === 9, `streak ${JSON.stringify(r.streak)}`);
  assert(r.xp.after === before.points + 58 && r.xp.levelAfter === 30, `xp ${JSON.stringify(r.xp)}`);
  const meera = r.togetherStreaks.find((t: any) => t.displayName === 'Meera');
  assert(meera?.grew && meera.days === 9, `together ${JSON.stringify(r.togetherStreaks)}`);
  assert(r.heldNotifications.some((n: any) => n.type === 'reactions_received'), '"While you focused" returned');
  assert((await col('notifications').countDocuments({ userId: simranId, delivery: 'held' })) === 0, 'held flipped to inbox');
  await wait(200);
  assert(await col('notifications').findOne({ userId: simranId, type: 'level_up', eventId: 'level_30' }), 'level_up notification');
  assert(simSock.events.some((e) => e.event === 'progress:updated' && e.payload.points === r.xp.after), 'progress pushed');
});

await step('double close is a no-op (409), not double XP', async () => {
  const r = await api('seed-simran', 'POST', `/spaces/${graph._id}/leave`);
  assert(r.status === 404 || r.status === 409, `got ${r.status}`);
});

await step('one open session per user: joining elsewhere switches rooms', async () => {
  await ok('seed-simran', 'POST', `/spaces/${graph._id}/join`);
  const breathe = (await col('spaces').findOne({ name: 'Breathe & Plan' }))!;
  const r = await ok('seed-simran', 'POST', `/spaces/${breathe._id}/join`);
  assert(r.switchedFrom && r.switchedFrom.session.spaceId === graph._id.toHexString(), 'switched out of graph');
  assert((await col('sessions').countDocuments({ userId: simranId, status: 'active' })) === 1, 'exactly one open');
  await ok('seed-simran', 'POST', `/spaces/${breathe._id}/leave`);
});

await step('schedule → invite → host starts → invitee joins → both leave', async () => {
  const start = new Date(Date.now() + 2 * 3600_000).toISOString();
  const created = await ok('seed-simran', 'POST', '/spaces', { name: 'Exam Cram', categoryId: 'cat_study', durationTargetMin: 45, isPublic: false, invitedUserIds: [meeraId.toHexString()], startTime: start });
  assert(created.space.status === 'scheduled' && created.session === null, 'scheduled, nobody clocked');
  await wait(150);
  assert(await col('notifications').findOne({ userId: meeraId, type: 'space_invite', 'payload.spaceId': new ObjectId(created.space._id) }), 'Meera invited');
  const notHost = await api('seed-meera', 'POST', `/spaces/${created.space._id}/start`);
  assert(notHost.status === 404, 'only the host can start');
  await ok('seed-meera', 'PUT', `/me/space-reminders/${created.space._id}`);
  const started = await ok('seed-simran', 'POST', `/spaces/${created.space._id}/start`);
  assert(started.space.status === 'active' && started.space.viewer.isIn, 'live with host');
  await wait(150);
  assert(await col('notifications').findOne({ userId: meeraId, type: 'friend_started_space', 'payload.spaceId': new ObjectId(created.space._id) }), 'reminder holder told it went live');
  await ok('seed-meera', 'POST', `/spaces/${created.space._id}/leave`).catch(() => undefined); // Meera was in Graph — not this one
  await ok('seed-meera', 'POST', `/spaces/${created.space._id}/join`);
  await ok('seed-meera', 'POST', `/spaces/${created.space._id}/leave`);
  await ok('seed-simran', 'POST', `/spaces/${created.space._id}/leave`);
  await runJobNow('space.emptyCheck', { spaceId: created.space._id });
  assert((await col('spaces').findOne({ _id: new ObjectId(created.space._id) }))!.status === 'completed', 'empty space completes');
});

await step('invite rules: only the host invites to friends-only; non-friends rejected', async () => {
  const sp = await ok('seed-riya', 'POST', '/spaces', { name: 'Riya solo', categoryId: 'cat_coding', durationTargetMin: 30, isPublic: false });
  await ok('seed-simran', 'POST', `/spaces/${sp.space._id}/join`);
  const r = await api('seed-simran', 'POST', `/spaces/${sp.space._id}/invites`, { userIds: [meeraId.toHexString()] });
  assert(r.status === 403 && r.body.error.code === 'CANNOT_INVITE', `got ${r.status}`);
  const bad = await api('seed-riya', 'POST', `/spaces/${sp.space._id}/invites`, { userIds: [(await userId('free.followers')).toHexString()] });
  assert(bad.status === 400, 'non-friend invite rejected');
  await ok('seed-simran', 'POST', `/spaces/${sp.space._id}/leave`);
  await ok('seed-riya', 'POST', `/spaces/${sp.space._id}/leave`);
});

await step('solo session: start + complete returns a close result', async () => {
  const s = await ok('seed-simran', 'POST', '/sessions', { categoryId: 'cat_work', targetDurationMin: 25 });
  const r = await ok('seed-simran', 'POST', `/sessions/${s.session._id}/complete`);
  assert(r.session.categoryId === 'cat_work' && r.session.spaceId === null, 'solo close');
});

await step('friendships: accept incoming, send + accept outgoing, counters + notifications', async () => {
  const list = await ok('seed-simran', 'GET', '/friendships');
  const dev = list.friendships.find((f: any) => f.status === 'pending' && f.requestedBy !== simranId.toHexString());
  await ok('seed-simran', 'POST', `/friendships/${dev._id}/accept`);
  const ishaan = await userId('ishaan.walks');
  const sent = await ok('seed-simran', 'POST', '/friendships', { toUserId: ishaan.toHexString() });
  const dup = await api('seed-simran', 'POST', '/friendships', { toUserId: ishaan.toHexString() });
  assert(dup.status === 409, 'duplicate request rejected');
  const selfAccept = await api('seed-simran', 'POST', `/friendships/${sent.friendship._id}/accept`);
  assert(selfAccept.status === 409, 'requester cannot accept own request');
  await ok('seed-ishaan', 'POST', `/friendships/${sent.friendship._id}/accept`);
  await wait(150);
  assert((await col('users').findOne({ _id: simranId }))!.counters.friends === 7, 'friends counter 7');
  assert(await col('notifications').findOne({ userId: simranId, type: 'friend_accepted', 'payload.fromUserId': ishaan }), 'friend_accepted');
});

await step('blocks: blocking a friend removes the friendship and hides them', async () => {
  const ishaan = await userId('ishaan.walks');
  await ok('seed-simran', 'POST', '/blocks', { userId: ishaan.toHexString() });
  assert((await col('friendships').countDocuments({ $or: [{ userIdA: ishaan, userIdB: simranId }, { userIdA: simranId, userIdB: ishaan }] })) === 0, 'friendship gone');
  assert((await api('seed-simran', 'GET', `/users/${ishaan}/profile`)).status === 404, 'profile hidden');
  await ok('seed-simran', 'DELETE', `/blocks/${ishaan}`);
});

await step('notifications: list by category, read, snooze → redelivered as high priority', async () => {
  const list = await ok('seed-simran', 'GET', '/notifications?category=friends&limit=5');
  assert(list.items.length > 0 && list.items.every((n: any) => n.category === 'friends'), 'filtered');
  const target = list.items[0];
  await ok('seed-simran', 'PATCH', `/notifications/${target._id}`, { opened: true });
  await ok('seed-simran', 'POST', `/notifications/${target._id}/snooze`, { minutes: 10 });
  await runJobNow('notification.redeliver', { notificationId: target._id });
  const again = await col('notifications').findOne({ userId: simranId, eventId: { $regex: `^${target.eventId}_snz_` } });
  assert(again && again.priority === 'high' && again.title === target.title, 'redelivered with same words');
  const before = (await ok('seed-simran', 'GET', '/notifications/unread-count')).count;
  await ok('seed-simran', 'POST', '/notifications/read-all');
  assert((await ok('seed-simran', 'GET', '/notifications/unread-count')).count === 0 && before > 0, 'read-all');
});

await step('settings: mute nudges → a nudge is dropped; alerts + reminders toggle', async () => {
  await ok('seed-simran', 'PATCH', '/me/notification-settings', { categories: { nudges: false }, dailyToastCap: 3 });
  const { deliver } = await import('../modules/notifications/deliver');
  const r = await deliver({ userId: simranId, type: 'join_nudge', eventId: 'test_nudge', variants: (await import('../shared/notificationCopy')).JOIN_NUDGE_COPY.evening, sender: { kind: 'spark' } });
  assert(r === 'muted', `got ${r}`);
  await ok('seed-simran', 'DELETE', `/me/friend-alerts/${await userId('riya.codes')}`);
  const s = await ok('seed-simran', 'GET', '/me/notification-settings');
  assert(s.friendAlertIds.length === 1 && s.categories.nudges === false, JSON.stringify(s));
});

await step('dedupe: the same eventId never notifies twice', async () => {
  const { deliver } = await import('../modules/notifications/deliver');
  const draft = { userId: simranId, type: 'goal_close' as const, eventId: 'goalclose_test', vars: { remaining: 10 }, sender: { kind: 'spark' as const } };
  const first = await deliver(draft);
  const second = await deliver(draft);
  assert(first !== 'duplicate' && second === 'duplicate', `${first}/${second}`);
});

await step('jobs: rollover, sweep, recap and nudges run clean on seeded state', async () => {
  for (const job of ['dayRollover', 'sessionSweep', 'weeklyRecap', 'nudgeTick']) await runJobNow(job);
  const u = (await col('users').findOne({ _id: simranId }))!;
  assert(u.streak.current === 9, `streak survived rollover: ${u.streak.current}`);
});

await step('socket: a friend coming online is pushed to their friends', async () => {
  const meeraSock = socketFor('seed-meera');
  await meeraSock.connected;
  await wait(200);
  assert(simSock.events.some((e) => e.event === 'presence:friends' && e.payload.userId === meeraId.toHexString() && e.payload.online), 'online push');
  meeraSock.socket.close();
});

await step('reads: summary, feed, profile, stats, recap, mascot all respond', async () => {
  const summary = await ok('seed-simran', 'GET', '/me/summary');
  assert(summary.todayMinutes === 125, `today ${summary.todayMinutes}`);
  const feed = await ok('seed-simran', 'GET', '/spaces/feed');
  assert(feed.spaces.length > 5 && feed.togetherStreaks, 'feed');
  const prof = await ok('seed-simran', 'GET', `/users/${meeraId}/profile`);
  assert(prof.relationship.status === 'friends' && prof.relationship.togetherStreak.current === 9, JSON.stringify(prof.relationship));
  await ok('seed-simran', 'GET', '/me/stats?range=month');
  await ok('seed-simran', 'GET', '/me/recaps/latest');
  const m = await ok('seed-simran', 'GET', '/mascot/next');
  assert(m.quote, 'quote');
});

await step('INVARIANTS hold on everything the live code wrote', async () => {
  const data: Record<string, any[]> = {};
  for (const name of COLLECTIONS) data[name] = await getDb().collection(name).find().toArray();
  const problems = checkInvariants(data, new Date());
  assert(problems.length === 0, problems.slice(0, 8).join('\n      '));
});

simSock.socket.close();
stopJobs();
await closeRealtime();
server.close();
await closeDb();
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
