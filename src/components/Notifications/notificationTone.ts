import { colors } from '../../theme';
import type { NotificationTone } from '../../types/social';

// Accent stripe per tone: gold only for rewards (claude.md §3a), amber
// `warning` for gentle nudges (never `error` red), teal for everything else.
export const TONE_ACCENT: Record<NotificationTone, string> = {
  default: colors.primary,
  reward: colors.accentGold,
  nudge: colors.warning,
};
