import { mockSessionCategories } from '../mocks/sessionCategories.mock';
import { mockUser } from '../mocks/user.mock';
import { useFriendsStore } from '../store/useFriendsStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useSessionStore } from '../store/useSessionStore';
import { useSpaceAlertsStore } from '../store/useSpaceAlertsStore';
import { useSpaceInviteStore } from '../store/useSpaceInviteStore';
import type { Session } from '../types/models';
import type { AppNotification, AppNotificationType } from '../types/social';
import { getAcceptedFriendIds, getFriendProfile } from './friendHelpers';

// How far ahead of a scheduled space a "Remind me" fires.
export const REMINDER_LEAD_MIN = 5;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function build(
  type: AppNotificationType,
  id: string,
  space: Session,
  title: string,
  body: string,
  fromUserId?: string
): AppNotification {
  const now = new Date().toISOString();
  return {
    _id: id,
    userId: mockUser._id,
    type,
    title,
    body,
    payload: { spaceId: space._id, fromUserId },
    scheduledAt: now,
    sentAt: null,
    openedAt: null,
  };
}

// One pass of the space lifecycle — the Phase 1 stand-in for Phase 2's
// server-side jobs + socket events. Safe to run as often as you like:
// every notification id is deterministic, so repeats are no-ops.
//   • friends' scheduled spaces go live at their start time
//   • "Remind me" fires REMINDER_LEAD_MIN before start
//   • "Notify me" (per-friend bell) fires when that friend's space goes live
//   • the user's own scheduled space nudges them when it's due
//   • pending invites land in the inbox (no toast — the Spaces tab already
//     greets those with its own popup)
export function runSpaceLifecycleTick(now: number = Date.now()) {
  const { sessions, startScheduledSpace } = useSessionStore.getState();
  const { friendAlertIds, reminderSpaceIds } = useSpaceAlertsStore.getState();
  const { invites } = useSpaceInviteStore.getState();
  const { friendships } = useFriendsStore.getState();
  const { push } = useNotificationStore.getState();
  const friendIds = getAcceptedFriendIds(friendships);

  for (const space of sessions) {
    if (space.status !== 'scheduled') continue;
    const minutesUntil = (new Date(space.startTime).getTime() - now) / 60000;

    if (space.hostId === mockUser._id) {
      if (minutesUntil <= 0) {
        push(
          build(
            'own_space_due',
            `notif_due_${space._id}`,
            space,
            'Your space is ready to start',
            `“${space.name}” was set for ${formatTime(space.startTime)}. Open it whenever you're ready.`
          )
        );
      }
      continue;
    }

    const host = space.hostId ? getFriendProfile(space.hostId) : undefined;
    if (!host || !friendIds.has(host._id)) continue;
    const hostFirst = host.displayName.split(' ')[0];
    const reminderOn = reminderSpaceIds.includes(space._id);

    if (reminderOn && minutesUntil > 0 && minutesUntil <= REMINDER_LEAD_MIN) {
      push(
        build(
          'space_reminder',
          `notif_reminder_${space._id}`,
          space,
          `“${space.name}” starts in ${Math.max(1, Math.ceil(minutesUntil))} min`,
          `${hostFirst} is opening it at ${formatTime(space.startTime)}.`,
          host._id
        )
      );
    }

    if (minutesUntil <= 0) {
      startScheduledSpace(space._id, {
        userId: host._id,
        joinedAt: new Date(now).toISOString(),
        leftAt: null,
        completed: false,
        targetHit: false,
        displayName: host.displayName,
        avatarInitial: host.avatarInitial,
      });
      if (reminderOn || friendAlertIds.includes(host._id)) {
        const category = mockSessionCategories.find((c) => c._id === space.categoryId);
        push(
          build(
            'friend_started_space',
            `notif_started_${space._id}`,
            space,
            `${hostFirst} just started a space`,
            `“${space.name}” · ${category?.icon ?? ''} ${category?.name ?? ''}. Come focus together.`,
            host._id
          )
        );
      }
    }
  }

  for (const invite of invites) {
    if (invite.status !== 'pending' || invite.toUserId !== mockUser._id) continue;
    const space = sessions.find((s) => s._id === invite.spaceId && s.status === 'active');
    const from = getFriendProfile(invite.fromUserId);
    if (!space || !from) continue;
    push(
      build(
        'space_invite',
        `notif_invite_${invite._id}`,
        space,
        `${from.displayName.split(' ')[0]} invited you`,
        `“${space.name}” — join from the Spaces tab.`,
        from._id
      ),
      { toast: false }
    );
  }
}
