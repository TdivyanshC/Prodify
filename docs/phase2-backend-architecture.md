# Prodify — Phase 2 Backend Architecture

*Companion to `docs/phase2-database-design.md` (the data model) and
`CLAUDE.md` §3 (tech stack). This is the service/API/realtime architecture
that sits on top of that data model. Planning only — no server code is
scaffolded here, since CLAUDE.md's Phase 1 rule is still "UI only, no real
backend wiring." This is what Phase 2 build-out follows.*

---

## 1. Service topology

**Modular monolith — one Express app, not microservices.** At this stage
(new product, small team, unproven load) microservices add operational cost
— multiple deploys, service discovery, distributed tracing — that buys
nothing yet. The one piece that genuinely needs to scale independently is
realtime presence (Socket.IO), and that's solved by a Redis adapter (§6)
without splitting it into its own service. Revisit this only if a specific
module has a load profile the rest of the app doesn't (unlikely before real
user numbers justify it).

---

## 2. Project structure

```
server/
  src/
    config/            env loading + validation, Firebase Admin init, Mongo connection, Redis connection
    middleware/         auth.ts, errorHandler.ts, rateLimiter.ts, validate.ts
    modules/             one folder per domain — routes + controller + service + validation live together
      auth/
      users/
      spaces/
      sessions/
      friendships/
      blocks/
      reactions/
      badges/
      notifications/
      mascot/
      reports/
    sockets/             io.ts (setup + Redis adapter), presence.ts, spaceRoom.ts
    jobs/                streakAtRiskSweep.ts, staleSpaceCleanup.ts, rollupReconciliation.ts
    lib/                 xp.ts, dateBuckets.ts, pagination.ts — shared pure functions
    app.ts               Express app + middleware wiring (no listen())
    server.ts            http server + Socket.IO attach + listen()
  tests/
```

Each `modules/*` folder owns its own DB access, business logic, and HTTP
layer end to end (a "domain" split, not a "technical layer" split across the
whole app) — at this size that's easier to navigate than hunting across a
global `routes/`, `controllers/`, `services/` per change.

---

## 3. Request lifecycle — middleware order

1. `helmet` — security headers
2. `cors` — strict allowlist (the Expo app's origins), not `*`
3. `express.json({ limit })` — body parsing with a size cap
4. request-id + structured logger (`pino`) — every log line correlates to one request
5. rate limiter (Redis-backed, per-route budgets — §7)
6. auth middleware (§4) — verifies the Firebase ID token, attaches `req.user`, rejects suspended/banned accounts before any route logic runs
7. route: `validate(schema)` (zod) → controller → service
8. centralized error handler (last middleware) — every thrown error becomes `{ error: { code, message, details? } }`, consistent status codes, no stack traces leaked in production

One error envelope shape across every endpoint means the RN client needs
exactly one error-handling code path, not one per module.

---

## 4. Auth implementation

- Client: Google Sign-In through the Firebase Auth SDK → gets a Firebase ID token.
- Every authenticated request: `Authorization: Bearer <idToken>`.
- Middleware: `admin.auth().verifyIdToken(token)` → uid/email → upsert `users`
  (create on first sign-in, matching `googleId`) → attach
  `{userId, role, status}` to `req.user`.
- **No separate custom JWT layer for MVP.** Firebase ID tokens are already
  short-lived (~1hr) and the client SDK refreshes them silently — building a
  parallel token/refresh system on top would duplicate what Firebase already
  does correctly, for no MVP benefit.
- `authSessions` (per DB doc) is an audit/device-management layer over
  Firebase's own session — it's what powers "log out of all devices," not
  the primary verification path.
- Suspended/banned accounts (`users.status`) are rejected with 403 in the
  auth middleware itself, so no individual module has to re-check account
  status.

---

## 5. API surface (REST resource map)

| Module | Key endpoints |
|---|---|
| `auth` | `POST /auth/session` — verify token, upsert user, return profile (called once right after client-side Firebase sign-in) |
| `users` | `GET /users/me`, `PATCH /users/me`, `GET /users/:id` (public profile — respects blocks + `socialHandles` visibility), `GET /users/:id/stats?range=daily\|weekly\|monthly&categoryId=` |
| `spaces` | `GET /spaces` (cursor-paginated, filter by `categoryId`), `POST /spaces`, `GET /spaces/:id`, `POST /spaces/:id/join`, `POST /spaces/:id/leave`, `PATCH /spaces/:id` (host only), `POST /spaces/:id/archive` |
| `sessions` | `POST /sessions` (solo start), `POST /sessions/:id/complete` (solo end) — space-linked sessions are opened/closed by the `spaces` join/leave handlers, not called directly; `GET /sessions?userId=&range=` for history |
| `friendships` | `POST /friendships` (send), `POST /friendships/:id/accept`, `POST /friendships/:id/decline`, `DELETE /friendships/:id` (unfriend or cancel-outgoing), `GET /friendships?status=` |
| `blocks` | `POST /blocks`, `DELETE /blocks/:id`, `GET /blocks` |
| `reactions` | `PUT /sessions/:id/reactions` (upsert/toggle, not append) |
| `badges` | `GET /badges` (catalog), `GET /users/:id/badges` |
| `notifications` | `GET /notifications`, `PATCH /notifications/:id/read` |
| `reports` | `POST /reports` |

All list endpoints are cursor-paginated (per the DB doc's scaling notes) —
`skip/limit` is not used anywhere.

---

## 6. Realtime (Socket.IO)

- One namespace, `/spaces`. One room per space: `space:{spaceId}`.
- Socket auth: same Firebase ID token, passed in the connection handshake's
  `auth` payload, verified once per connection (not per event).
- Flow: client calls `POST /spaces/:id/join` (opens the `sessions` doc, per
  DB doc §4) → on success, client emits `space:join` over the socket → server
  joins that socket to the room, writes to the Redis presence hash, broadcasts
  `presence:update` to the room.
- Heartbeat: client pings `presence:heartbeat` every ~20s to refresh its
  Redis TTL entry. No heartbeat for 45s → server treats it as a disconnect,
  closes the open `sessions` doc (grace period, so a dropped wifi connection
  doesn't silently lose clocked time), broadcasts the updated presence.
- **Redis adapter (`@socket.io/redis-adapter`) from day one** — cheap to add
  now, and it's what makes presence broadcasts correct the moment there's
  more than one app instance behind the load balancer. Retrofitting this
  after the fact (once sockets are already assumed single-instance) is much
  more disruptive than including it up front.
- Event catalog (kept deliberately small): `presence:update`,
  `space:member-joined`, `space:member-left`, `session:completed` (client-side
  XP/streak toast trigger), `notification:new`, `friend:request-received`,
  `mascot:event` (pushes a `mascotEvent` the moment it's created, instead of
  the client polling for it).

---

## 7. Background jobs

| Job | Purpose |
|---|---|
| `streakAtRiskSweep` | Runs relative to each user's local day boundary (needs `users.timezone`, added to the DB doc). Finds users below 50% of `dailyTargetMin` with no active session and fires the `streak_at_risk` `mascotEvent` (highest priority per CLAUDE.md §4) while there's still time in their day to act. |
| `staleSpaceCleanup` | Archives `spaces` with no `sessions` activity for N days, so the collection doesn't accumulate dead rooms indefinitely. |
| `rollupReconciliation` | Low-frequency (nightly) sanity check: re-sums a sample of `dailyStats` against raw `sessions` for the day, to catch drift from a failed mid-transaction write. **Alerts, doesn't silently auto-correct** — silent correction would hide the underlying bug instead of surfacing it. |
| `notificationDelivery` (Phase 4) | Drains undelivered `notifications`/`mascotEvents` to FCM. |

Implementation: **BullMQ on Redis**, not bare `node-cron` — Redis is already
a hard dependency for presence, so BullMQ costs little extra and gives
retries, backoff, and observability for free, which matters once
`rollupReconciliation` or `notificationDelivery` start failing intermittently
in production.

---

## 8. Redis usage summary

- Live space presence (§6)
- Rate-limit counters (`rate-limiter-flexible`, Redis store)
- BullMQ job queue (§7)
- Optional short-TTL (~10-30s) cache on `GET /spaces` browse results — add
  only if that endpoint shows up as hot under real load; not a day-one need.

---

## 9. Validation, security, observability

- Per-route `zod` schemas, parsed before the controller runs; failures
  return 400 with field-level detail.
- `helmet`, strict CORS allowlist, `express-mongo-sanitize` (blocks operator
  injection like a `$gt` smuggled into a body/query field — the Mongo
  equivalent of SQL injection defense), body size limits.
- Structured logging (`pino`) with request-id correlation; security-relevant
  events (failed auth, rate-limit trips, actions against a blocked user) get
  their own log level so they're easy to alert on separately from routine noise.
- Centralized error handler reports to an error tracker (Sentry or
  equivalent).
- `GET /healthz` checks Mongo + Redis connectivity, for the load balancer
  and uptime monitoring.

---

## 10. Environment & config

- One `.env` per environment (dev/staging/prod); never committed (already
  covered by `.gitignore` — verify `server/.env*` is included once that
  folder exists).
- A config module validates every required env var **at boot**, not at
  first request — fail fast on a missing `MONGO_URI` rather than 500-ing on
  the first real request.
- Secrets (Firebase service account JSON, Mongo connection string) live in
  the hosting platform's secret manager for staging/prod — plain `.env`
  files are dev-only.

---

## 11. Deployment topology

- Stateless Express + Socket.IO process(es) behind a load balancer,
  horizontally scalable — all real state lives in Mongo/Redis, and the Redis
  adapter (§6) is what makes that safe for Socket.IO specifically.
- MongoDB Atlas (managed replica set) — matches the "replica set from day
  one" note in the DB doc.
- Managed Redis (Upstash / Elasticache / Redis Cloud) rather than
  self-hosting, given team size.
- CI: typecheck + lint + tests on every PR; deploy to staging on merge to
  `main`, manual promotion to prod.

---

## 12. Testing strategy

- **Unit:** service-layer logic that's pure given a doc snapshot — XP
  calculation, streak-threshold evaluation, badge crossing (§5 of the DB
  doc). No DB needed for these.
- **Integration:** route-level tests against a real (in-memory or
  test-container) MongoDB — the multi-document transaction in the
  session-close flow (DB doc §5) specifically needs a real Mongo instance to
  test meaningfully; mocking it would hide the exact failure modes that
  matter (partial writes on crash).
- **Socket:** a client-simulation test for join → presence → heartbeat-loss
  → auto-close-session → leave, since that's the highest-risk realtime path
  and the easiest one to silently regress.

---

## 13. Open decisions to confirm before scaffolding `server/`

1. **Firebase Auth vs Passport + JWT** — this doc assumes Firebase Auth (per
   the earlier auth discussion); CLAUDE.md §3 still lists both as options.
2. **BullMQ vs plain `node-cron`** — recommended BullMQ since Redis is
   already mandatory, but it's an extra dependency to justify if job volume
   stays low for a long time.
3. `users.timezone` has been added to `docs/phase2-database-design.md` §2 to
   support `streakAtRiskSweep` — flagging here since it's a schema change
   made in service of this doc, not the original design pass.
