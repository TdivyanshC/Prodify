import { mockFriendProfiles } from '../../../mocks/friends.mock';
import { NOTIFICATION_COPY } from '../../../mocks/notificationCopy';
import { useFocusModeStore } from '../../../store/useFocusModeStore';
import { useFriendsStore } from '../../../store/useFriendsStore';
import { useTogetherStreakStore } from '../../../store/useTogetherStreakStore';
import { useUserStore } from '../../../store/useUserStore';
import type { Friendship } from '../../../types/models';
import { getAcceptedFriendIds, getFriendProfile, getOtherUserId } from '../../friendHelpers';
import { getLiveTogetherStreak, localDayKey } from '../../togetherStreak';
import { firstName, pickCopy } from '../copy';
import { deliver } from '../deliver';
import { findLiveSpotFor } from './progress';

// Streak lengths worth celebrating on a friend's behalf.
const MILESTONES = [7, 14, 21, 30, 50, 75, 100, 150, 200, 365];
// Requests older than this land in the inbox without a toast — a toast is
// for "just now", not a backlog.
const STALE_REQUEST_MS = 60 * 60 * 1000;

export function runFriendTriggers(now: number) {
  const user = useUserStore.getState().user;
  if (!user) return;
  const { friendships } = useFriendsStore.getState();
  const friendIds = getAcceptedFriendIds(friendships, user._id);

  // Incoming friend requests, with Accept / Decline right on them.
  for (const f of friendships) {
    if (f.status !== 'pending' || f.requestedBy === user._id) continue;
    const from = getFriendProfile(f.requestedBy);
    const copy = pickCopy(NOTIFICATION_COPY.friend_request, { friend: firstName(from?.displayName) });
    if (!from || !copy) continue;
    deliver(
      {
        eventId: `request_${f._id}`,
        type: 'friend_request',
        copy,
        sender: { kind: 'friend', userId: from._id },
        actions: [
          { kind: 'accept_friend', label: 'Accept' },
          { kind: 'decline_friend', label: 'Decline' },
        ],
        payload: { friendshipId: f._id, fromUserId: from._id },
      },
      { silent: now - new Date(f.createdAt).getTime() > STALE_REQUEST_MS }
    );
  }

  // A friend's streak landing on a milestone — once per milestone, with a
  // one-tap 🔥 (the fixed reaction set, claude.md §4).
  for (const profile of mockFriendProfiles) {
    if (!friendIds.has(profile._id) || !MILESTONES.includes(profile.streak.current)) continue;
    const copy = pickCopy(NOTIFICATION_COPY.friend_milestone, {
      friend: firstName(profile.displayName),
      milestone: profile.streak.current,
    });
    if (!copy) continue;
    deliver({
      eventId: `milestone_${profile._id}_${profile.streak.current}`,
      type: 'friend_milestone',
      copy,
      sender: { kind: 'friend', userId: profile._id },
      actions: [{ kind: 'send_fire', label: 'Send 🔥' }],
      payload: { fromUserId: profile._id, milestone: profile.streak.current },
    });
  }

  // Together streak — one nudge a day, for the strongest live together
  // streak whose friend is in a space right now and hasn't shared today.
  if (!useFocusModeStore.getState().activeSessionId) {
    const today = localDayKey(new Date(now));
    const { streaks } = useTogetherStreakStore.getState();
    const live = findLiveFriendWithTogetherStreak(friendIds, streaks, today);
    if (live) {
      const name = firstName(getFriendProfile(live.userId)?.displayName);
      const copy = pickCopy(NOTIFICATION_COPY.together_streak_risk, {
        friend: name,
        days: live.days,
        next: live.days + 1,
      });
      if (copy) {
        deliver({
          eventId: `together_${today}`,
          type: 'together_streak_risk',
          copy,
          sender: { kind: 'friend', userId: live.userId },
          actions: [{ kind: 'join_space', label: `Join ${name}` }],
          payload: { spaceId: live.spaceId, spaceName: live.spaceName, fromUserId: live.userId },
        });
      }
    }
  }
}

function findLiveFriendWithTogetherStreak(
  friendIds: Set<string>,
  streaks: ReturnType<typeof useTogetherStreakStore.getState>['streaks'],
  today: string
) {
  let best: { userId: string; spaceId: string; spaceName: string; days: number } | null = null;
  for (const friendId of friendIds) {
    const streak = streaks[friendId];
    const days = getLiveTogetherStreak(streak);
    if (days === 0 || streak?.lastTogetherDate === today) continue;
    const spot = findLiveSpotFor(friendId);
    if (spot && (!best || days > best.days)) best = { userId: friendId, ...spot, days };
  }
  return best;
}

// "X said yes" — diffed on friends-store changes: an outgoing pending
// request that flipped to accepted.
export function observeFriendshipTransitions(next: Friendship[], prev: Friendship[]) {
  const myId = useUserStore.getState().user?._id;
  if (!myId) return;
  for (const f of next) {
    if (f.status !== 'accepted' || f.requestedBy !== myId) continue;
    const before = prev.find((p) => p._id === f._id);
    if (before?.status !== 'pending') continue;
    const friendId = getOtherUserId(f, myId);
    const copy = pickCopy(NOTIFICATION_COPY.friend_accepted, { friend: firstName(getFriendProfile(friendId)?.displayName) });
    if (!copy) continue;
    deliver({
      eventId: `accepted_${f._id}`,
      type: 'friend_accepted',
      copy,
      sender: { kind: 'friend', userId: friendId },
      payload: { fromUserId: friendId, friendshipId: f._id },
    });
  }
}
