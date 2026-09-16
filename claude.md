# Prodify — Project Memory

*This file is project context for Claude Code (or any coding agent) working in this repo. It captures every product/architecture decision made so far, the current build order, and working conventions — so the agent doesn't have to re-derive or re-litigate settled choices while building. Keep it updated as decisions change; treat it as the single source of truth for "what have we already decided."*

---

## 1. What Prodify is

A hybrid productivity app. Users run **solo sessions** (timer + personal target) or join **live multiplayer sessions** (category rooms — Study, Gym, Walk, Coding, etc. — where others are present in real time). Wrapped around both: a gamification layer (streaks with forgiving freezes, points, badges, levels), a lightweight friend system (reactions only, no in-app chat), and a personal mascot ("Spark" — working name, a flame-spirit whose glow represents the user's streak) that delivers personalized reactions and updates. Subscription monetization is intentionally deferred until the core loop proves sticky.

---

## 2. Current phase & build order — READ THIS FIRST

**We are building UI-first, backend-later. Do not wire real auth or a real backend yet.**

**Phase 1 (current): UI only, no backend wiring.**
1. Home screen (mascot-centric landing screen)
2. Mascot component + its popup/animation system (Lottie playback, message display)
3. General popup/modal UI system (friend request popups, badge-earned popups, confirmation dialogs — build this as a reusable system, not one-off per feature)
4. All remaining screens' UI, built against **mock/local data only**: Auth screen (UI shell only — see note below), Session Hub, Session Room, Post-Session, Profile/Stats, Friends, Notifications settings

Auth screen: build the visual UI for sign-in/register now, but **do not implement real Google OAuth yet**. Stub it with a mock "continue" button that navigates forward using local/dummy session state. Real Google auth is explicitly deferred to Phase 2.

**Important for whoever builds this:** structure the mock data layer (a `services/` or `api/` folder with functions like `getSessions()`, `getUserProfile()`, `getMascotMessage()`) so each function currently returns local fixture data but has the exact shape the real MongoDB-backed API will return later (see §5 schemas). That makes swapping mock calls for real API calls in Phase 2 a drop-in change instead of a rewrite.

**Phase 2: Backend build-out.** Node.js/Express API + MongoDB, real Google OAuth, real session/gamification logic, realtime presence layer.

**Phase 3: Gamification & social logic goes live**, wired to the now-real backend (streaks, points, badges, friends, reactions).

**Phase 4: Bot-seeding, notifications, subscription** (subscription stays secondary/optional — do not block other work on it).

---

## 3. Tech stack (decided)

- **Frontend:** React Native (single codebase, iOS + Android)
- **Backend:** Node.js/Express (assumed — confirm if a different framework is preferred) + MongoDB as the database
- **Realtime (Phase 2):** Socket.IO for presence/live session sync
- **Auth (Phase 2):** Google OAuth via Firebase Auth or Passport.js + Google strategy
- **Push notifications (Phase 4):** Firebase Cloud Messaging
- **Animation:** `lottie-react-native` for all mascot/celebration animations
- **State management:** Redux Toolkit or Zustand — pick one before Phase 1 screens multiply state logic; keep session/presence state in its own slice, separate from UI state

---

## 4. Locked product decisions (do not re-decide these mid-build)

- **No camera in sessions.** Presence is shown via avatars + status pulses, not video.
- **No in-app chat.** Social interaction is limited to a fixed reaction set (clap / fire / fist-bump) — this is a productivity app, not a messaging platform.
- **Friends require mutual accept.** Request → pending → accept/decline → friendship. Either side can unfriend anytime.
- **Social handle sharing (Instagram/Snapchat) is opt-in and deliberately gated** — not shown automatically on friend-accept. Treat as a safety-sensitive feature; don't default it to "on."
- **Mascot's "which message wins" logic lives server-side** (Phase 2+), not client-side, so behavior is consistent across platforms and tunable without a client release. Priority order: streak-at-risk-today > new badge/level-up > friend's significant achievement > welcome-back-after-inactivity > generic encouragement > idle.
- **Missed-target/quit-early mascot messaging is always supportive, never shaming.** See mascot quote library (§8) for exact tone.
- **Bot-seeded sessions use auto-generated cards/counts, not persona-driven bots impersonating specific people.** If persona-lite bots are ever added, they never fake 1:1 reactions or fake friendships. Bot-seeding phases out per category/timeslot once real concurrent users cross a set threshold.
- **Streak counts a day if the user hits their target, or completes a session at ≥50% of target duration** (avoids punishing near-misses while still requiring real effort). Freezes earned at streak milestones, capped stockpile.
- **Points ledger is append-only** — never edit past entries in place (needed later for an accurate "Wrapped"-style recap).

---

## 5. Data model — MongoDB collections

Document-oriented version of the earlier relational design. Embed where data is always read together and bounded in size; reference (by ObjectId) where it's unbounded, shared, or needs independent querying.

```js
// users
{
  _id,
  googleId: null,          // populated in Phase 2 when real auth ships
  displayName,
  avatarUrl,
  mascotStage: 1,          // evolves with level
  streak: {
    current: 0,
    longest: 0,
    lastActiveDate: null,
    freezesAvailable: 0,
    freezesUsed: 0
  },
  points: 0,                // running total (denormalized for quick reads; ledger below is source of truth)
  badgeIds: [ObjectId],     // references badges collection
  createdAt,
  lastActiveAt
}

// sessionCategories
{ _id, name, icon, isCustom: false, createdBy: null }

// sessionTemplates
{
  _id, userId, categoryId, title,
  defaultDurationMin, recurrenceRule, isMultiplayer
}

// sessions
{
  _id, categoryId, templateId: null,
  type: "solo" | "multiplayer",
  hostId: null,
  isBotSeeded: false,
  startTime, durationTargetMin, status,
  participants: [
    { userId, joinedAt, leftAt, completed, targetHit }
  ]
  // embedded because participant lists are read/written together with the session
  // and bounded (a room isn't going to have millions of participants)
}

// pointsLedger
{ _id, userId, source, amount, timestamp }
// append-only — never mutate existing docs

// badges
{ _id, name, description, criteriaType, criteriaValue }
// static-ish catalog collection, config-driven so new badges don't need a deploy

// friendships
{ _id, userIdA, userIdB, status: "pending"|"accepted"|"declined", requestedBy, createdAt }

// reactions
{ _id, sessionId, fromUserId, toUserId, type: "clap"|"fire"|"fist_bump", createdAt }

// mascotEvents
{ _id, userId, eventType, payload: {}, priority, deliveredAt: null, sourceService }
// queue-like collection the Mascot Engine reads from; mark deliveredAt once shown

// notifications
{ _id, userId, type, copyVariantId, scheduledAt, sentAt: null, openedAt: null }

// reports
{ _id, reporterId, reportedUserId, sessionId: null, reason, createdAt, status }

// subscriptions   -- Phase 4, not before
{ userId, plan, status, renewsAt, platform }

// externalIntegrations  -- later
{ userId, provider, externalId, connectedAt }
```

**Indexing notes for Phase 2:** index `sessions.categoryId + status` (for the session-hub browse query), `mascotEvents.userId + deliveredAt` (fetch-next-undelivered), and `friendships.userIdA + userIdB` (friendship lookups both directions).

---

## 6. Screen-to-data mapping (for Phase 1 mock fixtures)

Build mock fixture data matching these shapes so Phase 2 is a clean swap:

- **Home/Mascot screen** → needs a mock `mascotEvents`-shaped object + a mock `users.streak` object
- **Session Hub** → needs a mock array of `sessions` (with fake live `participants` counts) grouped by `sessionCategories`
- **Session Room** → needs one mock `sessions` doc with a few fake `participants`
- **Profile/Stats** → needs mock `users` doc + mock `pointsLedger` slice + mock `badges`
- **Friends screen** → needs mock `friendships` array in various statuses

---

## 7. Reference docs (companion files — see project's `/docs` folder or prior deliverables)

- **Full architecture & original data model (Postgres version, superseded by §5 above for DB choice, still useful for the service/API breakdown and gamification rules):** `prodify_full_architecture.md`
- **Mascot visual design + Lottie animation prompts (Clash-of-Clans-referenced style, 10 situational states):** `prodify_mascot_prompts.md`
- **Original concept/market outline:** `prodify_outline.md`

---

## 8. Mascot quote library (for Phase 1 popup/message UI — hardcode these as local fixtures for now)

Pull directly from the situational set already designed (onboarding, welcome-back, streak-at-risk, celebration, session-complete, missed-target, badge-earned, friend-update, level-up, idle). Full text lives in `prodify_full_architecture.md` §7 — copy the relevant array into a local `mascotQuotes.ts` fixture file for Phase 1, then have the real Mascot Engine (Phase 2+) serve from the same source so copy never has to be duplicated/maintained in two places long-term.

---

## 9. Conventions for whoever (or whatever agent) builds this

- Keep mock data in a clearly separated `mocks/` or `fixtures/` folder — never inline fake data directly inside components, so removing mocks in Phase 2 is mechanical.
- Every screen built in Phase 1 should already assume its eventual data shape from §5/§6 — don't invent ad hoc shapes that will need remapping later.
- Animation-heavy moments (streak milestone, level-up, badge earned) deserve more build/polish time than routine moments (idle, session join) — matches the priority order already set in the mascot/Lottie doc.
- Don't build the subscription/paywall screen with real logic in Phase 1 — a hidden/flagged-off placeholder is enough for now.