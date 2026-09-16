import { mockMascotEvents } from '../mocks/mascotEvents.mock';
import { mascotQuotes, MascotQuoteCategory } from '../mocks/mascotQuotes';
import { mockUser } from '../mocks/user.mock';
import type { MascotEvent, MascotEventType } from '../types/models';

// Priority order per claude.md §4: streak-at-risk-today > new badge/level-up
// > friend's significant achievement > welcome-back-after-inactivity >
// generic encouragement > idle. In Phase 2 this selection logic moves
// server-side (Mascot Engine reading the mascotEvents queue); this mock
// mirrors that contract so the swap is behavioral, not structural.
const PRIORITY_ORDER: MascotEventType[] = [
  'streak_at_risk',
  'badge_earned',
  'level_up',
  'friend_achievement',
  'welcome_back',
  'generic_encouragement',
  'idle',
];

// generic_encouragement has no dedicated bucket in the placeholder quote
// library (see mascotQuotes.ts) — reusing "celebration" until the real
// library in prodify_full_architecture.md §7 defines one.
const EVENT_TYPE_TO_QUOTE_CATEGORY: Record<MascotEventType, MascotQuoteCategory> = {
  streak_at_risk: 'streakAtRisk',
  badge_earned: 'badgeEarned',
  level_up: 'levelUp',
  friend_achievement: 'friendUpdate',
  welcome_back: 'welcomeBack',
  generic_encouragement: 'celebration',
  idle: 'idle',
};

export interface MascotMessage {
  event: MascotEvent | null;
  eventType: MascotEventType;
  quote: string;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Phase 1: selects from local fixture events. Phase 2: swap for a fetch to
// GET /api/mascot/next-message — the returned shape stays identical.
export async function getNextMascotMessage(
  userId: string = mockUser._id
): Promise<MascotMessage> {
  const undelivered = mockMascotEvents.filter(
    (event) => event.userId === userId && event.deliveredAt === null
  );

  const highestPriorityEvent = PRIORITY_ORDER.map((type) =>
    undelivered.find((event) => event.eventType === type)
  ).find((event): event is MascotEvent => Boolean(event));

  const eventType = highestPriorityEvent?.eventType ?? 'idle';
  const quoteCategory = EVENT_TYPE_TO_QUOTE_CATEGORY[eventType];
  const quote = pickRandom(mascotQuotes[quoteCategory]);

  return {
    event: highestPriorityEvent ?? null,
    eventType,
    quote,
  };
}
