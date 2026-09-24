// Aggregate view for Profile's weekly activity chart — in a real backend
// this is computed from `sessions` (grouped by day), not stored anywhere.
// Kept here as a distinct mock/aggregate view rather than bolted onto the
// locked User schema, same treatment as homeStats.mock.ts. Fixture order
// runs Mon→Sun with the last entry always treated as "today" by the chart,
// regardless of the real calendar day.
export const mockWeeklyActivity = [
  { day: 'Mon', minutes: 95 },
  { day: 'Tue', minutes: 140 },
  { day: 'Wed', minutes: 60 },
  { day: 'Thu', minutes: 180 },
  { day: 'Fri', minutes: 110 },
  { day: 'Sat', minutes: 45 },
  { day: 'Sun', minutes: 165 },
];
