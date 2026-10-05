// Weekly recap extras that the daily-minutes fixture can't express — in
// Phase 2 these come from aggregating the week's `sessions` docs (top
// categoryId by minutes, distinct co-present friends via shared spaceId,
// count of completed sessions). Minutes per day reuse weeklyActivity.mock.
export const mockWeeklyRecapExtras = {
  topCategoryId: 'cat_coding',
  sessionsCompleted: 11,
  spacesJoined: 6,
  focusedWithFriendIds: ['user_seed_riya', 'user_seed_meera', 'user_seed_kabir'],
  cheersReceived: 14,
};
