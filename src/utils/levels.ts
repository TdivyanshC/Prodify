// PROVISIONAL — claude.md doesn't define a level curve yet (only that
// mascotStage evolves with level, §5). A flat 250 XP per level keeps
// level-ups reachable in Phase 1 mocks; swap this one function when the
// real curve is decided and every caller follows.
export const XP_PER_LEVEL = 250;

export function getLevel(points: number): number {
  return Math.floor(points / XP_PER_LEVEL) + 1;
}
