import { NOTIFICATION_COPY } from './notificationCopy';
import { useFocusModeStore } from '../store/useFocusModeStore';
import { useFriendsStore } from '../store/useFriendsStore';
import { useSessionStore } from '../store/useSessionStore';
import { useSpaceInviteStore } from '../store/useSpaceInviteStore';
import { useUserStore } from '../store/useUserStore';
import { getAcceptedFriendIds, getFriendProfile } from '../utils/friendHelpers';
import { firstName, pickCopy } from '../utils/notifications/copy';
import { deliver } from '../utils/notifications/deliver';

// Phase 1 only — stand-ins for the realtime events Phase 2's Socket.IO
// layer delivers (presence joins, incoming reactions, friendship
// updates). Everything here acts on behalf of fixture *friends* only:
// bot-seeded rooms never react or join (claude.md §4 — bots never fake
// 1:1 reactions). Delete this file when the socket layer lands; the
// notifications it produces go through the same deliver() as real ones.

const REACTION_FIRST_AFTER_MS = 60 * 1000;
const REACTION_STAGGER_MS = 25 * 1000;
const INVITEE_JOIN_AFTER_MS = 40 * 1000;
const INVITEE_JOIN_STAGGER_MS = 30 * 1000;
const PRIYA_ACCEPTS_AFTER_MS = 150 * 1000;
const REACTION_EMOJI = ['👏', '🔥', '🤜'];

export function runNotificationSimulations(now: number, runnerStartedAt: number) {
  const user = useUserStore.getState().user;
  if (!user) return;
  const { sessions, addParticipant } = useSessionStore.getState();
  const friendIds = getAcceptedFriendIds(useFriendsStore.getState().friendships, user._id);

  // Friends sharing the user's space cheer them on, one at a time, a
  // minute in. These arrive mid-focus, so they're held for "While you
  // focused" and grouped into one "Riya and 2 others cheered you on".
  const { activeSessionId, enteredAt } = useFocusModeStore.getState();
  const focusSpace = sessions.find((s) => s._id === activeSessionId);
  if (focusSpace && enteredAt) {
    const friendsHere = focusSpace.participants.filter((p) => !p.leftAt && friendIds.has(p.userId));
    friendsHere.forEach((friend, i) => {
      if (now - enteredAt < REACTION_FIRST_AFTER_MS + i * REACTION_STAGGER_MS) return;
      const emoji = REACTION_EMOJI[i % REACTION_EMOJI.length];
      const copy = pickCopy(NOTIFICATION_COPY.reactions_received, {
        friend: firstName(friend.displayName),
        emoji,
        space: focusSpace.name,
      });
      if (!copy) return;
      deliver({
        eventId: `react_${focusSpace._id}_${friend.userId}_${enteredAt}`,
        type: 'reactions_received',
        copy,
        sender: { kind: 'friend', userId: friend.userId },
        payload: { spaceId: focusSpace._id, spaceName: focusSpace.name, fromUserId: friend.userId, reactionEmoji: emoji },
        groupKey: `reactions_${focusSpace._id}_${enteredAt}`,
      });
    });
  }

  // Online friends the user invited actually show up in their space.
  for (const space of sessions) {
    if (space.status !== 'active' || space.hostId !== user._id || !space.invitedUserIds?.length) continue;
    const hostSince = new Date(space.startTime).getTime();
    const comingOnline = space.invitedUserIds.filter((id) => getFriendProfile(id)?.isOnline);
    comingOnline.forEach((friendId, i) => {
      if (now - hostSince < INVITEE_JOIN_AFTER_MS + i * INVITEE_JOIN_STAGGER_MS) return;
      if (space.participants.some((p) => p.userId === friendId)) return;
      const profile = getFriendProfile(friendId);
      if (!profile) return;
      addParticipant(space._id, {
        userId: friendId,
        joinedAt: new Date(now).toISOString(),
        leftAt: null,
        completed: false,
        targetHit: false,
        displayName: profile.displayName,
        avatarInitial: profile.avatarInitial,
      });
      useSpaceInviteStore.getState().acceptInvite(`invite_${space._id}_${friendId}`);
      const copy = pickCopy(NOTIFICATION_COPY.space_joined, { friend: firstName(profile.displayName), space: space.name });
      if (!copy) return;
      deliver({
        eventId: `joined_${space._id}_${friendId}`,
        type: 'space_joined',
        copy,
        sender: { kind: 'friend', userId: friendId },
        payload: { spaceId: space._id, spaceName: space.name, fromUserId: friendId },
        groupKey: `joined_${space._id}`,
      });
    });
  }

  // Priya accepts the user's pending friend request a couple of minutes
  // in → the "said yes" notification (observeFriendshipTransitions).
  if (now - runnerStartedAt >= PRIYA_ACCEPTS_AFTER_MS) {
    const pending = useFriendsStore
      .getState()
      .friendships.find((f) => f._id === 'friendship_priya_outgoing' && f.status === 'pending');
    if (pending) useFriendsStore.getState().acceptRequest(pending._id);
  }
}
