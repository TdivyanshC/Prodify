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

## 3a. Design System — Deep Focus Theme v3 (locked)

Goal: the app should feel like something a user would pay for, not a free utility. Dark-first UI, teal/emerald as the brand color, with a warm gold accent reserved exclusively for premium/reward moments (badges, streaks, level-ups, subscription screen) so it stays special rather than diluted.

**v3 revision note:** after v1/v2 shipped a violet brand color, we ran a side-by-side comparison of four full palettes against the same built Home screen — Midnight Violet (the v2 palette, kept as the neutral baseline), Royal Indigo (bluer/cooler violet), Ember Plum (warmer magenta/fuchsia), and Deep Focus (teal/emerald, leaving the violet family entirely). Deep Focus won: a teal/emerald brand color is the color family most associated with calm/focus/productivity tools (Notion, Todoist, Forest, RescueTime), and it reads as "focus tool" rather than "game," which matches the product identity's "Focus first, gamification second" ordering (§3b) better than any shade of violet did. `accentGold` and the semantic tokens (`success`/`warning`/`error`) were held constant across all four candidates during the comparison so the decision isolated the brand-hue question — they're unchanged here. The rejected palettes are kept as data in `src/theme/palettes.ts` (not deleted) in case the brand hue is ever revisited; `src/theme/activeTheme.ts` is the single switch point if so — see that file's header comment for how to preview a different one.

**Color tokens:**
```js
// theme/colors.ts (resolved from src/theme/palettes.ts → palettes.deepFocus)
export const colors = {
  background: "#071716",       // deepest — teal-black, not neutral gray-black
  surface: "#0F211F",          // structural surface (cards' resting state)
  surfaceElevated: "#15302C",  // one step up — modals, the "hero" card
  surfaceMuted: "#122622",     // pills/chips/inactive chrome — quieter than surface
  primary: "#14B8A6",          // brand teal — reserved for real CTAs/active states
  primaryDeep: "#0F766E",      // gradients, pressed states
  primaryLight: "#5EEAD4",     // highlights, active states
  primarySoft: "rgba(20, 184, 166, 0.18)", // tinted backgrounds for active/selected chrome
  accentGold: "#F2B705",       // RESERVED: badges, streak flame, level-up, subscription CTA only
  textPrimary: "#F0FBFA",      // near-white, teal-tinted
  textSecondary: "#93B4AF",    // muted teal-gray for calmer hierarchy
  textMuted: "#547873",
  border: "#1C3733",           // low-contrast, restrained
  borderStrong: "#2A4F49",     // elements needing a touch more edge definition
  sheen: "rgba(255, 255, 255, 0.10)", // top-edge gloss highlight for the 3D button/card treatment
  success: "#34D399",          // soft green — streak safe (kept distinct from `primary` teal)
  warning: "#F59E0B",          // warm amber — streak at risk, gentle nudge, never shaming
  error: "#F87171",            // muted red — true errors only, distinct from warning
};

export const gradients = {
  primary: ["#0F766E", "#5EEAD4"], // buttons, mascot flame glow, premium moments
  wash: ["#12302B", "#0F211F"],    // subtle hero-card/backdrop wash, low contrast
};
```

**Type scale:** `theme/typography.ts` exports `textStyles` (display/h1/h2/h3/body/bodyMedium/bodySmall/label/caption) — a standard scale components spread (`...textStyles.h2`) rather than hand-picking a `fontSize` per label.

**Typography:** headings/mascot speech in Plus Jakarta Sans or General Sans (not the system default — reads unfinished); body text in Inter.

**Shape & elevation:** 16–20px corner radius on cards, 12px on buttons. `shadows.card` is a plain black directional shadow (never colored) for the everyday "raised card" feel; `shadows.glow` is teal-tinted (`shadowColor: "#0F766E"`) and reserved for the 1-2 elements per screen allowed to feel "premium-glowing" (primary CTAs, the floating nav action) — same restraint rule as `accentGold`. Popups and the mascot card use a light frosted-glass blur treatment.

**Discipline rule:** `accentGold` is the entire "premium" signal — if a future contributor reaches for it outside badges/streaks/level-ups/subscription, that's a design regression, not a valid choice. Flag it in review rather than letting it spread. (An earlier task-management detour added a named exception for a "Start Focus" button — that feature was removed in the product-direction reversal at §6a, so the exception no longer applies.)

---

## 3b. Frontend foundation & design direction (locked)

The built Home screen is the visual baseline for the entire app — **do not redesign it**. Every future screen extends this same system; none of them switch to a different palette, corner radius, typography, mascot style, or button language. If a new screen would need to break this system, that's a decision to raise, not to make silently.

**Product identity:** "Focus first. Gamification second." Prodify = a premium productivity app + a lightweight game + a friendly personal companion. It should never feel like a generic admin/SaaS dashboard, a childish edu-app, an overcomplicated RPG, or a social media app.

**Design personality:** warm, encouraging, energetic, playful, premium, focused, friendly. Emotionally engaging without becoming visually noisy.

**Avoid:** excessive glassmorphism, excessive neon, too many gradients, rainbow colors, sharp rectangular cards, tiny text, crowded dashboards, excessive animation. The UI should look polished even with no animation playing.

**Color semantics (do not blur these):**
- Gold (`accentGold`) = streak / XP / achievements / important progress — the "premium" signal (§3a discipline rule)
- Teal (`primary` family) = navigation, interactive UI, primary surfaces, brand identity
- `success` (soft green) = on-track states
- `warning` (amber) = gentle nudges — e.g. streak-at-risk. Not the same token as `error`
- `error` (muted red) = true error states only

**Mascot state-reaction principle:** the mascot reacts to user state (session start → focused/supportive, session complete → proud/celebratory, streak milestone → excited, inactivity → welcoming, missed target → supportive, badge unlocked → proud presentation, level-up → celebration). It never shames — no "you failed / you wasted your day / you broke your streak" language, ever. This is why streak-at-risk uses `warning` (amber), not `error` (red), on the mascot message card.

**Core UX principle:** every screen must answer "what can the user do next?" — the primary action should always be visually obvious. Don't fill a screen just to make it look complete; use whitespace intentionally.

**Responsive targets:** mobile is the first-class target (proportions/spacing of the built Home screen are the reference), but the app must scale cleanly at 320/375/390/430/768/1024/1280/1440px+. Desktop adapts the same visual language into a more spacious layout — it does not just stretch the mobile design.

**Design system discipline:** colors, typography, spacing, radius, shadow, and glow all come from `theme/` tokens (§3a) — components, buttons, cards, inputs, progress bars, badges, modals, nav, mascot containers, and toasts should all pull from the same tokens rather than hardcoding slightly different values per screen.

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
- **Home / Sessions (Explore)** → needs mock `sessionCategories` (the 8 fixed themes) + mock `sessions` (live, multiplayer, with denormalized participant display names/avatars for the mock — see §6a)

**§6a — product direction (locked, superseding an earlier detour):** an earlier architecture-doc pass took the app in a task-management direction (Tasks page, Focus timer, per-task XP) — that was fully built across a few iterations, then explicitly reversed: **Prodify is not a task-management app.** The core loop is live group-session discovery — themes (predefined by Prodify) containing user-created sessions (§1 §14) that people join in real time. All Tasks/Focus code, the `Task` type, and the `Tasks`/`Focus` nav items were removed. `Session`/`SessionCategory` (already in §5) are the real foundation now — `Session` gained additive UI fields (`name`, `description`, `isPublic`, `maxParticipants`, `participantCount`, and denormalized `displayName`/`avatarInitial` on participants) since Phase 1 has no `sessionTemplates` layer yet to resolve a session's display name through. If a future instruction reintroduces task-management framing, flag the conflict with this note before building — don't silently redo the detour.

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