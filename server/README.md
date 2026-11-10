# Prodify server

The Phase 2 API from `docs/phase2-backend-architecture.md`: Express + Socket.IO over MongoDB, with in-process background jobs. It ships with a full dev
seed (1 main user, 5 friends and ~120 days of activity), so every screen in the app has real data.

```bash
cd server
npm install
npm run dev           # API on :4000. With no MONGO_URI: in-memory replica set, seeded at boot
npm test              # 22 end-to-end checks + every data invariant re-checked on what the live code wrote
npm run seed:check    # build the seed in memory + assert invariants (no MongoDB needed)
npm run seed:verify   # seed a throwaway replica set, read back, prove validators + unique indexes
npm run seed          # wipe + seed MONGO_URI (localhost only)
```

**Phone over USB:** run `adb reverse tcp:4000 tcp:4000` so the app's `http://localhost:4000` reaches this machine. On Wi-Fi, set
`EXPO_PUBLIC_API_URL=http://<LAN-IP>:4000` for Expo instead. The app signs in as `seed-simran`; set `EXPO_PUBLIC_DEV_ACCOUNT` to use another
seed account.

**Secure by default:** `NODE_ENV` defaults to `production` and `AUTH_MODE` to `google`, so an unconfigured deploy has no dev tokens and no `/v1/dev`. `npm run dev` and the seed scripts set `NODE_ENV=development` themselves. In production the server won't boot without `MONGO_URI`, `JWT_SECRET`, `GOOGLE_WEB_CLIENT_ID` and `GOOGLE_ANDROID_CLIENT_ID`.

**Dev auth:** `Authorization: Bearer dev:<firebaseUid>`, for example `dev:seed-simran`. `GET /v1/dev/accounts` lists the seed accounts, and
`POST /v1/dev/reset` reseeds relative to now. Production refuses dev auth (`AUTH_MODE=google` is required).

**Google auth:** `POST /v1/auth/google { idToken, deviceId, timezone, platform }` verifies a Google ID token (needs `GOOGLE_WEB_CLIENT_ID`) and returns `{ token, user, isNew }`; send `Authorization: Bearer <token>` after that. `POST /v1/auth/logout` revokes that device's token. Session tokens are signed with `JWT_SECRET` and accepted in both auth modes.

## Layout

| Path | What |
|---|---|
| `src/db/schemas.ts` | Every collection's TS type and its MongoDB `$jsonSchema` validator, plus a relationship map |
| `src/db/indexes.ts` | Index set: uniqueness guards (one open session per user, canonical friend pairs, toggle reactions, notification dedupe) and TTLs |
| `src/lib/progress.ts`, `rules.ts` | Pure streak, freeze, together-streak, badge, XP and level rules, shared by the API, jobs and seed |
| `src/modules/*` | REST modules: `users` (auth, me, settings), `spaces`, `sessions` (incl. the close transaction), `social` (friendships, blocks, reactions, reports), `notifications` (pipeline, inbox, mascot), `analytics`, `dev` |
| `src/events/` | Domain event bus + handlers: events → notifications, mascot queue and socket pushes |
| `src/realtime/` | Socket.IO rooms (`user:`, `space:`, `friends-of:`, `lobby`) and presence |
| `src/jobs/` | Space reminder/due/expire/empty-check, session sweep, day rollover (freezes), nudges, weekly recap, snooze re-delivery |
| `src/modules/dev/simulator.ts` | Dev only: seeded friends join your space, cheer you and accept your requests through the real services |

In dev, jobs and the rate limiter run in-process. They sit behind BullMQ/Redis-shaped interfaces for the multi-instance move, and delayed jobs
are re-armed from the database on boot.

## How it's built

1. **`fixtures.ts`** is hand-written. It holds the cast, their habits, friendships, recurring spaces, and what is happening "right now".
2. **`generate.ts`** turns that into raw activity: sessions, spaces and reactions. It uses a seeded RNG, never overlaps a user's sessions,
   and positions everything relative to the moment you run it.
3. **`replay.ts`** replays that activity in time order through the backend rules (`src/lib/rules.ts`): 50 XP/hr, daily-total streak
   credit at ≥50%, freezes (+1 per 7 days, max 3, one missed day only), threshold-cross badges, levels, and together streaks (same
   space, ≥10 min overlap, closer's day credited).
4. **`assemble.ts`** writes every collection, including notifications built from the app's own copy library
   (`src/mocks/notificationCopy.ts`). They go through the same dedupe, group and delivery rules as the backend pipeline.
5. **`invariants.ts`** recomputes everything from raw sessions and fails on any drift. Examples: points ≠ ledger, a rollup ≠ the sum of
   its sessions, an overlapping or second open session, a non-canonical friendship, a held notification without an open session.

IDs are deterministic (`oid("user:simran")`), so they're the same on every run.

## The cast

| Handle | Relationship to Simran | Notes |
|---|---|---|
| `simran` (**main test user**, `firebaseUid: seed-simran`) | — | 120-day history. Streak 8 (longest 14), 1 freeze left with 2 used. Partway to today's 120-min target. Hosts Library Hours, has a scheduled Weekend Study Marathon, set a reminder for Arjun's Leg Day |
| `riya.codes` | friend | hosts the live friends-only **Graph Problems Sprint** (Simran's invite is pending). Streak 12 |
| `meera.reads` | friend | in Riya's space right now. Streak 21 (milestone → Simran sent 🔥). Night owl. Nudges muted. 8-day together streak with Simran |
| `arjun.lifts` | friend | in an open **solo** session right now. Morning Run Club host. Lapsed together streak |
| `kabir.breathes` | friend (10 days) | hosted today's ended Wind-down Session with Simran (together streak 1). Live in public Breathe & Plan |
| `sara.sketches` | friend | **America/New_York**, which tests per-user day keys. Her scheduled Sunrise Sketch expired (cancelled) |
| `dev.ships` | incoming request (pending) | met Simran in his public Deep Work Block |
| `priya.grows` | outgoing request (pending) | had a 4-day gap (welcome_back). Hosts public Sketch & Chill |
| `ishaan.walks` | suggestion (mutual: Riya, Meera) | in Riya's space right now |
| `free.followers` | blocked + reported by Simran | |

Also seeded: 3 bot-seeded public rooms (synthetic counts only, no sessions), 4 weeks of weekly recaps, a mascot event queue, and
notifications of all 19 types across toast, inbox and held delivery. Run `npm run seed:check` for the live numbers.

## Not covered yet

- Seed accounts have fake `firebaseUid`s (`seed-<handle>`), so they're reachable only through dev tokens; Google users get `google:<sub>`.
- The level curve is still provisional (250 XP/level, backend doc D3), so levels run high.
