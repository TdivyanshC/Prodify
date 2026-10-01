import type { Session, SessionParticipant } from '../types/models';
import { mockFriendProfiles } from './friends.mock';

const now = Date.now();
const minutesAgo = (n: number) => new Date(now - n * 60 * 1000).toISOString();
const minutesFromNow = (n: number) => new Date(now + n * 60 * 1000).toISOString();

// Built off mockFriendProfiles (not hand-typed names) so a participant's
// userId always matches a real friend profile / friendship record — that's
// what lets the Spaces tab tell "friend who's here" from "someone else".
function participant(userId: string, joinedMinutesAgo: number): SessionParticipant {
  const profile = mockFriendProfiles.find((p) => p._id === userId);
  return {
    userId,
    joinedAt: minutesAgo(joinedMinutesAgo),
    leftAt: null,
    completed: false,
    targetHit: false,
    displayName: profile?.displayName ?? 'Someone',
    avatarInitial: profile?.avatarInitial ?? '·',
  };
}

// Spaces started by the user's accepted friends (claude.md §4: a Space is
// a shared room created by a user, usually with friends). Real people, so
// never bot-seeded. Same `Session` shape as mockLiveSessions — Phase 2
// splits this into a `spaces` doc + per-user `sessions` docs
// (docs/phase2-database-design.md).
export const mockFriendSpaces: Session[] = [
  {
    _id: 'space_riya_graph_sprint',
    categoryId: 'cat_coding',
    templateId: null,
    name: 'Graph Problems Sprint',
    description: 'BFS, DFS, then one hard one. Cameras off, brains on.',
    isPublic: false,
    maxParticipants: 8,
    participantCount: 4,
    type: 'multiplayer',
    hostId: 'user_seed_riya',
    isBotSeeded: false,
    startTime: minutesAgo(18),
    durationTargetMin: 60,
    status: 'active',
    participants: [
      participant('user_seed_riya', 18),
      participant('user_seed_meera', 14),
      participant('user_seed_ishaan', 11),
      participant('user_seed_sara', 6),
    ],
  },
  {
    _id: 'space_kabir_morning_reset',
    categoryId: 'cat_wellness',
    templateId: null,
    name: 'Morning Reset',
    description: 'Stretch, breathe, plan the day.',
    isPublic: true,
    maxParticipants: 6,
    participantCount: 1,
    type: 'multiplayer',
    hostId: 'user_seed_kabir',
    isBotSeeded: false,
    startTime: minutesAgo(7),
    durationTargetMin: 30,
    status: 'active',
    participants: [participant('user_seed_kabir', 7)],
  },
];

// Friends' spaces that already wrapped up — `status: 'completed'`, end
// time is startTime + durationTargetMin. Feeds "Recently ended" and its
// "Start one like this" shortcut.
export const mockEndedFriendSpaces: Session[] = [
  {
    _id: 'space_arjun_resume_polish',
    categoryId: 'cat_work',
    templateId: null,
    name: 'Resume Polish',
    description: null,
    isPublic: false,
    maxParticipants: 4,
    participantCount: 3,
    type: 'multiplayer',
    hostId: 'user_seed_arjun',
    isBotSeeded: false,
    startTime: minutesAgo(200),
    durationTargetMin: 60,
    status: 'completed',
    participants: [],
  },
  {
    _id: 'space_meera_organic_chem',
    categoryId: 'cat_study',
    templateId: null,
    name: 'Organic Chem Grind',
    description: null,
    isPublic: true,
    maxParticipants: null,
    participantCount: 6,
    type: 'multiplayer',
    hostId: 'user_seed_meera',
    isBotSeeded: false,
    startTime: minutesAgo(330),
    durationTargetMin: 90,
    status: 'completed',
    participants: [],
  },
];

// Spaces friends have scheduled for later today — `status: 'scheduled'`,
// nobody in them yet. Feeds the Spaces tab's "Coming up" list.
export const mockScheduledFriendSpaces: Session[] = [
  {
    _id: 'space_arjun_leg_day',
    categoryId: 'cat_fitness',
    templateId: null,
    name: 'Leg Day Check-in',
    description: 'Squats, lunges, no skipping.',
    isPublic: false,
    maxParticipants: 6,
    participantCount: 0,
    type: 'multiplayer',
    hostId: 'user_seed_arjun',
    isBotSeeded: false,
    // A few minutes out on purpose — close enough to watch the whole
    // scheduled → reminder → live flow happen in one app session.
    startTime: minutesFromNow(4),
    durationTargetMin: 45,
    status: 'scheduled',
    participants: [],
  },
  {
    _id: 'space_meera_library_hours',
    categoryId: 'cat_study',
    templateId: null,
    name: 'Library Hours',
    description: 'Two quiet hours. Phones face down.',
    isPublic: true,
    maxParticipants: null,
    participantCount: 0,
    type: 'multiplayer',
    hostId: 'user_seed_meera',
    isBotSeeded: false,
    startTime: minutesFromNow(250),
    durationTargetMin: 120,
    status: 'scheduled',
    participants: [],
  },
];
