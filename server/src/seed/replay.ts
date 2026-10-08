import { advanceTogether, creditDay, crossedBadges, emptyStreak, rolloverDay, type StreakEvent, type StreakState } from '../lib/progress';
import {
  creditThreshold,
  EARLY_BEFORE_HOUR,
  LATE_FROM_HOUR,
  levelFor,
  pairKey,
  sessionCapMin,
  TOGETHER_MIN_OVERLAP_MIN,
  xpFor,
} from '../lib/rules';
import { addDays, dayKey, localHour, minutesBetween, startOfDay } from '../lib/time';
import { BADGES, FRIENDSHIPS, type CatSlug } from './fixtures';
import { friendshipAcceptedAt, type Activity, type RawSession } from './generate';

// Replays generated activity in time order through the same rules the
// Phase 2 session-close transaction runs (backend doc §7.3) and the
// dayRollover job (§10). Output is what the DB would hold afterwards.

export type ProgressEvent =
  | { type: 'badge_earned'; at: Date; badgeKey: string }
  | { type: 'level_up'; at: Date; level: number }
  | { type: 'freeze_earned'; at: Date; streak: number; count: number }
  | { type: 'freeze_used'; at: Date; streak: number; freezesUsed: number }
  | { type: 'streak_milestone'; at: Date; streak: number };

export interface DayTotals {
  total: number;
  xp: number;
  count: number;
  byCat: Map<CatSlug, { minutes: number; count: number; xp: number }>;
}

export interface UserState {
  points: number;
  level: number;
  streak: StreakState;
  rolloverThrough: string | null; // last local day the dayRollover job has evaluated
  counters: { sessionsCompleted: number; earlySessions: number; lateSessions: number; friends: number };
  badges: { key: string; at: Date }[];
  daily: Map<string, DayTotals>;
  credited: Map<string, Date>; // day → when it got credited
  // Streak value at the start of each local day (after that midnight's rollover).
  streakAtDayStart: Map<string, number>;
  ledger: { source: 'session_complete' | 'badge'; amount: number; sessionKey?: string; badgeKey?: string; at: Date }[];
  events: ProgressEvent[];
}

export interface ClosedSession {
  durationMin: number;
  xpEarned: number;
  targetHit: boolean;
  dayKey: string;
  closedReason: 'completed' | 'left';
}

export interface TogetherState {
  users: [string, string];
  current: number;
  longest: number;
  lastTogetherDay: string;
}

export interface ReplayResult {
  states: Map<string, UserState>;
  closed: Map<string, ClosedSession>;
  together: Map<string, TogetherState>;
}

type TimelineItem =
  | { at: Date; order: 0; kind: 'rollover'; user: string; day: string }
  | { at: Date; order: 1; kind: 'friend'; users: [string, string] }
  | { at: Date; order: 2; kind: 'close'; session: RawSession };

export function replay(activity: Activity): ReplayResult {
  const { users, sessions, now } = activity;
  const states = new Map<string, UserState>();
  const closed = new Map<string, ClosedSession>();
  const together = new Map<string, TogetherState>();

  const timeline: TimelineItem[] = [];
  for (const u of users.values()) {
    states.set(u.key, {
      points: 0,
      level: 1,
      streak: emptyStreak(),
      rolloverThrough: null,
      counters: { sessionsCompleted: 0, earlySessions: 0, lateSessions: 0, friends: 0 },
      badges: [],
      daily: new Map(),
      credited: new Map(),
      streakAtDayStart: new Map([[dayKey(u.createdAt, u.tz), 0]]),
      ledger: [],
      events: [],
    });
    for (let day = dayKey(u.createdAt, u.tz); day < u.today; day = addDays(day, 1)) {
      timeline.push({ at: startOfDay(addDays(day, 1), u.tz), order: 0, kind: 'rollover', user: u.key, day });
    }
  }
  for (const f of FRIENDSHIPS) {
    const at = friendshipAcceptedAt(f.a, f.b, now);
    if (at) timeline.push({ at, order: 1, kind: 'friend', users: [f.a, f.b] });
  }
  for (const s of sessions) if (s.end) timeline.push({ at: s.end, order: 2, kind: 'close', session: s });
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order);

  const catalog = BADGES.map((b) => ({ _id: b.key, criteriaType: b.criteriaType, criteriaValue: b.criteriaValue }));
  const checkBadges = (user: string, criteria: (typeof BADGES)[number]['criteriaType'], before: number, after: number, at: Date) => {
    const state = states.get(user)!;
    for (const badgeKey of crossedBadges(catalog, criteria, before, after, state.badges.map((b) => b.key))) {
      state.badges.push({ key: badgeKey, at });
      state.ledger.push({ source: 'badge', amount: 0, badgeKey, at });
      state.events.push({ type: 'badge_earned', at, badgeKey });
    }
  };
  const recordStreakEvents = (state: UserState, events: StreakEvent[], at: Date) => {
    for (const e of events) state.events.push({ ...e, at } as ProgressEvent);
  };

  for (const item of timeline) {
    if (item.kind === 'rollover') {
      const state = states.get(item.user)!;
      const { next, events } = rolloverDay(state.streak, item.day);
      state.streak = next;
      state.rolloverThrough = item.day;
      recordStreakEvents(state, events, item.at);
      state.streakAtDayStart.set(addDays(item.day, 1), next.current);
      continue;
    }

    if (item.kind === 'friend') {
      for (const user of item.users) {
        const state = states.get(user)!;
        state.counters.friends += 1;
        checkBadges(user, 'friend_count', state.counters.friends - 1, state.counters.friends, item.at);
      }
      continue;
    }

    // ── Session close (backend doc §7.3) ──
    const session = item.session;
    const u = users.get(session.user)!;
    const state = states.get(session.user)!;
    const at = session.end!;
    const durationMin = Math.min(Math.round(minutesBetween(session.start, at)), sessionCapMin(session.targetMin));
    const xpEarned = xpFor(durationMin);
    const targetHit = durationMin >= session.targetMin;
    const day = dayKey(at, u.tz);
    closed.set(session.key, { durationMin, xpEarned, targetHit, dayKey: day, closedReason: targetHit ? 'completed' : 'left' });

    state.ledger.push({ source: 'session_complete', amount: xpEarned, sessionKey: session.key, at });
    const pointsBefore = state.points;
    state.points += xpEarned;
    state.counters.sessionsCompleted += 1;
    checkBadges(session.user, 'sessions_completed', state.counters.sessionsCompleted - 1, state.counters.sessionsCompleted, at);
    const startHour = localHour(session.start, u.tz);
    if (startHour < EARLY_BEFORE_HOUR) {
      state.counters.earlySessions += 1;
      checkBadges(session.user, 'early_sessions', state.counters.earlySessions - 1, state.counters.earlySessions, at);
    }
    if (startHour >= LATE_FROM_HOUR) {
      state.counters.lateSessions += 1;
      checkBadges(session.user, 'late_sessions', state.counters.lateSessions - 1, state.counters.lateSessions, at);
    }

    const totals = state.daily.get(day) ?? { total: 0, xp: 0, count: 0, byCat: new Map() };
    totals.total += durationMin;
    totals.xp += xpEarned;
    totals.count += 1;
    const cat = totals.byCat.get(session.category) ?? { minutes: 0, count: 0, xp: 0 };
    cat.minutes += durationMin;
    cat.count += 1;
    cat.xp += xpEarned;
    totals.byCat.set(session.category, cat);
    state.daily.set(day, totals);

    // Streak: credit the local day once, on the daily total (CLAUDE.md §4).
    if (!state.credited.has(day) && totals.total >= creditThreshold(u.persona.dailyTargetMin)) {
      const before = state.streak.current;
      const { next, events, credited } = creditDay(state.streak, day);
      if (credited) {
        state.credited.set(day, at);
        state.streak = next;
        checkBadges(session.user, 'streak', before, next.current, at);
        recordStreakEvents(state, events, at);
      }
    }

    // Together streaks (§7.4): closer's day credited, same space, ≥10 min overlap, friends.
    if (session.spaceKey && state.credited.has(day)) {
      for (const other of sessions) {
        if (other.spaceKey !== session.spaceKey || other.user === session.user || other.start >= at) continue;
        const overlapStart = other.start > session.start ? other.start : session.start;
        const overlapEnd = other.end && other.end < at ? other.end : at;
        if (minutesBetween(overlapStart, overlapEnd) < TOGETHER_MIN_OVERLAP_MIN) continue;
        const since = friendshipAcceptedAt(session.user, other.user, now);
        if (!since || since > at) continue;
        const key = pairKey(session.user, other.user);
        const advanced = advanceTogether(together.get(key) ?? null, day);
        if (!advanced) continue;
        together.set(key, { users: [session.user, other.user].sort() as [string, string], ...advanced });
      }
    }

    checkBadges(session.user, 'total_xp', pointsBefore, state.points, at);
    const level = levelFor(state.points);
    if (level > state.level) {
      state.level = level;
      state.events.push({ type: 'level_up', at, level });
    }
  }

  return { states, closed, together };
}
