// Phase-1 UI-only social types. Not part of the locked §5 schema mirror in
// models.ts — a real backend would resolve a friend's display info via a
// join with `users` off the two ids already on `Friendship` (same
// denormalization Session does for participants), so there's no reason to
// bolt these fields onto the locked collection shapes.
export interface FriendProfile {
  _id: string;
  displayName: string;
  avatarInitial: string;
  tagline: string;
  favoriteCategoryIcon: string;
  streak: {
    current: number;
    longest: number;
  };
  isOnline: boolean;
  mascotStage: number;
}
