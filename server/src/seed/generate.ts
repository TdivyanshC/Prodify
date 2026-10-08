import type { ObjectId } from 'mongodb';
import { hashInt, oid } from '../lib/ids';
import { createRng, type Rng } from '../lib/rng';
import { addDays, addMinutes, DAY, dayKey, MINUTE, minutesBetween, startOfDay, zonedTime } from '../lib/time';
import {
  FRIENDSHIPS,
  PERSONAS,
  RECURRING_SPACES,
  SCRIPTED_SOLO,
  SCRIPTED_SPACES,
  type CatSlug,
  type DayType,
  type Persona,
} from './fixtures';

// Raw activity: who clocked what, where, when. No derived numbers yet —
// replay.ts turns this into points/streaks/rollups exactly the way the
// Phase 2 close transaction would.

export interface UserCtx {
  key: string;
  id: ObjectId;
  persona: Persona;
  tz: string;
  today: string; // local day key at seed time
  createdAt: Date;
}

export interface RawSpace {
  key: string;
  name: string;
  description: string | null;
  host: string | null;
  category: CatSlug;
  isPublic: boolean;
  targetMin: number;
  maxParticipants: number | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  startTime: Date;
  endedAt: Date | null;
  invited: string[];
  isBotSeeded: boolean;
  syntheticCount: number;
  createdAt: Date;
  reminders: string[];
}

export interface RawSession {
  key: string;
  user: string;
  category: CatSlug;
  spaceKey: string | null;
  start: Date;
  end: Date | null; // null = open right now
  targetMin: number;
  scripted: boolean;
}

export interface RawReaction {
  contextType: 'space' | 'milestone';
  contextKey: string; // space key, or the milestone context id
  from: string;
  to: string;
  type: 'clap' | 'fire' | 'fist_bump';
  at: Date;
}

export interface Activity {
  now: Date;
  users: Map<string, UserCtx>;
  plans: Map<string, Map<string, DayType>>;
  spaces: RawSpace[];
  sessions: RawSession[];
  reactions: RawReaction[];
}

const REACTION_TYPES = ['clap', 'fire', 'fist_bump'] as const;

export function friendshipAcceptedAt(a: string, b: string, now: Date): Date | null {
  const def = FRIENDSHIPS.find((f) => f.status === 'accepted' && ((f.a === a && f.b === b) || (f.a === b && f.b === a)));
  return def?.respondedDaysAgo !== undefined ? new Date(now.getTime() - def.respondedDaysAgo * DAY) : null;
}

export function areFriendsAt(a: string, b: string, at: Date, now: Date): boolean {
  const since = friendshipAcceptedAt(a, b, now);
  return since !== null && since <= at;
}

function bandFor(type: DayType, target: number): [number, number] {
  const half = Math.ceil(target * 0.5);
  switch (type) {
    case 'C':
      return [target, Math.round(target * 1.4)];
    case 'H':
      return [half + 1, Math.max(half + 1, Math.round(target * 0.95))];
    case 'L':
      return [10, Math.max(10, half - 5)];
    case 'N':
      return [0, 0];
  }
}

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;

export function generateActivity(now: Date): Activity {
  const users = new Map<string, UserCtx>();
  for (const persona of PERSONAS) {
    const today = dayKey(now, persona.timezone);
    users.set(persona.key, {
      key: persona.key,
      id: oid(`user:${persona.key}`),
      persona,
      tz: persona.timezone,
      today,
      createdAt: zonedTime(addDays(today, -persona.accountAgeDays), 8, 0, persona.timezone),
    });
  }

  // ── Day plans ───────────────────────────────────────────────────────────
  const plans = new Map<string, Map<string, DayType>>();
  const rngs = new Map<string, Rng>();
  for (const u of users.values()) {
    const rng = createRng(hashInt(`plan:${u.key}`));
    rngs.set(u.key, createRng(hashInt(`activity:${u.key}`)));
    const plan = new Map<string, DayType>();
    const recent = u.persona.recent;
    for (let k = u.persona.accountAgeDays - 1; k >= 1; k--) {
      const day = addDays(u.today, -k);
      const fromRecent = k <= recent.length ? (recent[recent.length - k] as DayType) : null;
      plan.set(day, fromRecent ?? rng.weighted(u.persona.odds));
    }
    plans.set(u.key, plan);
  }

  const sessions: RawSession[] = [];
  const spaces: RawSpace[] = [];
  const reactions: RawReaction[] = [];
  // Minutes already clocked per user-day, and per-user busy intervals.
  const used = new Map<string, number>();
  const busy = new Map<string, { start: Date; end: Date }[]>();
  const usedKey = (user: string, day: string) => `${user}|${day}`;
  const isFree = (user: string, start: Date, end: Date) =>
    !(busy.get(user) ?? []).some((b) => overlaps(start, end, b.start, b.end));
  const addSession = (s: RawSession) => {
    sessions.push(s);
    if (s.end) {
      const u = users.get(s.user)!;
      const day = dayKey(s.end, u.tz);
      used.set(usedKey(s.user, day), (used.get(usedKey(s.user, day)) ?? 0) + Math.round(minutesBetween(s.start, s.end)));
    }
    const list = busy.get(s.user) ?? [];
    list.push({ start: s.start, end: s.end ?? new Date(8.64e15) });
    busy.set(s.user, list);
  };
  const capacity = (user: string, day: string) => {
    const type = plans.get(user)?.get(day);
    if (!type || type === 'N') return 0;
    return bandFor(type, users.get(user)!.persona.dailyTargetMin)[1] - (used.get(usedKey(user, day)) ?? 0);
  };

  // ── Scripted "right now" first, so history yields to it on overlap ──────
  for (const def of SCRIPTED_SPACES) {
    const start = addMinutes(now, def.startOffsetMin);
    const spaceSessions = def.sessions.map((s, i) => ({
      key: `sess:${def.key}:${s.user}:${i}`,
      user: s.user,
      category: def.category,
      spaceKey: `space:${def.key}`,
      start: addMinutes(now, s.startOffsetMin),
      end: s.endOffsetMin === null ? null : addMinutes(now, s.endOffsetMin),
      targetMin: def.targetMin,
      scripted: true,
    }));
    spaceSessions.forEach(addSession);
    const lastEnd = spaceSessions.reduce<Date | null>((max, s) => (s.end && (!max || s.end > max) ? s.end : max), null);
    spaces.push({
      key: `space:${def.key}`,
      name: def.name,
      description: def.description,
      host: def.host,
      category: def.category,
      isPublic: def.isPublic,
      targetMin: def.targetMin,
      maxParticipants: def.maxParticipants,
      status: def.status,
      startTime: start,
      endedAt:
        def.status === 'completed' && lastEnd
          ? addMinutes(lastEnd, 5)
          : def.status === 'cancelled'
            ? addMinutes(start, 30)
            : null,
      invited: def.invited,
      isBotSeeded: def.host === null,
      syntheticCount: def.syntheticCount ?? 0,
      createdAt:
        def.status === 'scheduled' || def.status === 'cancelled' ? new Date(Math.min(now.getTime() - 3 * 60 * MINUTE, start.getTime() - DAY)) : start,
      reminders: def.reminders ?? [],
    });
    for (const r of def.reactions) {
      reactions.push({ contextType: 'space', contextKey: `space:${def.key}`, from: r.from, to: r.to, type: r.type, at: addMinutes(now, r.atOffsetMin) });
    }
  }
  for (const solo of SCRIPTED_SOLO) {
    addSession({
      key: `sess:${solo.key}`,
      user: solo.user,
      category: solo.category,
      spaceKey: null,
      start: addMinutes(now, solo.startOffsetMin),
      end: solo.endOffsetMin === null ? null : addMinutes(now, solo.endOffsetMin),
      targetMin: solo.targetMin,
      scripted: true,
    });
  }

  // ── Recurring spaces on earlier days ────────────────────────────────────
  for (const def of RECURRING_SPACES) {
    const host = users.get(def.host)!;
    const rng = createRng(hashInt(`space:${def.key}`));
    for (const k of def.hostDays) {
      const start = zonedTime(addDays(host.today, -k), def.hour, def.minute, host.tz);
      if (start < host.createdAt || start >= now) continue;
      const spaceKey = `space:${def.key}:d${k}`;
      const candidates = [
        { user: def.host, join: start },
        ...def.attendees.filter((a) => a.days.includes(k)).map((a) => ({ user: a.user, join: addMinutes(start, rng.int(1, 8)) })),
      ];
      const placed: RawSession[] = [];
      for (const c of candidates) {
        const u = users.get(c.user)!;
        if (c.join < u.createdAt) continue;
        const day = dayKey(c.join, u.tz);
        const length = Math.min(Math.round(def.targetMin * rng.float(0.75, 1.15)), capacity(c.user, day));
        if (length < 10) {
          if (c.user === def.host) break; // no host, no space that day
          continue;
        }
        const end = addMinutes(c.join, length);
        if (!isFree(c.user, c.join, end) || end > now) {
          if (c.user === def.host) break;
          continue;
        }
        const session: RawSession = { key: `sess:${spaceKey}:${c.user}`, user: c.user, category: def.category, spaceKey, start: c.join, end, targetMin: def.targetMin, scripted: false };
        addSession(session);
        placed.push(session);
      }
      if (placed.length === 0 || placed[0].user !== def.host) {
        // Host never made it — undo any guest sessions placed for this day.
        for (const s of placed) removeSession(s);
        continue;
      }
      const lastEnd = placed.reduce((max, s) => (s.end! > max ? s.end! : max), placed[0].end!);
      spaces.push({
        key: spaceKey,
        name: def.name,
        description: def.description,
        host: def.host,
        category: def.category,
        isPublic: def.isPublic,
        targetMin: def.targetMin,
        maxParticipants: def.maxParticipants,
        status: 'completed',
        startTime: start,
        endedAt: addMinutes(lastEnd, 5),
        invited: def.isPublic ? [] : def.attendees.filter((a) => a.days.includes(k)).map((a) => a.user),
        isBotSeeded: false,
        syntheticCount: 0,
        createdAt: addMinutes(start, -rng.int(0, 90)),
        reminders: [],
      });
      // Cheers between people who overlapped (friends-only rule is enforced
      // by the API at send time; historically only friends cheered).
      for (const x of placed) {
        for (const y of placed) {
          if (x === y || !rng.chance(0.3)) continue;
          const from = x.start > y.start ? x.start : y.start;
          const to = x.end! < y.end! ? x.end! : y.end!;
          if (minutesBetween(from, to) < 5 || !areFriendsAt(x.user, y.user, from, now)) continue;
          reactions.push({
            contextType: 'space',
            contextKey: spaceKey,
            from: x.user,
            to: y.user,
            type: rng.pick(REACTION_TYPES),
            at: addMinutes(from, rng.int(1, Math.floor(minutesBetween(from, to)) - 1)),
          });
        }
      }
    }
  }

  function removeSession(s: RawSession) {
    sessions.splice(sessions.indexOf(s), 1);
    const list = busy.get(s.user)!;
    list.splice(list.findIndex((b) => b.start === s.start), 1);
    const u = users.get(s.user)!;
    const day = dayKey(s.end!, u.tz);
    used.set(usedKey(s.user, day), (used.get(usedKey(s.user, day)) ?? 0) - Math.round(minutesBetween(s.start, s.end!)));
  }

  // ── Solo sessions fill each day up to its planned minutes ───────────────
  for (const u of users.values()) {
    const rng = rngs.get(u.key)!;
    for (const [day, type] of plans.get(u.key)!) {
      if (type === 'N') continue;
      const [min, max] = bandFor(type, u.persona.dailyTargetMin);
      const planned = rng.int(min, max);
      let remaining = planned - (used.get(usedKey(u.key, day)) ?? 0);
      if (remaining < 10) continue;
      const chunks = remaining < 45 ? 1 : remaining < 120 ? 2 : 3;
      const dayStart = startOfDay(day, u.tz);
      const dayEnd = startOfDay(addDays(day, 1), u.tz);
      let cursor = zonedTime(day, u.persona.soloFromHour, rng.int(0, 45), u.tz);
      for (let i = 0; i < chunks && remaining >= 10; i++) {
        const length = i === chunks - 1 ? remaining : Math.max(10, Math.round((remaining / (chunks - i)) * rng.float(0.8, 1.2)));
        const start = findSlot(u.key, cursor, dayStart, dayEnd, length, u.createdAt);
        if (!start) break;
        const end = addMinutes(start, length);
        addSession({
          key: `sess:solo:${u.key}:${day === u.today ? 'today' : `d${dayDiff(u.today, day)}`}:${i}`,
          user: u.key,
          category: rng.weighted(u.persona.categories),
          spaceKey: null,
          start,
          end,
          targetMin: Math.max(15, Math.round((length * rng.float(0.8, 1.25)) / 5) * 5),
          scripted: false,
        });
        remaining -= length;
        cursor = addMinutes(end, rng.int(20, 120));
      }
    }
  }

  function findSlot(user: string, preferred: Date, dayStart: Date, dayEnd: Date, length: number, notBefore: Date): Date | null {
    const latestEnd = new Date(Math.min(dayEnd.getTime() - 2 * MINUTE, now.getTime() - MINUTE));
    const tryAt = (start: Date) => {
      const end = addMinutes(start, length);
      return start >= notBefore && start >= dayStart && end <= latestEnd && isFree(user, start, end);
    };
    for (let t = preferred; addMinutes(t, length) <= latestEnd; t = addMinutes(t, 15)) if (tryAt(t)) return t;
    for (let t = addMinutes(dayStart, 6 * 60); t < preferred; t = addMinutes(t, 15)) if (tryAt(t)) return t;
    return null;
  }

  sessions.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { now, users, plans, spaces, sessions, reactions };
}

function dayDiff(today: string, day: string): number {
  return Math.round((Date.parse(today) - Date.parse(day)) / DAY);
}
