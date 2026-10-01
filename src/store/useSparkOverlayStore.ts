import { create } from 'zustand';
import type { MascotQuoteCategory } from '../mocks/mascotQuotes';
import type { MascotMood } from '../components/Mascot/Mascot';

export type SparkEventKey =
  | 'first_visit'
  | 'session_complete'
  | 'missed_target'
  | 'streak_milestone'
  | 'xp_milestone'
  | 'inactivity'
  | 'friend_activity'
  | 'friends_live'
  | 'returning'
  | 'regular';

// Maps trigger event keys to the quote category that supplies the message
// — kept separate from MascotQuoteCategory since a few event keys (e.g.
// session_complete) may eventually pick between multiple categories.
export const SPARK_EVENT_QUOTE_CATEGORY: Record<SparkEventKey, MascotQuoteCategory> = {
  first_visit: 'onboarding',
  session_complete: 'sessionComplete',
  missed_target: 'missedTarget',
  streak_milestone: 'streakMilestone',
  xp_milestone: 'xpMilestone',
  inactivity: 'welcomeBack',
  friend_activity: 'friendUpdate',
  friends_live: 'friendsLive',
  returning: 'returning',
  regular: 'regular',
};

// Which mood (§1 §11) the overlay shows for each event — the emotional
// tone should match what's being said, not just default to idle breathing.
export const SPARK_EVENT_MOOD: Record<SparkEventKey, MascotMood> = {
  first_visit: 'excited',
  session_complete: 'celebrating',
  // Deliberately calm, not celebratory — never shaming a missed target
  // (claude.md §4).
  missed_target: 'idle',
  streak_milestone: 'celebrating',
  xp_milestone: 'proud',
  inactivity: 'sleepy',
  friend_activity: 'idle',
  friends_live: 'excited',
  returning: 'excited',
  regular: 'proud',
};

interface SparkOverlayState {
  visible: boolean;
  eventKey: SparkEventKey | null;
  vars: Record<string, string | number>;
  // Reusable trigger — architecture §1 §18: "showSpark('session_complete')"
  // etc., callable from anywhere so backend events can eventually drive it.
  showSpark: (eventKey: SparkEventKey, vars?: Record<string, string | number>) => void;
  hide: () => void;
}

export const useSparkOverlayStore = create<SparkOverlayState>((set) => ({
  visible: false,
  eventKey: null,
  vars: {},
  showSpark: (eventKey, vars = {}) => set({ visible: true, eventKey, vars }),
  hide: () => set({ visible: false }),
}));
