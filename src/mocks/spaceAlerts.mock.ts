// Friends the user wants a heads-up from whenever they open a space —
// Riya on by default so the bell's "on" state has real content. Phase 2
// stores this as a notification preference on the user doc; Phase 4 turns
// it into an actual `friend_started_space` push.
export const mockFriendSpaceAlertIds: string[] = ['user_seed_riya'];
