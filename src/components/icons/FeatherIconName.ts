// Narrow union of only the Feather glyph names this app actually uses,
// rather than the full (huge) icon set typing. Thematic/playful bits
// (theme icons, streak/XP/badge counts) use emoji directly per the
// architecture doc's own examples — Feather is reserved for functional
// controls (nav, buttons).
export type FeatherIconName =
  | 'home'
  | 'compass'
  | 'plus'
  | 'plus-circle'
  | 'users'
  | 'user-plus'
  | 'user-minus'
  | 'bar-chart-2'
  | 'award'
  | 'user'
  | 'bell'
  | 'search'
  | 'x'
  | 'flag'
  | 'settings'
  | 'log-out'
  | 'chevron-right'
  | 'arrow-left'
  | 'arrow-right'
  | 'check';
