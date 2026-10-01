import type { Friendship } from '../types/models';
import type { FriendProfile } from '../types/social';
import { mockUser } from './user.mock';

const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

// Small roster of friend profiles — Phase 1 fixture standing in for the
// `users` docs a real friendship join would resolve. Taglines are a Phase-1
// UI flourish (§social.ts), not a stored field.
export const mockFriendProfiles: FriendProfile[] = [
  {
    _id: 'user_seed_riya',
    displayName: 'Riya Sharma',
    avatarInitial: 'R',
    tagline: 'Debugging life one commit at a time 💻',
    favoriteCategoryIcon: '💻',
    streak: { current: 12, longest: 30 },
    isOnline: true,
    mascotStage: 3,
  },
  {
    _id: 'user_seed_arjun',
    displayName: 'Arjun Mehta',
    avatarInitial: 'A',
    tagline: 'Leg day is sacred 🦵',
    favoriteCategoryIcon: '🏋️',
    streak: { current: 5, longest: 18 },
    isOnline: false,
    mascotStage: 2,
  },
  {
    _id: 'user_seed_meera',
    displayName: 'Meera Iyer',
    avatarInitial: 'M',
    tagline: '3am library gremlin 📖',
    favoriteCategoryIcon: '📚',
    streak: { current: 21, longest: 21 },
    isOnline: true,
    mascotStage: 4,
  },
  {
    _id: 'user_seed_kabir',
    displayName: 'Kabir Anand',
    avatarInitial: 'K',
    tagline: 'Breathing through the chaos 🧘',
    favoriteCategoryIcon: '🧘',
    streak: { current: 3, longest: 9 },
    // Online because he's hosting a live space (friendSpaces.mock.ts).
    isOnline: true,
    mascotStage: 1,
  },
  {
    _id: 'user_seed_sara',
    displayName: 'Sara Kapoor',
    avatarInitial: 'S',
    tagline: 'Turning coffee into color palettes 🎨',
    favoriteCategoryIcon: '🎨',
    streak: { current: 8, longest: 14 },
    isOnline: true,
    mascotStage: 2,
  },
  {
    _id: 'user_seed_dev',
    displayName: 'Dev Malhotra',
    avatarInitial: 'D',
    tagline: 'Inbox zero or bust',
    favoriteCategoryIcon: '💼',
    streak: { current: 15, longest: 22 },
    isOnline: false,
    mascotStage: 3,
  },
  {
    _id: 'user_seed_priya',
    displayName: 'Priya Nair',
    avatarInitial: 'P',
    tagline: 'Small steps, big glow-up 🌱',
    favoriteCategoryIcon: '🌱',
    streak: { current: 2, longest: 6 },
    isOnline: false,
    mascotStage: 1,
  },
  {
    _id: 'user_seed_ishaan',
    displayName: 'Ishaan Verma',
    avatarInitial: 'I',
    tagline: 'Steps > scrolling 🚶',
    favoriteCategoryIcon: '🚶',
    streak: { current: 6, longest: 11 },
    isOnline: true,
    mascotStage: 2,
  },
];

// Friendships relative to mockUser (claude.md §4: request → pending →
// accept/decline → friendship, either side can unfriend anytime). Mix of
// accepted / incoming-pending / outgoing-pending so the Friends screen has
// real content in every section without needing a live backend.
export const mockFriendships: Friendship[] = [
  {
    _id: 'friendship_riya',
    userIdA: mockUser._id,
    userIdB: 'user_seed_riya',
    status: 'accepted',
    requestedBy: 'user_seed_riya',
    createdAt: daysAgo(40),
  },
  {
    _id: 'friendship_arjun',
    userIdA: mockUser._id,
    userIdB: 'user_seed_arjun',
    status: 'accepted',
    requestedBy: mockUser._id,
    createdAt: daysAgo(25),
  },
  {
    _id: 'friendship_meera',
    userIdA: 'user_seed_meera',
    userIdB: mockUser._id,
    status: 'accepted',
    requestedBy: mockUser._id,
    createdAt: daysAgo(60),
  },
  {
    _id: 'friendship_kabir',
    userIdA: mockUser._id,
    userIdB: 'user_seed_kabir',
    status: 'accepted',
    requestedBy: 'user_seed_kabir',
    createdAt: daysAgo(10),
  },
  // Incoming — someone else requested, waiting on mockUser to accept/decline.
  {
    _id: 'friendship_sara_incoming',
    userIdA: 'user_seed_sara',
    userIdB: mockUser._id,
    status: 'pending',
    requestedBy: 'user_seed_sara',
    createdAt: daysAgo(1),
  },
  {
    _id: 'friendship_dev_incoming',
    userIdA: 'user_seed_dev',
    userIdB: mockUser._id,
    status: 'pending',
    requestedBy: 'user_seed_dev',
    createdAt: daysAgo(3),
  },
  // Outgoing — mockUser requested, waiting on them. Shown as "Requested" in
  // the suggested list rather than a separate section.
  {
    _id: 'friendship_priya_outgoing',
    userIdA: mockUser._id,
    userIdB: 'user_seed_priya',
    status: 'pending',
    requestedBy: mockUser._id,
    createdAt: daysAgo(2),
  },
  // user_seed_ishaan has no friendship record — pure discovery/suggestion.
];
