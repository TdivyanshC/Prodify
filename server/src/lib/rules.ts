// Progress rules — the server's copy of CLAUDE.md §4 + backend doc §7.
// Pure functions only; these move to packages/shared/rules/ once that
// package exists so the app and server stop computing them separately
// (backend doc §3 C1/C2).

// CLAUDE.md §4: 50 XP per hour clocked, identical for solo and Space.
export const XP_PER_HOUR = 50;
export const xpFor = (durationMin: number) => Math.floor((durationMin / 60) * XP_PER_HOUR);

// A day counts once the daily total reaches 50% of the target (full credit at 100%).
export const creditThreshold = (dailyTargetMin: number) => Math.ceil(dailyTargetMin * 0.5);

export const FREEZE_EVERY_N_DAYS = 7;
export const MAX_FREEZES = 3;

// PROVISIONAL (backend doc open decision D3) — a flat curve, served to the app
// via user.levelProgress until a real one is picked.
export const XP_PER_LEVEL = 250;
export const levelFor = (points: number) => Math.floor(points / XP_PER_LEVEL) + 1;
// XP where a level starts / the next one starts — drives level-progress bars.
export const levelStartXp = (level: number) => (level - 1) * XP_PER_LEVEL;
export const nextLevelXp = (level: number) => level * XP_PER_LEVEL;

// PROVISIONAL — mascotStage thresholds by level (D3).
const STAGE_FROM_LEVEL = [1, 5, 12, 25, 40];
export const stageFor = (level: number) => STAGE_FROM_LEVEL.filter((min) => level >= min).length;

// Badge counters (backend doc §7.5): local start hour before 09:00 / from 22:00.
export const EARLY_BEFORE_HOUR = 9;
export const LATE_FROM_HOUR = 22;

// Friend streak milestones worth a friend_milestone notification.
export const STREAK_MILESTONES = [7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

// Together streak: same space, ≥10 min overlap, closer's day credited (§7.4).
export const TOGETHER_MIN_OVERLAP_MIN = 10;

// Session credit cap (§7.2).
export const sessionCapMin = (targetMin: number) => Math.min(360, Math.max(targetMin * 1.5, targetMin + 60));

// Space completes once it has been empty this long (§6.1).
export const SPACE_EMPTY_GRACE_MIN = 5;

export const pairKey = (a: string, b: string) => (a < b ? `${a}_${b}` : `${b}_${a}`);
