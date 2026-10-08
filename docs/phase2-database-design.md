# Prodify — Phase 2 Database Implementation Plan

*Companion doc to `CLAUDE.md` §5. This supersedes the `sessions`/`spaces` portion of
that schema and adds the collections needed for the Spaces feature, analytics
rollups, and the XP/streak/badge engine. CLAUDE.md §5 has been updated with a
condensed pointer here — this file is the authoritative detail. Locked
decisions from the design conversation are folded in directly (no "TBD"s left
where a call was actually made).*

*Revision 2026-10-05 (with `docs/phase2-backend-architecture.md` v2): the
schema now covers what the built Phase 1 client consumes:

- spaces are time-boxed occurrences (scheduled → active →
  completed/cancelled), not persistent rooms (backend doc §3 C3, **pending
  confirmation as D1**)
- reactions have a polymorphic context
- the notification document has its full shape
- users have counters and notification prefs
- three new collections: `togetherStreaks`, `spaceReminders`, `weeklyRecaps`

Superseded text is replaced in place, not kept alongside.*

---

## 1. Core conceptual model: Session vs Space

These are two different entities, not two modes of the same entity (the
current Phase 1 mock `Session` type conflates them — see §9 for the frontend
follow-up).

- **Session** = the atomic, personal unit of clocked time. One user, one
  niche/category, one continuous interval. Every minute of productive time in
  the app — solo or social — is backed by a `sessions` document. This is what
  streaks, XP, and analytics are computed from. A user never sees "Sessions"
  as a social/discovery surface; it's the ledger under the hood (still
  surfaced to them as their personal history/stats).
- **Space** = a shared, time-boxed room scoped to one niche/category, created
  by a user (usually to do something with friends), that others join in real
  time. It can be scheduled ahead, goes live, and ends once it's empty.
  "Start one like this" re-creates it. (Revised 2026-10-05 from
  "persistent room"; see the revision note above.) A Space is a **social
  container, not a stopwatch**: it doesn't hold time itself. When a user is present and clocking time in a Space, that
  presence *is* a Session for them (`sessions.spaceId` set, `categoryId` =
  the Space's niche). This is what makes "joining a Coding space" and
  "starting a Coding session" the same underlying event, per your
  requirement — a Space is just a Session with company.

This resolves the product ask directly: *"the hours clocked in that space
will be counted as the session hours clocked for that particular niche"* —
because mechanically, joining a Space **creates/extends a `sessions` doc**,
there's no separate counting logic to keep in sync.

---

## 2. Collections

### `users`

```js
{
  _id,
  googleId: null,             // populated Phase 2
  firebaseUid,                 // auth lookup key (Firebase Auth, backend doc §5.2)
  handle: null,                // unique, lowercase, indexed — search/discovery
  tagline: "",                 // ≤80 chars, shown on friend cards/profile
  favoriteCategoryId: null,    // nightly job: top niche by last-30-day dailyStats
  email,
  authProvider: "google",
  status: "active" | "suspended" | "banned" | "deleted",
  role: "user" | "moderator" | "admin",   // minimal RBAC, not per-space
  displayName,
  avatarUrl,
  mascotStage: 1,
  dailyTargetMin: 30,          // used by the streak check (§5)
  timezone: "Asia/Kolkata",    // IANA tz — needed so the streakAtRiskSweep job (backend doc §7) evaluates "end of day" per-user, not in UTC
  socialHandles: {             // §4 locked: opt-in, gated, never default-on
    instagram: { value: null, isVisible: false },
    snapchat:  { value: null, isVisible: false },
  },
  streak: {
    current: 0,
    longest: 0,
    lastActiveDate: null,      // last date the streak check succeeded
    freezesAvailable: 0,
    freezesUsed: 0,
  },
  points: 0,                   // denormalized running XP total — source of truth is pointsLedger
  level: 1,                    // levelFor(points), packages/shared/rules/levels.ts (curve = open decision D3)
  badgeIds: [ObjectId],
  counters: {                  // threshold-cross inputs for non-XP badges (backend doc §7.5)
    sessionsCompleted: 0, earlySessions: 0, lateSessions: 0, friends: 0,
  },
  notificationPrefs: {         // backend doc §8.5
    categories: { spaces: true, friends: true, progress: true, nudges: true },
    quietHours: { enabled: true, startHour: 22, endHour: 8 },
    dailyToastCap: 6,
    friendAlertIds: [userId],  // "tell me when they start a space" — accepted friends only
  },
  createdAt,
  lastActiveAt,
}
```
Indexes:

- unique `googleId` (sparse)
- unique `firebaseUid`
- unique `handle` (sparse until populated)
- `{timezone}`, for dayRollover/weeklyRecap bucketing
- `{'notificationPrefs.friendAlertIds'}` (multikey), for the
  `friend_started_space` fan-out

### `sessionCategories` (unchanged — the niche catalog: Study, Gym, Coding, Walk, …)

```js
{ _id, name, icon, isCustom: false, createdBy: null }
```

### `spaces` (NEW — revised 2026-10-05: occurrence, not persistent room)

```js
{
  _id,
  categoryId,                  // the niche — locks what "hours in this space" counts as
  name,                        // ≤40 chars
  description,                 // ≤140 chars, nullable
  hostId,                      // creator; null only for bot-seeded rooms
  isPublic: true,              // false = friends-only 🔒 (never in "open to everyone")
  maxParticipants: null,
  durationTargetMin,           // shared goal; each member's session copies it as targetDurationMin
  status: "scheduled" | "active" | "completed" | "cancelled",
  startTime,                   // scheduled start, or actual go-live time once active
  endedAt: null,
  invitedUserIds: [userId],    // capped at 50 — "who was asked", not who came
  declinedUserIds: [userId],
  liveCount: 0,                // open sessions right now — atomic capacity guard (backend doc §6.2)
  isBotSeeded: false,
  syntheticCount: 0,           // bot-seeded only (Phase 4) — never backed by sessions
  createdAt,
}
```
Live presence is explicitly **not** stored here (see §7). `liveCount` is
only the capacity counter. The old `memberIds` roster is dropped: "who was
in this space" is answered by `sessions{spaceId}`.

Indexes:

- `{status, isPublic, categoryId, startTime}`, for public browse
- `{hostId, status, startTime}`, for friends' live/scheduled/recently-ended
  spaces (queried with `hostId: {$in: friendIds}`)
- `{invitedUserIds, status}` (multikey), for "invited to"

### `sessions` (redefined — the personal time ledger)

```js
{
  _id,
  userId,
  categoryId,
  spaceId: null,                // set only when this session happened inside a Space
  type: "solo" | "space",
  startTime,
  endTime: null,                 // null while active
  durationMin: 0,                // computed on close
  targetDurationMin,
  status: "active" | "closing" | "completed",
  closedReason: null,            // "left" | "completed" | "timeout" | "space_ended"
  completed: false,
  targetHit: false,              // server-derived: durationMin >= targetDurationMin (never client-sent)
  xpEarned: 0,
  createdAt,
}
```
Partial unique index `{userId}` where `status: "active"` allows at most one
open session per user (backend doc §7.1).
One document per continuous clock-in — not per room, not per user-lifetime.
A user joining a Space for three separate stretches in an evening produces
three `sessions` docs. This replaces the old embedded `participants[]`
array entirely: that pattern breaks down for a Space with an unbounded
join/leave history over its lifetime (violates the "bounded size" rule for
embedding, and risks the 16MB doc cap on a popular long-running space).

Indexes: `{userId, startTime}` (personal history/analytics), `{spaceId, startTime}`
(who's clocked time in this space, for the niche-wide member stats in §7),
`{categoryId, status}`.

This collection is the highest-write-volume collection in the system and the
natural future shard-key candidate (`userId`).

### `dailyStats` (NEW — per-niche rollup)

```js
{ _id, userId, categoryId, date /* "YYYY-MM-DD" */, totalMinutes, sessionCount, xpEarned }
```
Unique index `{userId, categoryId, date}`. Upserted with `$inc` every time a
session closes — O(1) write, never recomputed from raw `sessions`. This is
the **"separate report" per niche** from your requirement (e.g. "Coding: 4h
today, 12h this week").

### `userDailyTotal` (NEW — combined rollup)

```js
{ _id, userId, date, totalMinutes, xpEarned }
```
Unique index `{userId, date}`. Incremented in the *same* write as
`dailyStats`, across every niche. This is the **combined weekly productive
hours report** — and it's also what the streak check reads from (§5).

Weekly/monthly views are aggregations *over these rollups*, not over raw
`sessions` — at most 7 or 31 small docs scanned per query, indexed by
`{userId, date range}`. No separate weekly/monthly collection needed unless
usage data later shows it's worth materializing (note as a future
optimization, not a day-one requirement).

### `friendships` (canonicalized)

```js
{ _id, userIdA, userIdB, status: "pending" | "accepted" | "declined", requestedBy, createdAt, respondedAt }
```
**Write-time rule: always sort `userIdA < userIdB`** (string-compare the two
ObjectIds) before insert. This is a real gap in the current Phase 1 mock data
(`friendship_meera` has the pair in the opposite order from every other row)
— without canonical ordering, a unique index on `{userIdA, userIdB}` can't
prevent A→B and B→A both existing as separate pending docs from a
double-tap race.

Indexes: unique `{userIdA, userIdB}`.

### `blocks` (NEW — missing from the current schema entirely)

```js
{ _id, blockerId, blockedId, createdAt }
```
Blocking hard-deletes any existing friendship/pending request between the
two users and prevents new ones either direction; also filters the blocked
user out of Space discovery and member lists. Unique index `{blockerId, blockedId}`.

### `reactions` (revised 2026-10-05: polymorphic context)

```js
{
  _id,
  contextType: "space" | "milestone",
  contextId,                    // spaceId, or "milestone_<userId>_<n>" for a friend's streak milestone
  fromUserId, toUserId,
  type: "clap" | "fire" | "fist_bump",
  createdAt,
}
```
The client reacts to friends *in a space* (cards and the room) and to a
friend's *streak milestone* (Send 🔥). Neither of those is a ledger
`sessions` doc, so the old `sessionId` key didn't fit. Unique index
`{contextType, contextId, fromUserId, toUserId, type}` gives toggle
semantics (Instagram-like), not append-only, so one user can't spam-react
50 times.

### `badges` — extend catalog with the XP tiers

```js
{ _id, name: "Rising Flame",  description: "Earned 1,000 XP",  criteriaType: "total_xp", criteriaValue: 1000 }
{ _id, name: "Steady Blaze",  description: "Earned 5,000 XP",  criteriaType: "total_xp", criteriaValue: 5000 }
{ _id, name: "Inferno",       description: "Earned 10,000 XP", criteriaType: "total_xp", criteriaValue: 10000 }
```
(Names are placeholders — pull real copy from the mascot/badge doc when it exists.)

### `pointsLedger` (unchanged — append-only, per §4)

```js
{ _id, userId, source: "session_complete", amount, sessionId, timestamp }
```
Indexes: `{userId, timestamp}`.

### `notifications` (revised 2026-10-05: full in-app shape)

Mirrors the Phase 1 `AppNotification` type (`src/types/social.ts`), so the
inbox swap is drop-in. Pipeline semantics are in backend doc §8.

```js
{
  _id, userId,
  eventId,                       // deterministic source-event id — dedupe key
  absorbedEventIds: [],          // events merged into this one via groupKey
  type,                          // 19 types — see AppNotificationType
  category: "spaces" | "friends" | "progress" | "nudges",
  title, body,                   // rendered at write time from shared copy
  copyVariantId, copyVars: {},
  sender: { kind: "spark" } | { kind: "friend", userId } | { kind: "system", emoji },
  tone: "default" | "reward" | "nudge",
  priority: "normal" | "high",
  actions: [{ kind, label }],
  payload: {},                   // spaceId, spaceName, fromUserId(s), friendshipId, badgeId, level, …
  groupKey: null,
  delivery: "toast" | "inbox" | "held",
  heldForSessionId: null,
  actionTaken: null,             // e.g. "accepted", "reminder_set" — rewritten row state
  scheduledAt, sentAt, openedAt: null,
  createdAt,
}
```
Indexes:

- unique `{userId, eventId}`, for dedupe
- `{userId, createdAt}`, for inbox paging
- `{userId, category, createdAt}`, for the filter tabs
- `{userId, groupKey, openedAt}`, for group merge
- `{userId, heldForSessionId}`, for "While you focused"
- TTL 90 days on `createdAt`

### `mascotEvents`, `reports` — unchanged shape

- `mascotEvents` priority order is unchanged from §4.

### `togetherStreaks` (NEW)

```js
{ _id, pairKey /* "<smallerId>_<largerId>" */, userIds: [a, b], current, longest, lastTogetherDay /* "YYYY-MM-DD" */ }
```
One doc per friend pair, advanced in the session-close transaction
(backend doc §7.4). A day counts when the two overlapped ≥10 min in the
same space and the closer's day was credited. The "live" value is `current`
only if `lastTogetherDay` is today or yesterday (the same rule as
`getLiveTogetherStreak`). Indexes: unique `{pairKey}`, `{userIds}`
(multikey).

### `spaceReminders` (NEW)

```js
{ _id, userId, spaceId, remindAt, createdAt }
```
"Remind me" on a scheduled space. Indexes: unique `{userId, spaceId}`,
`{spaceId}` (job fan-out), TTL on `remindAt` + 1 day.

### `weeklyRecaps` (NEW)

```js
{
  _id, userId, weekStart /* Monday "YYYY-MM-DD" */,
  totalMinutes, days: [{ date, minutes }], bestDay: { date, minutes },
  topCategoryId, sessionsCompleted, spacesJoined,
  focusedWithFriendIds: [userId], cheersReceived, xpEarned, createdAt,
}
```
Materialized by the Sunday `weeklyRecap` job from `userDailyTotal`,
`dailyStats`, `sessions` (co-present friends via a shared `spaceId`) and
`reactions` (`toUserId`). Unique `{userId, weekStart}`. It also serves as
the input for a future "Wrapped" recap.

### `authSessions` (NEW — was missing; needed for real Google OAuth)

```js
{ _id, userId, deviceId, platform, refreshTokenHash, createdAt, lastUsedAt, revokedAt }
```
Deliberately **not** named `sessions` — that name is now the time-ledger
collection above. Powers "log out of all devices" and device-level
revocation on account compromise.

Indexes: `{userId, revokedAt}`.

---

## 3. Friend request lifecycle (finalized)

State machine per canonical `{userIdA, userIdB}` pair:

```
no doc ──send──▶ pending ──accept──▶ accepted ──unfriend──▶ (doc deleted)
                    │
                    ├──decline──▶ (doc deleted)
                    └──cancel (by requester)──▶ (doc deleted)
```

- **Send:** reject if a block exists either direction, already friends, or a
  pending doc already exists (single canonical-key lookup catches both
  directions). Rate-limited per user.
- **Accept:** flip status, stamp `respondedAt`, fire `mascotEvent`
  (`friend_achievement`) + `notification` (`friend_accepted`) to the requester.
- **Decline / Cancel:** hard-delete the doc — no tombstone, matches
  Snapchat/Instagram (a decline doesn't permanently block a future request).
- **Unfriend:** hard-delete, either side, any time (already locked in
  CLAUDE.md §4).
- **Block:** can be issued directly against an existing friend (Instagram
  behavior) — deletes the friendship as a side effect.

---

## 4. Space lifecycle

> **Superseded 2026-10-05** by backend doc §6, which covers the state
> machine (`scheduled → active → completed | cancelled`), the
> visibility/access table, invites, and capacity. The steps below are kept
> only where still accurate. `memberIds` references no longer apply.

1. **Create:** `POST /spaces` — user picks a `categoryId`, name, visibility,
   optional friend invitees. Creator is auto-added to `memberIds`.
2. **Join:** `POST /spaces/:id/join` —
   - Validate: not blocked by any current member/host, space not full/archived.
   - **Open a `sessions` doc**: `{userId, categoryId: space.categoryId, spaceId: space._id, type: "space", startTime: now, status: "active"}`.
   - Register presence in Redis (§7).
3. **Leave / disconnect:** close the open `sessions` doc (`endTime`,
   `durationMin`, `completed`, `targetHit`), run the XP/streak/badge flow
   (§5), remove Redis presence key. A socket disconnect without an explicit
   leave should close the session too, after a short grace period (handles
   dropped connections without losing the clocked time).
4. Re-joining later (same day or another day) opens a new `sessions` doc —
   same as re-starting a solo session.

---

## 5. XP / Streak / Badges — exact flow

**XP formula:** `xpEarned = floor(durationMin / 60 * 50)` — 50 XP per hour,
solo or Space, identical formula either way (per your requirement — no
special-casing).

On every session close (`sessions.status → "completed"`):

1. Write `durationMin`, `xpEarned`, `completed`, `targetHit` onto the session doc.
2. Append a `pointsLedger` entry (`source: "session_complete"`, `amount: xpEarned`).
3. `$inc users.points` by `xpEarned` (denormalized fast-read field, existing pattern).
4. `$inc dailyStats {userId, categoryId, today}` — `totalMinutes`, `sessionCount`, `xpEarned`.
5. `$inc userDailyTotal {userId, today}` — `totalMinutes`, `xpEarned`.
6. **Streak check** (locked decision: daily-total basis) — read
   `userDailyTotal` for today, compare against `users.dailyTargetMin`:
   - `totalMinutes >= dailyTargetMin` → full credit.
   - `totalMinutes >= dailyTargetMin * 0.5` → also counts (generalizes the
     existing §4 "≥50% of target" rule from a single session to the whole day
     — a user who does two 20-minute Coding sessions against a 30-min target
     should still get the day, same as one 15-minute session used to).
   - Update `users.streak.current`/`longest`/`lastActiveDate` accordingly;
     apply freeze logic if the day was missed and a freeze is available.
7. **Badge check** — badge crossing is a threshold-cross, not a
   re-evaluation: `if (oldPoints < tier.criteriaValue <= newPoints)` for each
   of the 1,000 / 5,000 / 10,000 XP badges not already in `badgeIds`, push
   the badge and fire a `mascotEvent` (`badge_earned`, high priority per the
   existing order).

Backend doc §7.3 (v2) adds four steps to this flow:

- counters (`sessionsCompleted`, `earlySessions`, `lateSessions`)
- together streaks (§2 `togetherStreaks`)
- level and `mascotStage`
- generalized badge evaluators

It also adds a "credit the day at most once" guard on step 6
(`lastActiveDate === today` → no-op).

All of steps 2–7 should run inside a single Mongo transaction (multi-document
ACID transactions are fine at this write volume) so a crash mid-flow can't
award XP without recording the ledger entry, or vice versa.

---

## 6. Analytics — daily / weekly / monthly, per-niche and combined

- **Per-session-type (niche) report:** read `dailyStats` filtered by
  `{userId, categoryId}` — daily view is the single day's doc; weekly/monthly
  are a `$group`/`$sum` over the last 7/30 matching docs. This is the
  "separate report for each individual session [niche]" requirement.
- **Combined report:** same pattern against `userDailyTotal` (no
  `categoryId` filter needed — it's already the cross-niche sum) — "combined
  total productive time on weekly basis."
- Both are cheap at any user scale because they read from the rollup layer,
  never from raw `sessions`. A power user with 10,000 lifetime sessions still
  only has ≤365 `dailyStats` docs per category per year.

---

## 7. Real-time presence & "friends' hours in this space" display

Two different data needs, two different stores — don't conflate them:

- **Live "who's clocking right now" + elapsed-seconds ticker:** Redis, not
  Mongo. `space:{spaceId}:presence` — a hash of `{userId: joinedAtTimestamp}`,
  pushed to space members over the existing Socket.IO channel. The client
  computes elapsed time locally from the timestamp (no per-second DB writes
  needed at all — this is the single biggest scale risk in a naive
  implementation, since a room writing to Mongo every second per member does
  not survive real concurrency).
- **"How much has my friend contributed" (daily/weekly), shown inside the
  space:** locked decision — **niche-wide**, not scoped to this one space.
  Query `dailyStats` for `{userId: IN <present members>, categoryId: space.categoryId}`
  over the relevant date range. This deliberately shows a member's total
  Coding time everywhere (this space, other spaces, solo sessions), not just
  time spent in this particular room — matches "so users know how much time
  their friends have contributed" as a niche-commitment signal, not a
  room-attendance counter.

---

## 8. Roles & permissions

Not full RBAC — two small, purpose-built layers:

- **Account-level:** `users.role: "user" | "moderator" | "admin"` — gates
  `reports` handling and moderation actions only.
- **Space-level:** `space.createdBy` is the host — can remove a member,
  archive the space, edit its name/visibility. Regular members can join,
  leave, and clock time. No finer-grained space roles needed at this scale.

---

## 9. Frontend follow-up (not done yet, flagged separately)

The current Phase 1 mock `Session` type (`type: "solo" | "multiplayer"`)
conflates both concepts described in §1 — it's what the "Sessions" tab
currently browses/creates/joins is really the **Space** concept (a room with
participants), not the personal ledger. Renaming that surface
(`SessionsScreen` → `SpacesScreen`, `useSessionStore` → `useSpaceStore`,
`components/Sessions/` → `components/Spaces/`, etc.) was scoped for this same
session but **deferred**: another active Claude Code session
(`prodify-c1`) is currently mid-edit inside `components/Sessions/` (building
a duration/icon picker for the create flow), and doing a sweeping rename
concurrently risks clobbering that in-progress work. Do this rename as its
own reviewable pass once that work lands.

When it happens, it should also introduce a distinct, lightweight "start a
solo session" flow (pick a niche, set a target, go — no room, no members)
since today's UI has no path that isn't a Space join, even though the mock
type nominally supports `type: "solo"`.

---

## 10. Build order for Phase 2

1. Auth (`users`, `authSessions`, Google OAuth) — everything else needs a real `userId`.
2. `sessionCategories` seed data, `spaces` CRUD + join/leave, `sessions` open/close.
3. XP/streak/badge write-time flow (§5) wired to session close.
4. `dailyStats`/`userDailyTotal` rollups (write-time, alongside #3).
5. Redis presence + Socket.IO for live space state (§7).
6. `friendships`/`blocks` (§3).
7. `reactions`, `notifications`, `mascotEvents` delivery.
8. Analytics read endpoints (daily/weekly/monthly, per-niche + combined) off the rollup collections.

---

## 11. Indexing summary

| Collection | Index | Purpose |
|---|---|---|
| `users` | unique `googleId` (sparse) | auth lookup |
| `users` | unique `handle` (sparse) | search/discovery |
| `users` | unique `firebaseUid` | auth lookup |
| `users` | `{timezone}` | per-timezone jobs |
| `users` | `{notificationPrefs.friendAlertIds}` | alert fan-out |
| `spaces` | `{status, isPublic, categoryId, startTime}` | public browse |
| `spaces` | `{hostId, status, startTime}` | friends' live/scheduled/ended |
| `spaces` | `{invitedUserIds, status}` | "invited to" |
| `sessions` | partial unique `{userId}` where `status:"active"` | one open session per user |
| `sessions` | `{userId, startTime}` | personal history |
| `sessions` | `{spaceId, startTime}` | space attendance history |
| `sessions` | `{categoryId, status}` | live/active browse |
| `dailyStats` | unique `{userId, categoryId, date}` | rollup upsert + per-niche report |
| `userDailyTotal` | unique `{userId, date}` | rollup upsert + combined report |
| `friendships` | unique `{userIdA, userIdB}` | canonical pair, race-safe |
| `blocks` | unique `{blockerId, blockedId}` | dedup |
| `reactions` | unique `{contextType, contextId, fromUserId, toUserId, type}` | dedup/toggle |
| `pointsLedger` | `{userId, timestamp}` | ledger reads |
| `mascotEvents` | `{userId, deliveredAt}` | fetch-next-undelivered |
| `notifications` | unique `{userId, eventId}` | dedupe |
| `notifications` | `{userId, createdAt}` | inbox paging |
| `notifications` | `{userId, category, createdAt}` | filter tabs |
| `notifications` | `{userId, groupKey, openedAt}` | group merge |
| `notifications` | TTL 90 days on `createdAt` | auto-expire |
| `togetherStreaks` | unique `{pairKey}` | pair lookup |
| `togetherStreaks` | `{userIds}` | "my together streaks" |
| `spaceReminders` | unique `{userId, spaceId}` | dedupe |
| `spaceReminders` | `{spaceId}` + TTL | reminder job fan-out |
| `weeklyRecaps` | unique `{userId, weekStart}` | recap reads |
| `authSessions` | `{userId, revokedAt}` | device session management |

---

## 12. Scaling notes carried over from the earlier discussion

- Cursor-based pagination everywhere (space browse, friends list,
  notifications) — never `skip/limit`.
- Replica set from day one for read scaling/failover.
- Sharding not needed at MVP scale, but `sessions`/`dailyStats`/
  `pointsLedger`/`notifications` are all designed to shard cleanly on
  `userId` later without cross-shard joins.
- Rate limiting at the API layer for friend requests, reactions, reports,
  and space joins — the highest-abuse-potential writes.
- TTL indexes on `notifications` and `mascotEvents` to cap unbounded growth.
