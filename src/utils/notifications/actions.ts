import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/routes';
import { useCreateSessionModalStore } from '../../store/useCreateSessionModalStore';
import { useFriendsStore } from '../../store/useFriendsStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { usePopupStore } from '../../store/usePopupStore';
import { useReactionStore } from '../../store/useReactionStore';
import { useSessionStore } from '../../store/useSessionStore';
import { useSpaceAlertsStore } from '../../store/useSpaceAlertsStore';
import { useSpaceInviteStore } from '../../store/useSpaceInviteStore';
import { useUserStore } from '../../store/useUserStore';
import type { AppNotification, NotificationAction } from '../../types/social';
import { getFriendProfile } from '../friendHelpers';
import { pickRandomLottie } from '../lottiePool';
import { firstName } from './copy';

type Nav = NavigationProp<RootStackParamList>;

const SNOOZE_MINUTES = 10;

// Runs one of a notification's action buttons. Shared by the toast and the
// inbox rows. Every action marks the notification read and clears it from
// the toast; actions that finish the job in place (remind, accept, send
// fire) also rewrite the notification so the inbox shows what happened.
export function runNotificationAction(navigation: Nav, notification: AppNotification, action: NotificationAction) {
  const store = useNotificationStore.getState();
  store.markOpened(notification._id);
  if (store.toastId === notification._id) store.dismissToast();
  const { payload } = notification;

  switch (action.kind) {
    case 'join_space':
      return joinSpace(navigation, payload.spaceId);
    case 'start_space_now':
      return startOwnSpace(navigation, payload.spaceId);
    case 'open_spaces':
      return navigation.navigate('Main', { screen: 'Spaces' });
    case 'remind_space': {
      if (!payload.spaceId) return;
      const alerts = useSpaceAlertsStore.getState();
      if (!alerts.reminderSpaceIds.includes(payload.spaceId)) alerts.toggleReminder(payload.spaceId);
      return store.update(notification._id, { body: 'Reminder set ✓ We’ll ping you 5 minutes before.', actions: [] });
    }
    case 'quick_start':
      return useCreateSessionModalStore.getState().open({ durationMin: payload.durationMin });
    case 'send_fire': {
      if (!payload.fromUserId) return;
      // Milestones aren't tied to a space, so the reaction is keyed to the
      // milestone itself — still one 🔥 per friend per milestone.
      useReactionStore
        .getState()
        .toggleReaction(`milestone_${payload.fromUserId}_${payload.milestone ?? 0}`, payload.fromUserId, 'fire');
      const name = firstName(getFriendProfile(payload.fromUserId)?.displayName);
      return store.update(notification._id, { body: `You sent 🔥 to ${name}.`, actions: [] });
    }
    case 'accept_friend': {
      if (!payload.friendshipId) return;
      useFriendsStore.getState().acceptRequest(payload.friendshipId);
      const name = firstName(getFriendProfile(payload.fromUserId ?? '')?.displayName);
      return store.update(notification._id, { body: `You and ${name} are accountability buddies now 🤝`, actions: [] });
    }
    case 'decline_friend':
      if (!payload.friendshipId) return;
      useFriendsStore.getState().declineRequest(payload.friendshipId);
      return store.update(notification._id, { body: 'Request declined.', actions: [] });
    case 'open_recap':
      return navigation.navigate('WeeklyRecap');
    case 'celebrate': {
      const { showPopup, hidePopup } = usePopupStore.getState();
      return showPopup({
        title: notification.title,
        message: notification.type === 'level_up' ? 'Spark’s glow just leveled up with you. Keep it lit!' : notification.body.replace(' Tap to celebrate.', ''),
        lottieSource: pickRandomLottie(),
        actions: [{ label: 'Let’s go!', onPress: hidePopup }],
      });
    }
    case 'snooze':
      store.snooze(notification._id, SNOOZE_MINUTES);
      return store.update(notification._id, { body: `${notification.body} · Snoozed for ${SNOOZE_MINUTES} min` });
  }
}

// Tapping the notification itself (not a button): the most natural
// destination for its type. Space things open the Spaces tab rather than
// auto-joining — the user picks there.
export function openNotification(navigation: Nav, notification: AppNotification) {
  const primary = notification.actions[0];
  if (primary && (primary.kind === 'celebrate' || primary.kind === 'open_recap')) {
    return runNotificationAction(navigation, notification, primary);
  }
  const store = useNotificationStore.getState();
  store.markOpened(notification._id);
  if (store.toastId === notification._id) store.dismissToast();
  if (notification.category === 'friends' && notification.type !== 'together_streak_risk') {
    return navigation.navigate('Main', { screen: 'Friends' });
  }
  navigation.navigate('Main', { screen: 'Spaces' });
}

function joinSpace(navigation: Nav, spaceId: string | undefined) {
  const space = useSessionStore.getState().sessions.find((s) => s._id === spaceId);
  if (!space || space.status !== 'active') return navigation.navigate('Main', { screen: 'Spaces' });
  useSessionStore.getState().joinSession(space._id);
  const invite = useSpaceInviteStore
    .getState()
    .invites.find((i) => i.spaceId === space._id && i.status === 'pending' && i.toUserId === useUserStore.getState().user?._id);
  if (invite) useSpaceInviteStore.getState().acceptInvite(invite._id);
  navigation.navigate('SessionRoom', { sessionId: space._id });
}

function startOwnSpace(navigation: Nav, spaceId: string | undefined) {
  const user = useUserStore.getState().user;
  const space = useSessionStore.getState().sessions.find((s) => s._id === spaceId);
  if (!user || !space) return navigation.navigate('Main', { screen: 'Spaces' });
  if (space.status === 'scheduled') {
    useSessionStore.getState().startScheduledSpace(space._id, {
      userId: user._id,
      joinedAt: new Date().toISOString(),
      leftAt: null,
      completed: false,
      targetHit: false,
      displayName: user.displayName,
      avatarInitial: user.displayName[0],
    });
  }
  navigation.navigate('SessionRoom', { sessionId: space._id });
}
