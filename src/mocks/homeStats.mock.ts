// Daily/aggregate stats for the Home gamification card (architecture §1
// §3/§19). In a real backend these are computed from `sessions` +
// `pointsLedger`, not stored on the user doc — kept here as a distinct
// mock/aggregate view rather than bolted onto the locked `User` schema.
export const mockHomeStats = {
  productiveMinutesToday: 165, // 2h 45m
  dailyTargetMinutes: 180, // 3h — today's-goal progress bar on the Home hero card
  xpToday: 340,
  sessionsCompletedTotal: 12, // lifetime — drives Spark's personality tier (§10)
};
