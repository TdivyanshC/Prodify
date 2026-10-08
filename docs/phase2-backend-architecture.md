# Prodify — Phase 2 Backend Architecture (v2)

*Companion to `docs/phase2-database-design.md` (the data model — authoritative
for collection shapes and indexes) and `CLAUDE.md` §3/§4 (stack and locked
product rules). Planning only — no `server/` code is scaffolded, per
CLAUDE.md §2's build order.*

*v2 (2026-10-05) rewrites v1 around what the Phase 1 client actually
consumes. v1 was written before the Spaces social layer (invites,
visibility, scheduling, together streaks), the rebuilt notification system,
the weekly recap, and focus mode existed. §1–§2 summarize the frontend
analysis behind this version. §3 lists where the built client disagrees
with locked rules, and v2 picks a side for each one.*

---

## 1. Frontend analysis — what the backend has to serve

### 1.1 Screen → data → endpoint

| Screen / surface | Reads today (mock/store) | Writes today | Phase 2 source |
|---|---|---|---|
| **Auth** | — | `useAuthStore.signInWithGoogleMock` | Firebase Google sign-in → `POST /v1/auth/session` |
| **Home** | `user` (streak, points), `homeStats` (today min/target, xpToday, sessionsCompletedTotal), live spaces (bot-seeded + own), friends focusing now, unread-notification dot | join space | `GET /v1/me/summary`, `GET /v1/spaces/feed`, socket `presence:friends` |
| **Home Spark arrival** | streak, `lastActiveAt`, sessionsCompletedTotal, focusing friends | — | stays client-side, derived from `/me/summary` (§10.1) |
| **Mascot card** | `mascotService.getNextMascotMessage` | — | `GET /v1/mascot/next` + `POST /v1/mascot/events/:id/delivered` |
| **Spaces tab** | friends' live spaces, scheduled (friends' + own), friends' recently ended, public "open to everyone" grid, pending invites, alert bells, reminder toggles, together streaks per friend, card reactions | create, join, toggle reaction, toggle bell, toggle reminder, accept/decline invite | `GET /v1/spaces/feed` (one round-trip, all sections), `GET /v1/spaces?scope=public&categoryId=&cursor=` |
| **Create Space modal** | categories, accepted friends | create (name, category, duration, description, isPublic, invitees, optional future `startTime`) | `GET /v1/categories`, `POST /v1/spaces` |
| **Session Room** | the space, participants (present + invited-not-here), group focused minutes, reaction counts, invitable friends | finish(targetHit) → `completeSession` + `recordSessionResult` + `recordTogether`; in-room invite; reactions | `GET /v1/spaces/:id`, socket room `space:{id}`, `POST /v1/spaces/:id/leave` → **SessionCloseResult** (§7.3), `POST /v1/spaces/:id/invites` |
| **Post-Session** | route params (minutes, points, streak before/after, together streaks) + held notifications ("While you focused") | — | entirely from the SessionCloseResult; no extra fetch |
| **Friends** | friendships (accepted / incoming / outgoing), friend profiles (tagline, favourite category icon, streak, online, mascotStage), suggestions | accept, decline, send, unfriend | `GET /v1/friends`, `GET /v1/friends/requests`, `GET /v1/friends/suggestions`, `POST/DELETE /v1/friendships…` |
| **Friend Profile** | profile + stats, friendship `createdAt`, together streak, alert bell | unfriend, toggle bell | `GET /v1/users/:id/profile` (includes `relationship` block) |
| **Profile** | user, stat tiles, 4-month heatmap (`{date,totalMinutes}`), weekly chart, badge catalog + earned | sign out | `GET /v1/me`, `GET /v1/me/activity?from=&to=`, `GET /v1/badges` |
| **Progress / Achievements** | placeholders today | — | `GET /v1/me/stats?range=&categoryId=`, `GET /v1/badges` |
| **Weekly Recap** | total, per-day, best day, top category, sessions completed, spaces joined, focused-with friends, cheers received | — | `GET /v1/me/recaps/:weekStart` (materialized by the `weeklyRecap` job, §10) |
| **Notifications inbox** | `AppNotification[]` (title/body/sender/tone/priority/actions/payload/groupKey), category filter tabs | mark read, mark all read, remove, snooze, run action | `GET /v1/notifications?category=&cursor=`, `PATCH …/:id`, `POST …/read-all`, `POST …/:id/snooze`, `DELETE …/:id`; socket `notification:new` |
| **Notification settings** | per-category switches, quiet hours, daily toast cap, per-friend alert bells | toggles | `GET/PATCH /v1/me/notification-settings`, `PUT/DELETE /v1/me/friend-alerts/:userId` |
| **Toast / NotificationRunner** | runs triggers every 10s on the client + diffs store transitions | `deliver()` | **deleted**: triggers move server-side (§8). The client only renders what the server tells it to (§8.4) |

### 1.2 Client logic that moves to the server

Several Phase 1 utilities are product rules running on the client. In Phase 2
the server owns them, and the client either deletes them or keeps a copy
for display only:

| Phase 1 location | Rule | Phase 2 owner |
|---|---|---|
| `useUserStore.recordSessionResult` | XP, streak increment, freeze earn, XP badges | `progress` engine, inside the session-close transaction (§7.3) |
| `useUserStore.applyStreakFreeze` (on load) | spend a freeze for exactly one missed day | `dayRollover` job (§10) |
| `useTogetherStreakStore` / `utils/togetherStreak.ts` | together-streak advance | `progress` engine (§7.4) |
| `utils/levels.ts` | level from XP | `packages/shared/rules/levels.ts` (shared; §4) |
| `useSessionStore.completeSession` | minutes logged, streak eligibility | `sessions` service, using server timestamps only |
| `utils/notifications/deliver.ts` | dedupe, mute, group, inbox, toast decision | `notifications` pipeline (§8) |
| `utils/notifications/triggers/*` | time-of-day + lifecycle triggers | BullMQ jobs + domain events (§8.3, §10) |
| `mocks/notificationSimulations.ts` | fake realtime cheers/joins/accepts | deleted. Real socket events replace it (CLAUDE.md §4 already says so) |
| `services/mascotService` priority pick | which mascot event wins | `mascot` module (CLAUDE.md §4: server-side) |
| `utils/progressStats.getWeeklyRecap` | weekly aggregates | `weeklyRecap` job → `weeklyRecaps` collection |

The client keeps pure presentation logic: `formatClock`, `getDayStatus`
(heatmap colouring), Spark overlay mood mapping, and the toast queue UI.

---

## 2. Domain model in one paragraph

A **Space** is a time-boxed shared room. It can be scheduled, then goes
live, then ends. It has a niche (`categoryId`), a host, a visibility
setting, invitees, and a target duration. A **Session** is one user's
continuous clock-in. Every minute of productive time is a `sessions` doc. A
space join opens one, and a solo start opens one with `spaceId: null`
(CLAUDE.md §4). Everything gamified (XP, streak, freezes, badges, levels,
together streaks, analytics rollups, recap) is computed **when a session
closes**, inside one transaction. Social features (friendships, blocks,
reactions, invites, alerts, reminders) sit around that loop. **Notifications**
are server-created and go through one pipeline that both the in-app toast
and Phase 4 push obey.

---

## 3. Where the client disagrees with locked rules (resolved here)

| # | Conflict | Resolution in v2 | Frontend follow-up |
|---|---|---|---|
| C1 | **XP formula.** `useUserStore` awards `2 XP/min + 50` on target hit (~170 XP/hr). CLAUDE.md §4 locks `floor(durationMin/60*50)`, with no bonus. | Server implements the **locked** formula. | Change `recordSessionResult` to the locked formula, or delete it once the close result comes from the API. Note that this slows level-ups about 3× under the provisional 250 XP/level curve (see open decision D3). |
| C2 | **Streak granularity.** The client adds +1 per streak-eligible *session*, so three sessions in a day give +3. The locked rule is one evaluation per *day* on the daily total (≥100% gives full credit, ≥50% still counts). | Server evaluates per local day from `userDailyTotal`, and credits the day at most once (`streak.lastActiveDate === today` → no-op). | Post-Session should show `dayCredited` / `streakAfter` from the close result instead of re-deriving them. |
| C3 | **Space lifecycle.** The DB doc models a *persistent* room (`active`/`archived`, `memberIds` roster, `staleSpaceCleanup`). The built UI (CLAUDE.md §4, Spaces social layer) treats a space as an *occurrence*: `scheduled → active → completed/cancelled`, with a `durationTargetMin`, a "recently ended" list, and "Start one like this". | v2 follows the **built UI**: a space is an occurrence (§6). `memberIds` is dropped; invitees plus open sessions cover it. Recurring rooms, if ever wanted, become a `spaceTemplates` layer later (the old `sessionTemplates` idea). DB doc updated to match. | None. The UI already behaves this way. **Confirm this, because it revises a 2026-09-25 decision** (open decision D1). |
| C4 | **Reaction target.** The DB doc keys reactions by `sessionId` (a ledger doc). The client keys them by *space id* (cards, room) and by a synthetic `milestone_<user>_<n>` (Send 🔥 on a friend's milestone). | Reactions get a polymorphic context: `{contextType: 'space' \| 'milestone', contextId}`. The unique index becomes `{contextType, contextId, fromUserId, toUserId, type}`, which keeps toggle semantics. | Rename `Reaction.sessionId` → `contextType`/`contextId` during the Spaces rename pass. |
| C5 | **Scheduled-space go-live asymmetry.** In the mock, friends' scheduled spaces auto-start with the host as first participant, while your own space waits for "Start now". That asymmetry only exists because the mock simulates the friend. | Server rule is the same for everyone: **a scheduled space goes live only when its host starts it.** `own_space_due` notifies the host at `startTime`. If nobody starts it within 30 min, it becomes `cancelled` (expired) and anyone with a reminder gets a quiet inbox note. This keeps the "no time clocked before they're there" rule true for every host. | `runSpaceTriggers` auto-start is removed along with the triggers. |
| C6 | **Client-declared `targetHit`.** Session Room calls `finish(targetHit)` from the button pressed. | Server derives `targetHit = durationMin >= targetDurationMin` from server timestamps. The client can't claim it. | Send the leave call without `targetHit`. |
| C7 | **Friendship pair ordering.** `friendship_meera` stores the pair reversed (already flagged in the DB doc). | Server canonicalizes `userIdA < userIdB` on write. The client never relies on A/B order: it uses `getOtherUserId` already, and the API returns `otherUser`. | None. |
| C8 | **Non-XP badges.** Mock badges use `streak`, `early_sessions`, `late_sessions`, `sessions_completed`, `friend_count`, `total_xp`. The DB doc only specifies the XP tiers. | Badge engine generalized to per-criteria evaluators over counters (§7.5). | None. |

---

## 4. Topology and repo layout

**Modular monolith**, as in v1. One Node/Express + Socket.IO process type,
scaled horizontally, plus a separate **worker** process type that runs the
same codebase with `ROLE=worker` and consumes BullMQ queues. Splitting
workers out is the only service boundary worth having on day one: job
spikes (Sunday recaps, day rollovers at midnight in a big timezone) then
don't steal event-loop time from live socket traffic.

```
                 ┌───────────── Expo app (iOS / Android / web) ─────────────┐
                 │  Firebase Auth SDK      REST (fetch)      Socket.IO client │
                 └──────┬───────────────────────┬──────────────────┬─────────┘
                        │ ID token              │ HTTPS            │ WSS
                        ▼                       ▼                  ▼
                 Firebase Auth          ┌──────────── Load balancer (sticky not required) ───────────┐
                                        │                                                            │
                                ┌───────▼────────┐   ┌────────────────┐        ┌──────────────────┐ │
                                │ api (N pods)   │…  │ api (N pods)   │        │ worker (M pods)  │ │
                                │ Express + IO   │   │ Express + IO   │        │ BullMQ consumers │ │
                                └───┬───────┬────┘   └───┬───────┬────┘        └───┬──────────┬───┘ │
                                    │       └──────┬─────┘       │                 │          │     │
                                    ▼              ▼             ▼                 ▼          ▼     │
                              MongoDB Atlas   Redis (presence, IO adapter,   FCM (Phase 4)  Sentry  │
                              (replica set)    rate limits, BullMQ, caches)                          │
```

### Monorepo layout

```
prodify/
  App.tsx, src/…                 existing Expo app (unchanged location)
  packages/
    shared/                      imported by BOTH app and server — no runtime deps
      types/                     API DTOs (evolved from src/types/models.ts + social.ts)
      rules/                     pure functions: xp.ts, levels.ts, streak.ts, togetherStreak.ts,
                                 quietHours.ts, dayKey.ts (tz-aware), spaceAccess.ts
      copy/                      notificationCopy.ts, mascotQuotes.ts, spaceQuotes.ts (moved from src/mocks/)
  server/
    src/
      config/                    env (zod-validated at boot), mongo, redis, firebase-admin
      middleware/                auth, requestId, rateLimit, validate, errorHandler
      modules/                   one folder per domain: routes + controller + service + repo + schemas
        auth/  users/  categories/  spaces/  sessions/  progress/  friendships/  blocks/
        reactions/  notifications/  mascot/  analytics/  moderation/  seeding/
      events/                    in-process domain event bus (§5.3)
      sockets/                   io.ts (redis adapter), auth.ts, presence.ts, spaceRoom.ts, userChannel.ts
      jobs/                      queue defs + processors (§10)
      lib/                       pagination, transactions, clock (injectable for tests), ids
      app.ts  server.ts  worker.ts
    tests/
```

**Why `packages/shared`:** CLAUDE.md §8 wants copy to live in one place for
client and server, and C1/C2 show what happens when the client and server
compute a rule separately. Expo's Metro supports npm workspaces, so the
app imports `@prodify/shared` with no build step. Server-only logic (DB
writes, transactions) never goes in `shared`. Only pure, deterministic
functions and types do.

---

## 5. Cross-cutting design

### 5.1 Request lifecycle (unchanged from v1)

`helmet` → strict CORS allowlist → `express.json({limit:'100kb'})` →
request-id + `pino` → Redis rate limiter → **auth** → `validate(zod)` →
controller → service → central error handler. One error envelope for every
endpoint: `{ error: { code, message, details? } }`.

### 5.2 Auth

- Firebase Auth (Google) on the client. Each request carries
  `Authorization: Bearer <Firebase ID token>`.
- Middleware: `verifyIdToken` (cached in Redis by token hash until `exp`,
  which saves a crypto verify on every request), then load the user by
  `firebaseUid`, reject `status ∈ {suspended, banned, deleted}` with 403,
  and attach `req.user = {userId, role, timezone}`.
- `POST /v1/auth/session` upserts the user on first sign-in. It also seeds
  defaults (`dailyTargetMin: 30`, `timezone` from the device, notification
  prefs) and records an `authSessions` row (device, platform) for "log out
  everywhere". Revocation uses Firebase `revokeRefreshTokens` plus a
  `tokensValidAfter` check.
- Sockets authenticate with the same ID token in `handshake.auth.token`,
  verified once per connection. The client reconnects with a fresh token
  when it refreshes.
- Handle (`@username`) is chosen in onboarding after first sign-in. It is
  required before sending friend requests, so search/suggestions can show
  something stable.

### 5.3 Domain events (in-process)

Modules don't call each other's notification and mascot logic directly.
They emit typed domain events after their transaction commits, and
subscribers react:

```
session.closed      { session, closeResult }          → notifications, mascot, analytics cache bust, socket
space.created       { space, inviteeIds }              → invites → notifications; reminders/due jobs scheduled
space.started       { space }                          → friend_started_space fan-out, socket feed update
space.ended         { space }
space.member_joined { space, userId }                  → space_joined (to host + inviter), presence broadcast
friendship.requested / accepted / removed
reaction.toggled    { reaction, on: boolean }          → reactions_received (grouped), socket
progress.badge_earned / level_up / freeze_earned / freeze_used / streak_milestone
```

The bus is a plain `EventEmitter` wrapper. Each handler that can fail
(notification write, push) enqueues a BullMQ job instead of doing the work
inline, so a failing subscriber never fails the user's request and gets
retries. If outbox-grade guarantees ever matter, swap in a Mongo outbox
collection. The interface stays the same.

### 5.4 Time and "today"

Every per-day rule (streak, daily totals, together streaks, recap week,
nudge slots, quiet hours, toast cap) uses the **user's local day** from
`users.timezone` (IANA). `packages/shared/rules/dayKey.ts` exports
`dayKey(instant, tz) → "YYYY-MM-DD"`, and server and client both use it.

- A session that crosses midnight is credited to the local day it **ends**
  on. This keeps the close transaction single-day. A 23:30–00:30 session
  credits 60 min to the next day, which is acceptable and simpler than
  splitting.
- Timezone changes (travel) are applied on the next `/auth/session` or
  `PATCH /me`. They take effect from the next day key, so no day is
  evaluated twice.

### 5.5 API conventions

- Base path `/v1`. JSON. IDs are strings. Timestamps are ISO-8601 UTC.
  Day keys are `YYYY-MM-DD`.
- Lists use `{ items, nextCursor }` cursor pagination (opaque base64 of
  the sort key + `_id`). No `skip`.
- DTOs keep the Phase 1 field names wherever possible (`_id`,
  `durationTargetMin`, `participantCount`, `status: 'scheduled' | 'active'
  | 'completed' | 'cancelled'`…), so each `services/*.ts` swap stays a
  drop-in (CLAUDE.md §2).
- Responses that a viewer sees differently carry a `viewer` block
  (`viewer.isIn`, `viewer.canInvite`, `viewer.reminderOn`…) instead of
  making the client re-derive permissions.
- Idempotency: create/join/leave/react accept an `Idempotency-Key` header,
  stored in Redis for 24h. This matters on flaky mobile networks, where a
  retried "leave" must not close two sessions.

---

## 6. Spaces

### 6.1 State machine

```
              create(startTime in future)
   ┌──────────────────────────────────────────┐
   │                                          ▼
create(now) ─────────────▶ active ◀──start── scheduled ──(startTime+30m, not started)──▶ cancelled
                             │                   │
                             │                   └──host cancels──▶ cancelled
                             ▼
        last open session closes + 5 min with nobody back
                             │
                             ▼
                         completed   (shown in friends' "recently ended" for 24h)
```

- **Create now:** space `active`, `startTime = now`. The host's session
  opens in the same transaction.
- **Create scheduled:** space `scheduled` with no participants. The server
  schedules delayed jobs: `space.reminder` at `startTime − 5 min` (for
  users who toggled "remind me") and `space.due` at `startTime` (to the
  host). Rescheduling or cancelling removes them by deterministic job id
  (`reminder:{spaceId}`, `due:{spaceId}`).
- **Start (`POST /spaces/:id/start`, host only):** `scheduled → active`,
  `startTime = now`, host session opens, `space.started` fires.
- **End:** a space doesn't have an explicit "end for everyone" in the UI.
  It completes when it has been empty for 5 minutes (a `space.emptyCheck`
  delayed job, re-armed on each leave and cancelled by any join). There's
  also a hard ceiling: `startTime + durationTargetMin + 3h` closes any
  stragglers through the session sweep.
- **Target duration** is the space's shared goal. Each member's session
  copies it as `targetDurationMin`, so `targetHit` is per person.

### 6.2 Visibility and access (`packages/shared/rules/spaceAccess.ts`)

| | Public 🌍 | Friends-only 🔒 |
|---|---|---|
| Appears in "Open to everyone" | yes (if no block with host) | **never** |
| Appears in friends' section | to host's accepted friends | to host's accepted friends + invitees |
| Can join | anyone not blocked by host/present members | host's accepted friends + invitees |
| Can invite from room | **any participant** (their own friends) | **host only** |
| Shows `invitedUserIds` | host + invitees | host + invitees |

Every check runs on the server. The client's `canInvite` comes from
`viewer.canInvite`. A block in either direction between the viewer and the
host hides the space completely. A block between the viewer and a present
member makes join return `403 BLOCKED_MEMBER_PRESENT`, and the client hides
the card on the next feed refresh.

`maxParticipants` is enforced atomically: the join's `findOneAndUpdate`
runs on `{_id, status:'active', liveCount: {$lt: max}}` with
`$inc: {liveCount: 1}`.

### 6.3 Invites

Invites are notifications (DB doc §2): there is no `spaceInvites`
collection. `space.invitedUserIds[]` is the source of truth for "who was
asked" and caps at 50 to stay bounded. An invite is:

- `$addToSet` on `space.invitedUserIds` (create, or in-room `POST /spaces/:id/invites`)
- a `space_invite` notification per invitee (priority `high`, groupKey
  `invite_{spaceId}`)

"Accept" means joining (`POST /spaces/:id/join` marks the invite
notification acted on). "Decline" is `POST /spaces/:id/invites/decline`,
which sets the notification's `actedAt`/`actionTaken` and adds the user to
`space.declinedUserIds` so the host's "invited, not here" list can drop
them. The client's `SpaceInvite` read model is built from
`GET /v1/spaces/feed`'s `invites` section:
`{_id: notificationId, spaceId, fromUserId, toUserId, status, createdAt}`.

### 6.4 Feed endpoint (the Spaces tab in one call)

`GET /v1/spaces/feed` returns:

```ts
{
  invites:       SpaceInviteDTO[],           // pending, into still-active spaces
  friendsLive:   SpaceDTO[],                 // active, host ∈ friends, sorted friends-present desc
  scheduled:     SpaceDTO[],                 // friends' + own, startTime asc, next 7 days
  recentlyEnded: SpaceDTO[],                 // friends' completed in last 24h (max 10)
  publicLive:    { items: SpaceDTO[], nextCursor }  // first page of "open to everyone"
  togetherStreaks: Record<friendId, TogetherStreakDTO>  // live values only, for card badges
}
```

`SpaceDTO` keeps the Phase 1 `Session` shape. `participants` is a
**preview** (up to 8: friends first, then most recent), and
`participantCount` is the real live count, matching the comment already in
`models.ts`. Bot-seeded rooms (§10.2) are blended into `publicLive` with
`isBotSeeded: true`.

Implementation: four indexed queries in parallel plus one presence
`MGET`. The friend-id set is cached in Redis per user (`friends:{userId}`,
invalidated on friendship change). Feed results are **not** cached, since
presence is live. The socket keeps the screen fresh after load (§9.3).

---

## 7. Sessions and the progress engine

### 7.1 Opening

| Path | Endpoint | Notes |
|---|---|---|
| Solo | `POST /v1/sessions` `{categoryId, targetDurationMin}` | the still-missing solo flow (CLAUDE.md §4). Same ledger doc, `spaceId: null` |
| Space join | `POST /v1/spaces/:id/join` | opens the session in the join transaction |
| Space create-now / start | `POST /v1/spaces`, `POST /v1/spaces/:id/start` | opens the host's session |

**One open session per user** is enforced by a partial unique index
(`{userId:1}` where `status:'active'`). Joining a second space while in one
returns `409 ALREADY_IN_SESSION` with the open session's `spaceId`, and the
client offers "leave and join". Redis mirrors it as
`user:{id}:activeSession` for fast focus-mode checks (§8.2).

### 7.2 Clocked-time integrity

A focus app is often used with the phone locked, and React Native suspends
sockets in the background. So **time credit must not depend on a
continuous heartbeat**. Presence and credit are two separate things:

- **Credit** = `endTime − startTime`, both server timestamps, capped at
  `max(targetDurationMin × 1.5, targetDurationMin + 60)` and at an absolute
  6h. The client can't send durations.
- **Presence** (who's shown in the room) comes from the socket heartbeat
  (§9.2). A member whose socket drops stays listed with a dimmed "away"
  pulse while their session is open, and is never shown as having left
  until the session closes.
- **Abandoned sessions:** the `sessionSweep` job closes sessions past their
  cap with `closedReason: 'timeout'` and credits up to the cap. A user who
  locks the phone for a 60-minute study block and comes back to tap Finish
  gets the full 60.
- This is honor-system-plus-caps. It's the right trade for MVP. Stricter
  proof-of-presence (periodic background check-ins, screen-on checks) can be
  added later behind the same close path without schema changes.

### 7.3 Closing — the one transaction

Triggered by `POST /v1/spaces/:id/leave`, `POST /v1/sessions/:id/complete`
(solo), the sweep, or the presence-grace timer. Steps, in one Mongo
transaction (retry on `TransientTransactionError`):

1. Load the open session with `findOneAndUpdate` (`status:'active' → 'closing'`).
   This guard makes double-close idempotent.
2. `durationMin = capped(server_now − startTime)`, `targetHit`,
   `xpEarned = floor(durationMin/60*50)` (C1).
3. Write the session (`completed`, `endTime`, `closedReason`).
4. `pointsLedger` append (`source:'session_complete'`, `sessionId`).
5. `$inc` `users.points`, `users.counters.sessionsCompleted`, plus
   `earlySessions` / `lateSessions` if the session started before 09:00 or
   after 22:00 local.
6. Upsert `$inc` `dailyStats{userId, categoryId, day}` and `userDailyTotal{userId, day}`.
7. **Streak** (C2): read today's `userDailyTotal`. If
   `totalMinutes ≥ ceil(dailyTargetMin × 0.5)` and
   `streak.lastActiveDate !== today`, then credit the day: `current+1` (or
   reset to 1 if the previous credited day isn't yesterday — freezes were
   already applied by `dayRollover`), `longest = max`, `lastActiveDate = today`.
   On `current % 7 === 0`, `freezesAvailable = min(3, +1)` (CLAUDE.md §4,
   values from the Phase 1 implementation).
8. **Together streaks** (§7.4).
9. **Level:** `levelAfter = levelFor(points)` from shared rules. If it went
   up, update `users.level` and `users.mascotStage = stageFor(level)`.
10. **Badges** (§7.5): evaluate only the criteria whose counters changed in
    this transaction.
11. If this was the last open session in the space, arm `space.emptyCheck`.

After commit: emit `session.closed`, then compute and return the
**SessionCloseResult**, which is exactly what Post-Session needs:

```ts
interface SessionCloseResult {
  session: { _id; spaceId; categoryId; durationMin; targetDurationMin; targetHit; xpEarned; closedReason };
  day:     { dayKey; totalMinutes; dailyTargetMin; credited: boolean; creditedNow: boolean };
  streak:  { before: number; after: number; freezesAvailable: number; freezeEarned: boolean };
  xp:      { before: number; after: number; levelBefore: number; levelAfter: number };
  badgesEarned: BadgeDTO[];
  togetherStreaks: { userId; displayName; days: number; grew: boolean }[];
  heldNotifications: AppNotificationDTO[];   // "While you focused" (§8.2)
}
```

The `RootStackParamList.PostSession` params become `{ result: SessionCloseResult }`.
The client stops computing rewards. Spark's overlay keys
(`session_complete` / `missed_target` / `streak_milestone` /
`xp_milestone`) are derived from this payload on the client, the same way
Home's arrival logic is.

### 7.4 Together streaks

A per-pair doc `togetherStreaks{pairKey: "a_b" (sorted), current, longest, lastTogetherDay}`.

On close, if **the closer's day is credited** (same bar as the main
streak, per CLAUDE.md §4):

- Find accepted friends whose session in the **same space** overlapped this
  one by at least 10 minutes (one indexed query on `sessions{spaceId,
  startTime}` over the session window). The 10-minute minimum stops a
  drive-by join from counting.
- For each one, apply `advanceTogetherStreak` from shared rules, keyed by
  the closer's `dayKey`. It's idempotent per day, so when the friend closes
  later it's a no-op.

When the two users' local dates differ (they're in different timezones),
the closer's date wins. Being off by one in that edge case is acceptable.

`together_streak_risk` (§8.3) reads these docs to nudge: "you and Riya are
on 4 days, and she's live now".

### 7.5 Badges

`badges` stays a config-driven catalog (CLAUDE.md §5). Each `criteriaType`
maps to an evaluator that reads a counter that is already loaded:

| criteriaType | Counter | Evaluated when |
|---|---|---|
| `total_xp` | `users.points` | session close |
| `streak` | `users.streak.current` | session close (day credited) |
| `sessions_completed` | `users.counters.sessionsCompleted` | session close |
| `early_sessions` / `late_sessions` | `users.counters.earlySessions/lateSessions` | session close |
| `friend_count` | `users.counters.friends` | friendship accepted |

The rule is threshold-crossing only (`before < value ≤ after` and not
already held), so badges are never re-evaluated in bulk. Awarding a badge
pushes to `users.badgeIds`, appends to `pointsLedger`
(`source:'badge', amount:0`, for the Wrapped timeline) and emits
`progress.badge_earned`. A new criteria type means a new evaluator plus a
catalog row. Adding a badge with an existing criteria type needs no deploy.

---

## 8. Notifications

### 8.1 Server pipeline (port of `deliver.ts`)

Every notification goes through `notifications.deliver(draft)`, the server
twin of the Phase 1 function. The ordering is identical, so the behaviour
the user already validated in Phase 1 carries over:

1. **Dedupe:** `draft.eventId` is deterministic (`risk_{day}`, `badge_{id}`,
   `started_{spaceId}`…, the same ids the Phase 1 triggers use). Insert
   into `notifications` with a unique index `{userId, eventId}`. A
   duplicate-key error returns `duplicate`.
2. **Category mute:** `users.notificationPrefs.categories[category] === false`
   → `muted` (not stored).
3. **Group merge:** look for an unread notification with the same
   `{userId, groupKey}` whose `sentAt` is within 20 minutes. If there is
   one, `$addToSet payload.fromUserIds`, re-render the grouped copy
   (`GROUPED_COPY`), and bump `sentAt`. The id is kept, the event id is
   still recorded (`absorbedEventIds`) so dedupe holds.
4. **Inbox:** the stored doc carries the full `AppNotification` shape:
   rendered `title`/`body` (from shared copy + vars at write time),
   `copyVariantId`, `copyVars` (for re-render/localisation later),
   `sender`, `tone`, `priority`, `actions`, `payload`.
5. **Delivery mode** (stored as `delivery`, sent with the socket event):
   - user has an open session → `held` (focus mode — nothing interrupts a
     session, **any** priority)
   - `priority === 'normal'` and (inside quiet hours **or** today's toast
     count ≥ `dailyToastCap`) → `inbox`
   - otherwise → `toast`, which increments `toasts:{userId}:{dayKey}` in
     Redis (TTL 48h)
6. **Fan-out:** emit `notification:new {notification, delivery}` to the
   `user:{id}` socket room. Phase 4: if `delivery === 'toast'` and the user
   has no connected socket, enqueue an FCM push.

Copy rules (never shame, gold only for `reward`, amber for `nudge`) are
enforced by the shared copy library and the `tone` table. The server does
not invent copy.

### 8.2 Focus mode and "While you focused"

Redis `user:{id}:activeSession` is set on session open and cleared on
close. `deliver` checks it in step 5. Held notifications are stored with
`delivery:'held'` and `heldForSessionId`. The close transaction's
post-commit step returns them as `heldNotifications` (§7.3) and flips them
to `inbox`. Rewards produced *by* the close (badge, level-up, freeze) are
emitted after the session is closed, so they toast immediately. That
matches the Phase 1 ordering where `finish()` exits focus mode before
recording results.

### 8.3 Trigger catalogue (Phase 1 trigger → Phase 2 source)

| Type | Phase 2 source | eventId | Priority |
|---|---|---|---|
| `space_invite` | `space.created` / in-room invite | `invite_{spaceId}_{toUserId}` | high |
| `friend_started_space` | `space.started`. Fan-out to users with the host in `friendAlertIds`, or with a reminder on this space | `started_{spaceId}` (groupKey `friend_started`) | high if reminder, else normal |
| `space_reminder` | delayed job at `startTime − 5m`, for `spaceReminders` rows | `reminder_{spaceId}` | high |
| `own_space_due` | delayed job at `startTime` | `due_{spaceId}` | high |
| `space_joined` | `space.member_joined`, to host (and to the inviter if they're not the host) | `joined_{spaceId}_{userId}` (groupKey `joined_{spaceId}`) | normal |
| `friend_request` | `friendship.requested` | `request_{friendshipId}` | normal |
| `friend_accepted` | `friendship.accepted`, to requester | `accepted_{friendshipId}` | normal |
| `friend_milestone` | `progress.streak_milestone` (7,14,21,30,50,75,100,150,200,365), fan-out to accepted friends | `milestone_{userId}_{n}_{dayKey}` (the day key keeps a re-hit after a reset from deduping away; it also serves as the 🔥 reaction contextId) | normal |
| `reactions_received` | `reaction.toggled` (on), to `toUserId` | `react_{contextId}_{fromUserId}_{type}` (groupKey `reactions_{contextId}_{dayKey}`) | normal |
| `together_streak_risk` | `nudgeTick` (§10): strongest live together streak with a friend who is live now and not yet shared today | `together_{dayKey}` | normal |
| `streak_at_risk` | `nudgeTick` at ≥19:00 local: streak>0, today < 50% of target, no open session | `risk_{dayKey}` | normal (tone `nudge`) |
| `goal_close` | `nudgeTick` at ≥17:00: 0 < remaining ≤ 20 min | `goalclose_{dayKey}` | normal |
| `streak_freeze_used` | `dayRollover` spent a freeze | `freezeused_{n}` | high |
| `streak_freeze_earned` / `badge_earned` / `level_up` | progress events after close | `freezeearned_{dayKey}` / `badge_{id}` / `level_{n}` | high (tone `reward`) |
| `weekly_recap` | `weeklyRecap` job, Sun ≥18:00 local, plus a Mon <12:00 catch-up for anyone without one | `recap_{sundayKey}` | normal |
| `welcome_back` | socket connect / `POST /auth/session` with `lastActiveAt ≥ 3 days` ago | `welcome_{dayKey}` | normal |
| `join_nudge` | `nudgeTick` in slots (08–11, 13–16, 18–21, 22–24): user **online and idle** (connected, no open session, connected ≥90s, no toast in the last 3 min) | `nudge_{dayKey}_{slot}` | normal |

`join_nudge` and `together_streak_risk` are **in-app only** while the user
is online. They are never pushed, because a push nudge at 23:00 is spam
whatever the copy says. Phase 4 can revisit this with real data.

Bot-seeded rooms never produce `space_joined`, reactions, or friend events
(CLAUDE.md §4). The seeding module simply emits no domain events.

### 8.4 What the client keeps

- `useNotificationStore` stays as the inbox cache plus toast queue. It is
  fed by `GET /notifications` on launch and `notification:new` afterwards.
  `delivery` decides whether the toast queue gets it.
- `deliver()`, `triggers/*`, `NotificationRunner`'s timer and
  `notificationSimulations.ts` are deleted. The dev Preview panel calls
  `POST /v1/dev/notifications/preview` (non-prod only), which runs the real
  pipeline with `force`.
- Actions map to normal endpoints (`accept_friend` → `POST
  /friendships/:id/accept`, `remind_space` → `PUT /me/space-reminders/:spaceId`,
  `send_fire` → `PUT /reactions`, …). Afterwards the client calls
  `PATCH /notifications/:id {actionTaken}` so the inbox row shows the
  rewritten "Reminder set ✓" state on every device.
- **Snooze:** `POST /notifications/:id/snooze {minutes}` marks the
  notification opened and enqueues a delayed `notification.redeliver` job,
  which re-runs `deliver` with priority `high` and a fresh eventId
  (`{orig}_snz_{ts}`). This is the same semantics as `redeliverSnoozed`.

### 8.5 Preferences

Stored on the user (bounded and read with the user on every delivery):

```ts
notificationPrefs: {
  categories: { spaces: true, friends: true, progress: true, nudges: true },
  quietHours: { enabled: true, startHour: 22, endHour: 8 },   // local
  dailyToastCap: 6,                                           // 0 = unlimited
  friendAlertIds: ObjectId[],                                 // "tell me when X starts a space"
}
```

Per-space reminders are a separate small collection
(`spaceReminders{userId, spaceId, remindAt}`), because the reminder job
needs to query by `spaceId`, and they expire with the space (TTL on
`remindAt + 1d`). The `friend_started_space` fan-out queries
`users{'notificationPrefs.friendAlertIds': hostId}` through a multikey
index, intersected with the host's accepted friends.

---

## 9. Realtime (Socket.IO)

### 9.1 Topology

- One namespace (`/`). Socket auth as in §5.2. `@socket.io/redis-adapter`
  from day one.
- Rooms: `user:{userId}` (every socket of that user, for notifications,
  progress, friendship events), `space:{spaceId}` (joined on `space:enter`
  after a successful REST join), `friends-of:{userId}` (see §9.3).
- **REST is the write path, sockets are the push path.** Joining, leaving,
  reacting and inviting all go through REST (validation, idempotency,
  transactions). The socket only announces results. The one socket-only
  write is the presence heartbeat.

### 9.2 Presence

| Key | Value | TTL / refresh |
|---|---|---|
| `online:{userId}` | socket count | 60s, refreshed by `presence:heartbeat` every 20s |
| `space:{spaceId}:members` | hash `userId → joinedAt` (open sessions) | written on join/leave; source for `participantCount` |
| `space:{spaceId}:connected` | set of userIds with a live socket in the room | heartbeat-driven; "away" = in `members` but not here |
| `user:{userId}:activeSession` | `{sessionId, spaceId}` | set on open, deleted on close |

- `isOnline` on friend DTOs = `EXISTS online:{id}`. It is only exposed to
  accepted friends.
- Socket disconnect with no reconnect within 2 min: the member is marked
  away (`presence:update`), but **the session is not closed**. Closing is
  §7.2's job. This replaces v1's "no heartbeat for 45s closes the session",
  which would have cut off locked-phone users.
- Group focused minutes in the room (`getGroupFocusedMinutes`) is computed
  on the client from the `members` hash timestamps it receives, so the
  server does no per-second writes (DB doc §7).

### 9.3 Event catalogue (server → client)

| Event | Room | Payload | Client effect |
|---|---|---|---|
| `notification:new` | `user:` | `{notification, delivery}` | inbox upsert; toast if `delivery==='toast'` |
| `notification:updated` | `user:` | `{id, patch}` | multi-device read/action sync |
| `progress:updated` | `user:` | `{points, level, streak, badgeIds}` | patch `useUserStore.user` |
| `friendship:changed` | `user:` | `{friendship, otherUser}` | `useFriendsStore` upsert/remove |
| `presence:update` | `space:` | `{members: [{userId, joinedAt, away}], participantCount}` | room participants |
| `space:updated` | `space:` + `friends-of:{host}` | `SpaceDTO` (status/count changes) | Spaces/Home cards |
| `reaction:changed` | `space:` | `{toUserId, type, counts}` | room ReactionBar counts |
| `presence:friends` | `user:` | `{userId, online, spaceId?}` (debounced 5s) | Home "friends focusing", Friends online dots |

`friends-of:{hostId}`: every socket joins the `friends-of` room of each of
its accepted friends on connect (≤ a few hundred rooms per socket, which
is cheap with the Redis adapter). That makes friend-space and presence
fan-out a single `io.to('friends-of:'+id).emit(...)` instead of an
N-friends lookup per event. Membership is refreshed on `friendship:changed`.

### 9.4 Client → server

`presence:heartbeat`, `space:enter {spaceId}` (server re-checks that the
user has an open session there), `space:exit`. Nothing else.

---

## 10. Background jobs (BullMQ, worker process)

| Queue / job | Schedule | Does |
|---|---|---|
| `space.reminder` | delayed, `startTime − 5m` | `space_reminder` to `spaceReminders` rows |
| `space.due` | delayed, `startTime` | `own_space_due` to host |
| `space.expire` | delayed, `startTime + 30m` | `scheduled → cancelled` if not started |
| `space.emptyCheck` | delayed, last-leave + 5m | `active → completed` if still empty |
| `sessionSweep` | every 2 min | closes sessions past their cap (§7.2) through the normal close path |
| `dayRollover` | every 15 min. Processes users whose local midnight passed since the last run (bucketed by tz offset, index `{timezone}`) | for yesterday: credited? if not and exactly one day missed and a freeze is available, spend it (`streak_freeze_used`). Otherwise, if yesterday was not credited or frozen, `streak.current` resets to 0, so stored streaks are always live values. Same rule as `applyStreakFreeze` |
| `nudgeTick` | every 5 min. Users **currently online** only (from `online:*`), so it's cheap | `streak_at_risk`, `goal_close`, `together_streak_risk`, `join_nudge` evaluation (§8.3) |
| `weeklyRecap` | hourly. Users whose local time just passed Sun 18:00 | build `weeklyRecaps` doc, then `weekly_recap` notification |
| `notification.redeliver` | delayed (snooze) | §8.4 |
| `notification.push` (Phase 4) | on demand | FCM send, token cleanup on `unregistered` |
| `rollupReconciliation` | nightly | sample-check `dailyStats`/`userDailyTotal` against raw `sessions`. **Alerts, never auto-corrects** (v1 rationale holds) |
| `favoriteCategory` | nightly | top category by last-30-day `dailyStats`, written to `users.favoriteCategoryId` (Friend cards' icon) |
| `seeding.refresh` (Phase 4) | every 5 min | §10.2 |

All delayed jobs use deterministic `jobId`s, so re-scheduling replaces the
job instead of duplicating it, and cancellation is `queue.remove(jobId)`.
Every processor is idempotent, because notifications dedupe on eventId and
state transitions are conditional updates.

### 10.1 Mascot

- `mascotEvents` is the queue (CLAUDE.md §5). Producers are progress events
  (`badge_earned`, `level_up`), `streak_at_risk` (from `nudgeTick`,
  alongside the notification), `friend_achievement` (friend milestones),
  and `welcome_back`.
- `GET /v1/mascot/next` picks the highest-priority undelivered event by the
  locked order, resolves a quote from `packages/shared/copy/mascotQuotes`,
  and returns the existing `MascotMessage` shape. `POST
  /mascot/events/:id/delivered` acknowledges it.
- Moment-of-action Spark overlays (`session_complete`, `missed_target`,
  `friends_live`, `first_visit`, the personality tiers) stay client-side.
  They are reactions to data the client already has (the close result,
  `/me/summary`), and turning them into server round-trips would add
  latency to the most important animation moments for no gain in
  consistency.

### 10.2 Bot seeding (Phase 4 — designed now, not built)

- A `seeding` module keeps a small set of `spaces` with `isBotSeeded:true`,
  `hostId:null`, one per category per active timeslot, and **synthetic
  counts only** (`liveCount` set by the job). It never creates `sessions`,
  reactions, friendships, notifications, or named personas (CLAUDE.md §4).
- Phase-out: per `{categoryId, hourOfWeek}`, when the real concurrent count
  over the trailing 2 weeks exceeds a threshold (config), that slot stops
  seeding.
- Real users can join a seeded room. Their session is real, and the room's
  displayed count = synthetic + real.

---

## 11. REST API — full map

All endpoints are under `/v1`, authenticated unless marked.

**Auth & me**

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/session` | verify token, upsert user, device row → `{user, isNew}` |
| POST | `/auth/logout-all` | revoke refresh tokens, close `authSessions` |
| GET | `/me` | `User` DTO (Phase 1 `User` + `handle`, `tagline`, `level`, `dailyTargetMin`, `timezone`) |
| PATCH | `/me` | displayName, handle, tagline, avatar, dailyTargetMin, timezone, socialHandles (opt-in) |
| GET | `/me/summary` | Home: `{todayMinutes, dailyTargetMin, xpToday, sessionsCompletedTotal, openSession?, focusingFriends[]}` |
| GET | `/me/activity?from&to` | heatmap: `[{date, totalMinutes}]` from `userDailyTotal` (≤ 366 days) |
| GET | `/me/stats?range=week\|month&categoryId?` | Progress: per-day series + per-category split from rollups |
| GET | `/me/recaps/:weekStart` · `/me/recaps/latest` | Weekly Recap DTO (Phase 1 `WeeklyRecap` shape) |
| GET/PATCH | `/me/notification-settings` | categories, quietHours, dailyToastCap |
| PUT/DELETE | `/me/friend-alerts/:userId` | bell on/off (must be an accepted friend) |
| PUT/DELETE | `/me/space-reminders/:spaceId` | "remind me" on/off (scheduled, visible spaces only) |
| DELETE | `/me` | account deletion (soft-delete, 30-day purge job) |
| POST | `/me/devices` (Phase 4) | FCM token register |

**Catalogue**

| Method | Path | Purpose |
|---|---|---|
| GET | `/categories` | the 8 fixed themes (cacheable, `ETag`) |
| GET | `/badges` | catalogue (`viewer.earned` flags when authed) |

**Spaces & sessions**

| Method | Path | Purpose |
|---|---|---|
| GET | `/spaces/feed` | §6.4 |
| GET | `/spaces?scope=public&categoryId&cursor` | browse paging |
| POST | `/spaces` | `{name, categoryId, durationTargetMin, description?, isPublic, invitedUserIds?, startTime?}` → `{space, session?}` |
| GET | `/spaces/:id` | `SpaceDTO` + `viewer` + full present member list (for the room) |
| PATCH | `/spaces/:id` | host: name/description/visibility/startTime (scheduled only) |
| POST | `/spaces/:id/start` | host, scheduled → active |
| POST | `/spaces/:id/cancel` | host, scheduled → cancelled |
| POST | `/spaces/:id/join` | → `{space, session}` |
| POST | `/spaces/:id/leave` | → `SessionCloseResult` |
| POST | `/spaces/:id/invites` | `{userIds}` (access rule §6.2) |
| POST | `/spaces/:id/invites/decline` | invitee declines |
| POST | `/sessions` | solo start |
| POST | `/sessions/:id/complete` | solo close → `SessionCloseResult` |
| GET | `/sessions/open` | resume after app restart |
| GET | `/sessions?from&to&cursor` | personal history |

**Social**

| Method | Path | Purpose |
|---|---|---|
| GET | `/friends` | accepted: `[{friendshipId, since, user: FriendProfileDTO, togetherStreak, alertOn, liveSpaceId?}]` |
| GET | `/friends/requests` | `{incoming[], outgoing[]}` |
| GET | `/friends/suggestions` | friends-of-friends ranked by mutual count, then co-presence in public spaces (last 14 days), excluding blocked/pending/existing. Cached 1h |
| GET | `/users/search?handle=` | prefix search on `handle` (rate-limited) |
| GET | `/users/:id/profile` | public profile + `relationship: {status, friendshipId?, since?, togetherStreak?, alertOn?}`. Social handles only if friends **and** the owner set them visible |
| POST | `/friendships` | `{toUserId}` send |
| POST | `/friendships/:id/accept` · `/decline` | |
| DELETE | `/friendships/:id` | unfriend / cancel outgoing |
| POST/DELETE/GET | `/blocks`, `/blocks/:userId` | block side effects per DB doc §3 |
| PUT | `/reactions` | `{contextType, contextId, toUserId, type, on: boolean}`, so the toggle is explicit and idempotent |
| GET | `/reactions?contextType&contextId` | counts + viewer's own |
| POST | `/reports` | `{reportedUserId, spaceId?, reason}` |

**Notifications & mascot**

| Method | Path | Purpose |
|---|---|---|
| GET | `/notifications?category&cursor` | inbox page (Phase 1 `AppNotification` shape + `delivery`) |
| GET | `/notifications/unread-count` | header dot |
| PATCH | `/notifications/:id` | `{opened?: true, actionTaken?}` |
| POST | `/notifications/read-all` | |
| POST | `/notifications/:id/snooze` | `{minutes}` (§8.4) |
| DELETE | `/notifications/:id` | |
| GET | `/mascot/next` | `MascotMessage` (§10.1) |
| POST | `/mascot/events/:id/delivered` | acknowledge |

**Ops:** `GET /healthz` (unauthed: Mongo + Redis ping), `GET /readyz`.
Moderation endpoints (`/admin/reports`, `/admin/users/:id/status`) are
gated by `role`.

---

## 12. Security, abuse, privacy

- **Block enforcement points:** friend request, space feed/browse, join,
  invite, reactions, suggestions, search, profile view (404, not 403, so a
  block isn't revealed). All of them go through one
  `blocks.isBlockedEitherWay(a, b)` helper backed by a per-user Redis set
  cache.
- **Rate limits** (per user, sliding window): friend requests 20/day,
  reactions 60/min, invites 50/hour, space create 20/day, joins 60/hour,
  reports 10/day, search 30/min, auth 10/min per IP.
- **Social handles** (CLAUDE.md §4): stored opt-in with `isVisible:false`
  by default, returned only to accepted friends, never included in
  notifications or suggestions.
- **Mongo injection:** zod schemas whitelist fields and
  `express-mongo-sanitize` is a backstop. **No user-supplied keys** ever
  reach a query path.
- **Abuse surface of user text** (space name/description, tagline):
  length caps (40/140/80), a profanity filter at write, and reportable.
  There is no free chat, by design (§4).
- **Privacy:** `isOnline` / `liveSpaceId` only reach accepted friends.
  Public-space participant previews show display name + initial only.
  Account deletion purges PII and keeps anonymized ledger rows for
  aggregates.

---

## 13. Observability, config, deployment, testing

- `pino` JSON logs with `requestId`/`userId`. Sentry for errors. Metrics
  (Prometheus or the host's equivalent): request latency per route, socket
  count, BullMQ queue depth/failed, close-transaction retries, notification
  `DeliveryResult` counts (to tune caps and quiet hours from data).
- Config: zod-validated env at boot. Firebase service account + Mongo URI +
  Redis URL come from the platform secret manager outside dev.
- Deploy: `api` and `worker` images built from the same Dockerfile. MongoDB
  Atlas (replica set, required for transactions). Managed Redis with
  persistence enabled, because BullMQ delayed jobs live there. CI runs
  typecheck + lint + tests on every PR, auto-deploys to staging on `main`,
  and promotes to prod manually.
- Tests:
  - **Unit** (`packages/shared/rules`): XP, levels, streak crediting
    including the 50% edge, freeze spend, together-streak idempotency,
    quiet-hours wrap, dayKey across DST. These are the same functions the
    app imports, so one suite covers both.
  - **Integration** (Mongo memory-server **replica set** + real Redis):
    the close transaction (double-close, crash between steps), space
    lifecycle transitions, join capacity races, block enforcement, the
    notification pipeline (dedupe/group/held/quiet/cap).
  - **Socket:** join → presence → disconnect → "away" (session still
    open) → sweep close; notification fan-out across two api instances
    via the Redis adapter.
  - **Contract:** DTO zod schemas in `packages/shared/types` validate
    server responses in integration tests. The client's mock services
    return data that passes the same schemas, which keeps the Phase 2 swap
    drop-in.

---

## 14. Client migration plan (mock → API)

1. Add `packages/shared` and move types, copy and rules into it. The app
   imports from there. No behaviour change.
2. Add `src/api/client.ts` (fetch wrapper: base URL, Firebase token, error
   envelope → typed error, Idempotency-Key) and `src/api/socket.ts`.
3. Swap each `services/*.ts` body to the endpoint named in its comment.
   Add the missing services: `spaceService.getFeed/create/join/leave/start`,
   `sessionService` (solo), `notificationService`, `statsService`,
   `reactionService`.
4. Stores: actions call services and apply the server response (optimistic
   for reactions and toggles, server-confirmed for join/leave/create).
   `useUserStore.recordSessionResult`, `useTogetherStreakStore.recordTogether`
   and the reward logic are deleted, and Post-Session renders
   `SessionCloseResult`.
5. Delete `NotificationRunner`'s trigger loop, `utils/notifications/triggers/*`,
   `deliver.ts` and `mocks/notificationSimulations.ts`. Wire `notification:new`
   into the store.
6. Finish the pending frontend rename (`useSessionStore` → `useSpaceStore`,
   `components/Sessions` → `components/Spaces`, `Reaction.sessionId` →
   `contextType/contextId`) and add the solo-session flow. Do this before
   or alongside step 3, so services are written against the final names.

---

## 15. Build order (Phase 2 → 3)

1. `packages/shared` extraction + server skeleton (config, middleware, health, error envelope, test harness with replica-set Mongo).
2. Auth + users + categories (`/auth/session`, `/me`, onboarding handle).
3. Spaces + sessions + **close transaction** with XP/streak/rollups/levels/badges (§6, §7). This is the core loop, end to end.
4. Socket layer: presence, `space:` rooms, `user:` room, `progress:updated`.
5. Friendships + blocks + suggestions + profiles; together streaks.
6. Notification pipeline + all event-driven triggers; settings, reminders, alerts, snooze.
7. Jobs: sweep, space lifecycle, dayRollover, nudgeTick, weeklyRecap, reconciliation.
8. Reactions, mascot queue, analytics/stats/recap endpoints.
9. Phase 4 (not before): FCM push, bot seeding, subscription.

---

## 16. Open decisions to confirm before scaffolding `server/`

| # | Decision | Recommendation |
|---|---|---|
| D1 | **Space = occurrence, not persistent room** (C3). Revises the 2026-09-25 DB-doc model | Accept. The built UI already assumes it. Recurring rooms later via templates |
| D2 | Firebase Auth vs Passport+JWT (CLAUDE.md §3 still "not finalized") | Firebase Auth |
| D3 | Level curve. `utils/levels.ts` is provisional (250 XP/level). With the locked 50 XP/hr, that's a level every 5 focused hours | Pick a rising curve (e.g. `100·n^1.5` cumulative) plus `mascotStage` thresholds before step 3 |
| D4 | Ownership of the Phase 1 XP/streak behaviour (C1/C2). The client currently over-awards | Server follows the locked rules. Fix the client now so mock numbers don't set expectations |
| D5 | Session credit policy (§7.2): honor-system with caps | Accept for MVP |
| D6 | Together-streak overlap minimum (10 min) and timezone tie-break (closer's day) | Accept |
| D7 | Nudges in-app only (no push) for `join_nudge` / `together_streak_risk` | Accept until Phase 4 data |
| D8 | Monorepo `packages/shared` via npm workspaces | Accept. It's the only way to keep copy/rules single-sourced |
| D9 | BullMQ (vs node-cron) | BullMQ. Delayed per-space jobs make it necessary now, not optional |
