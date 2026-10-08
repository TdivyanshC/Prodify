import type { ObjectId } from 'mongodb';
import { dayKey } from '../lib/time';
import type { SeedData } from './assemble';
import { MAIN_USER } from './fixtures';

const hex = (v: unknown) => String(v);

// Human-readable picture of what got seeded — printed by seed, seed:check, seed:verify.
export function summarize(data: SeedData, now: Date): string {
  const lines: string[] = [];
  const users = data.users;
  const nameOf = (id: unknown) => users.find((u) => hex(u._id) === hex(id))?.displayName as string;

  lines.push('Collections:');
  lines.push('  ' + Object.entries(data).map(([k, v]) => `${k} ${v.length}`).join(' · '));
  lines.push('');
  lines.push('Users:');
  for (const u of users) {
    const s = u.streak as Record<string, number | string>;
    const open = data.sessions.find((x) => hex(x.userId) === hex(u._id) && x.status === 'active');
    const openSpace = open?.spaceId ? data.spaces.find((sp) => hex(sp._id) === hex(open.spaceId))?.name : open ? 'solo' : null;
    lines.push(
      `  ${String(u.handle).padEnd(15)} ${String(u.points).padStart(6)} XP  L${u.level}  streak ${s.current}/${s.longest}  ` +
        `freezes ${s.freezesAvailable} (used ${s.freezesUsed})  badges ${(u.badgeIds as unknown[]).length}  ` +
        `sessions ${(u.counters as Record<string, number>).sessionsCompleted}${openSpace ? `  ● live: ${openSpace}` : ''}`
    );
  }

  const main = users.find((u) => u.handle === MAIN_USER)!;
  const mainId = hex(main._id);
  const today = dayKey(now, main.timezone as string);
  const todayTotal = data.userDailyTotal.find((d) => hex(d.userId) === mainId && d.date === today)?.totalMinutes ?? 0;
  lines.push('');
  lines.push(`Main test user: ${main.displayName} (firebaseUid ${main.firebaseUid}, _id ${mainId})`);
  lines.push(`  today ${todayTotal}/${main.dailyTargetMin} min · badges: ${(main.badgeIds as ObjectId[]).map((b) => data.badges.find((x) => hex(x._id) === hex(b))?.key).join(', ')}`);
  const together = data.togetherStreaks
    .filter((t) => (t.userIds as ObjectId[]).some((x) => hex(x) === mainId))
    .map((t) => `${nameOf((t.userIds as ObjectId[]).find((x) => hex(x) !== mainId))} ${t.current} (last ${t.lastTogetherDay})`);
  lines.push(`  together streaks: ${together.join(' · ') || 'none'}`);
  const mine = data.notifications.filter((n) => hex(n.userId) === mainId);
  const byType = new Map<string, number>();
  for (const n of mine) byType.set(n.type as string, (byType.get(n.type as string) ?? 0) + 1);
  lines.push(`  notifications ${mine.length} (${mine.filter((n) => !n.openedAt).length} unread): ${[...byType].map(([t, c]) => `${t}×${c}`).join(', ')}`);
  lines.push('');
  lines.push('Spaces right now:');
  for (const sp of data.spaces.filter((x) => x.status !== 'completed' || (now.getTime() - (x.endedAt as Date).getTime()) < 86_400_000)) {
    const host = sp.hostId ? nameOf(sp.hostId) : 'bot-seeded';
    const count = sp.isBotSeeded ? `${sp.syntheticCount} synthetic` : `${sp.liveCount} live`;
    lines.push(`  [${sp.status}] ${sp.name} · ${host} · ${sp.isPublic ? 'public' : 'friends-only'} · ${count}`);
  }
  return lines.join('\n');
}
