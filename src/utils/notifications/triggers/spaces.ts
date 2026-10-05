import { NOTIFICATION_COPY } from '../../../mocks/notificationCopy';
import { mockSessionCategories } from '../../../mocks/sessionCategories.mock';
import { mockUser } from '../../../mocks/user.mock';
import { useFriendsStore } from '../../../store/useFriendsStore';
import { useSessionStore } from '../../../store/useSessionStore';
import { useSpaceAlertsStore } from '../../../store/useSpaceAlertsStore';
import { useSpaceInviteStore } from '../../../store/useSpaceInviteStore';
import { getAcceptedFriendIds, getFriendProfile } from '../../friendHelpers';
import { firstName, formatTime, pickCopy } from '../copy';
import { deliver } from '../deliver';

// How far ahead of a scheduled space a "Remind me" fires.
export const REMINDER_LEAD_MIN = 5;

const themeName = (categoryId: string) => mockSessionCategories.find((c) => c._id === categoryId)?.name ?? '';

// Space lifecycle — the Phase 1 stand-in for Phase 2's server jobs +
// socket events. Safe to re-run any time: every event id is deterministic.
//   • friends' scheduled spaces go live at their start time
//   • "Remind me" fires REMINDER_LEAD_MIN before start
//   • a friend going live notifies if their bell (or your reminder) is on
//   • your own scheduled space nudges you when it's due
//   • pending invites land in the inbox silently (the Spaces tab already
//     greets them with its own popup)
export function runSpaceTriggers(now: number) {
  const { sessions, startScheduledSpace } = useSessionStore.getState();
  const { friendAlertIds, reminderSpaceIds } = useSpaceAlertsStore.getState();
  const friendIds = getAcceptedFriendIds(useFriendsStore.getState().friendships);

  for (const space of sessions) {
    if (space.status !== 'scheduled') continue;
    const minutesUntil = (new Date(space.startTime).getTime() - now) / 60000;

    if (space.hostId === mockUser._id) {
      if (minutesUntil > 0) continue;
      const copy = pickCopy(NOTIFICATION_COPY.own_space_due, { space: space.name, time: formatTime(space.startTime) });
      if (copy) {
        deliver({
          eventId: `due_${space._id}`,
          type: 'own_space_due',
          copy,
          sender: { kind: 'spark' },
          priority: 'high',
          actions: [
            { kind: 'start_space_now', label: 'Start now' },
            { kind: 'snooze', label: 'Snooze 10 min' },
          ],
          payload: { spaceId: space._id, spaceName: space.name },
        });
      }
      continue;
    }

    const host = space.hostId ? getFriendProfile(space.hostId) : undefined;
    if (!host || !friendIds.has(host._id)) continue;
    const reminderOn = reminderSpaceIds.includes(space._id);

    if (reminderOn && minutesUntil > 0 && minutesUntil <= REMINDER_LEAD_MIN) {
      const copy = pickCopy(NOTIFICATION_COPY.space_reminder, {
        space: space.name,
        friend: firstName(host.displayName),
        minutes: Math.max(1, Math.ceil(minutesUntil)),
        time: formatTime(space.startTime),
      });
      if (copy) {
        deliver({
          eventId: `reminder_${space._id}`,
          type: 'space_reminder',
          copy,
          sender: { kind: 'friend', userId: host._id },
          // The user asked for this one, so it gets through quiet hours/cap.
          priority: 'high',
          payload: { spaceId: space._id, spaceName: space.name, fromUserId: host._id },
        });
      }
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
        const copy = pickCopy(NOTIFICATION_COPY.friend_started_space, {
          friend: firstName(host.displayName),
          space: space.name,
          theme: themeName(space.categoryId),
        });
        if (copy) {
          deliver({
            eventId: `started_${space._id}`,
            type: 'friend_started_space',
            copy,
            sender: { kind: 'friend', userId: host._id },
            priority: reminderOn ? 'high' : 'normal',
            actions: [{ kind: 'join_space', label: `Join ${firstName(host.displayName)}` }],
            payload: { spaceId: space._id, spaceName: space.name, fromUserId: host._id },
            // Several friends going live close together → one notification.
            groupKey: 'friend_started',
          });
        }
      }
    }
  }

  for (const invite of useSpaceInviteStore.getState().invites) {
    if (invite.status !== 'pending' || invite.toUserId !== mockUser._id) continue;
    const space = sessions.find((s) => s._id === invite.spaceId && s.status === 'active');
    const from = getFriendProfile(invite.fromUserId);
    if (!space || !from) continue;
    const copy = pickCopy(NOTIFICATION_COPY.space_invite, {
      friend: firstName(from.displayName),
      space: space.name,
      theme: themeName(space.categoryId),
    });
    if (!copy) continue;
    deliver(
      {
        eventId: `invite_${invite._id}`,
        type: 'space_invite',
        copy,
        sender: { kind: 'friend', userId: from._id },
        priority: 'high',
        actions: [{ kind: 'join_space', label: 'Join' }],
        payload: { spaceId: space._id, spaceName: space.name, fromUserId: from._id },
      },
      { silent: true }
    );
  }
}
