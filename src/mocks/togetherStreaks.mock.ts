import type { TogetherStreak } from '../types/social';
import { localDayKey } from '../utils/togetherStreak';

const daysAgoKey = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDayKey(d);
};

// Together streaks with each friend, keyed by friend userId. Riya and
// Meera's are alive (last shared day was yesterday — today's space keeps
// them going), Arjun's lapsed, Kabir's hasn't started.
export const mockTogetherStreaks: Record<string, TogetherStreak> = {
  user_seed_riya: { current: 4, longest: 6, lastTogetherDate: daysAgoKey(1) },
  user_seed_meera: { current: 9, longest: 9, lastTogetherDate: daysAgoKey(1) },
  user_seed_arjun: { current: 3, longest: 5, lastTogetherDate: daysAgoKey(4) },
};
