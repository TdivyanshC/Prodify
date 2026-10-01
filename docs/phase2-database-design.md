# Prodify — Phase 2 Database Implementation Plan

*Companion doc to `CLAUDE.md` §5. This supersedes the `sessions`/`spaces` portion of
that schema and adds the collections needed for the Spaces feature, analytics
rollups, and the XP/streak/badge engine. CLAUDE.md §5 has been updated with a
condensed pointer here — this file is the authoritative detail. Locked
decisions from the design conversation are folded in directly (no "TBD"s left
where a call was actually made).*

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
- **Space** = a persistent, shared room scoped to one niche/category, created
  by a user (usually to do something with friends), that others join in real
  time. A Space is a **social container, not a stopwatch** — it doesn't hold
  time itself. When a user is present and clocking time in a Space, that
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
  handle: null,                // unique, lowercase, indexed — search/discovery
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
  badgeIds: [ObjectId],
  createdAt,
  lastActiveAt,
}
```
Indexes: unique `googleId` (sparse), unique `handle` (sparse until populated).

### `sessionCategories` (unchanged — the niche catalog: Study, Gym, Coding, Walk, …)

```js
{ _id, name, icon, isCustom: false, createdBy: null }
```

### `spaces` (NEW)

```js
{
  _id,
  categoryId,                  // the niche — locks what "hours in this space" counts as
  name,
  description,
  createdBy,                   // host/admin of the space
  isPublic: true,
  maxParticipants: null,
  status: "active" | "archived",
  memberIds: [userId],         // the persistent roster (small, bounded — friends who belong here)
  createdAt,
}
```
`memberIds` is bounded (friend-group sized) so embedding is fine — this is
"who belongs to this space," not "who's online right now." Live presence is
explicitly **not** stored here (see §7).

Indexes: `{categoryId, status}` (browse/discover query), `{memberIds}` (multikey — "spaces I'm in").

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
  status: "active" | "completed" | "abandoned",
  completed: false,
  targetHit: false,
  xpEarned: 0,
  createdAt,
}
```
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

### `reactions`

```js
{ _id, sessionId, fromUserId, toUserId, type: "clap" | "fire" | "fist_bump", createdAt }
```
Unique index `{sessionId, fromUserId, toUserId, type}` — upsert-on-send
(toggle, like Instagram's like button), not append-only inserts, so one user
can't spam-react 50 times in one session.

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

### `mascotEvents`, `notifications`, `reports` — unchanged shape, extended `type` enums

- `notifications.type` gains: `friend_request`, `friend_accepted`, `space_invite`,
  `friend_joined_space`, `badge_earned`, `streak_at_risk`, `level_up`.
- `mascotEvents` priority order is unchanged from §4.

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

1. **Create:** `POST /spaces` — user picks a `categoryId`, name, visibility,
   optional friend invitees. Creator is auto-added to `memberIds`.
2. **Join:** `POST /spaces/:id/join` —
   - Validate: not blocked by any current member/host, space not full/archived.
   - Add to `memberIds` if not already present (idempotent).
   - **Open a `sessions` doc**: `{userId, categoryId: space.categoryId, spaceId: space._id, type: "space", startTime: now, status: "active"}`.
   - Register presence in Redis (§7).
3. **Leave / disconnect:** close the open `sessions` doc (`endTime`,
   `durationMin`, `completed`, `targetHit`), run the XP/streak/badge flow
   (§5), remove Redis presence key. A socket disconnect without an explicit
   leave should close the session too, after a short grace period (handles
   dropped connections without losing the clocked time).
4. Re-joining later (same day or another day) opens a new `sessions` doc —
   same as re-starting a solo session. The member stays in `memberIds`
   between visits; that list is the roster, not the live attendance.

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
  Query `dailyStats` for `{userId: IN space.memberIds, categoryId: space.categoryId}`
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
| `spaces` | `{categoryId, status}` | browse/discover |
| `spaces` | `{memberIds}` | "spaces I'm in" |
| `sessions` | `{userId, startTime}` | personal history |
| `sessions` | `{spaceId, startTime}` | space attendance history |
| `sessions` | `{categoryId, status}` | live/active browse |
| `dailyStats` | unique `{userId, categoryId, date}` | rollup upsert + per-niche report |
| `userDailyTotal` | unique `{userId, date}` | rollup upsert + combined report |
| `friendships` | unique `{userIdA, userIdB}` | canonical pair, race-safe |
| `blocks` | unique `{blockerId, blockedId}` | dedup |
| `reactions` | unique `{sessionId, fromUserId, toUserId, type}` | dedup/toggle |
| `pointsLedger` | `{userId, timestamp}` | ledger reads |
| `mascotEvents` | `{userId, deliveredAt}` | fetch-next-undelivered |
| `notifications` | `{userId, sentAt}` + TTL | inbox + auto-expire |
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
