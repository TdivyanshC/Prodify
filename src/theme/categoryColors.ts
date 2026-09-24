// Per-theme identity colors — purely for visual variety/scannability on
// session/theme cards (accent stripes, icon-chip tints). Deliberately kept
// out of the brand palette proper: these never drive interactive elements
// (buttons stay brand violet) and are chosen to stay clear of the
// semantic tokens (success/warning/error) and of accentGold, which stays
// reserved for badges/streaks/level-ups per claude.md §3a.
export const CATEGORY_COLORS: Record<string, string> = {
  cat_study: '#60A5FA',
  cat_coding: '#818CF8',
  cat_work: '#F472B6',
  cat_fitness: '#FB923C',
  cat_move: '#4ADE80',
  cat_wellness: '#2DD4BF',
  cat_creative: '#E879F9',
  cat_growth: '#22D3EE',
};

export function getCategoryColor(categoryId: string | undefined, fallback: string): string {
  if (!categoryId) return fallback;
  return CATEGORY_COLORS[categoryId] ?? fallback;
}
