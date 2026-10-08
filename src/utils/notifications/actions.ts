import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/routes';
import { recordNotificationAction } from '../../services/notificationService';
import { useCreateSessionModalStore } from '../../store/useCreateSessionModalStore';
import { useFriendsStore } from '../../store/useFriendsStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { usePopupStore } from '../../store/usePopupStore';
import { useReactionStore } from '../../store/useReactionStore';
import { useSessionStore } from '../../store/useSessionStore';
import { useSpaceAlertsStore } from '../../store/useSpaceAlertsStore';
import type { AppNotification, NotificationAction } from '../../types/social';
import { getFriendProfile } from '../friendHelpers';
import { pickRandomLottie } from '../lottiePool';
import { firstName } from './copy';

type Nav = NavigationProp<RootStackParamList>;

const SNOOZE_MINUTES = 10;

// Finishes an action in place: rewrites the row locally and records it
// server-side, so every device shows what happened.
function resolveInPlace(notification: AppNotification, actionTaken: string, body: string) {
  useNotificationStore.getState().update(notification._id, { body, actions: [] });
  void recordNotificationAction(notification._id, actionTaken, body).catch(() => undefined);
}

// Runs one of a notification's action buttons. Shared by the toast and the
// inbox rows. Every action marks the notification read and clears it from
// the toast.
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
      return resolveInPlace(notification, 'reminder_set', 'Reminder set ✓ We’ll ping you 5 minutes before.');
    }
    case 'quick_start':
      return useCreateSessionModalStore.getState().open({ durationMin: payload.durationMin });
    case 'send_fire': {
      if (!payload.fromUserId) return;
      // Milestones aren't tied to a space, so the reaction is keyed to the
      // milestone itself — still one 🔥 per friend per milestone.
      const contextId = payload.milestoneContextId ?? notification.eventId;
      if (contextId) useReactionStore.getState().toggleReaction(contextId, payload.fromUserId, 'fire', 'milestone');
      const name = firstName(getFriendProfile(payload.fromUserId)?.displayName);
      return resolveInPlace(notification, 'sent_fire', `You sent 🔥 to ${name}.`);
    }
    case 'accept_friend': {
      if (!payload.friendshipId) return;
      void useFriendsStore.getState().acceptRequest(payload.friendshipId).catch(() => undefined);
      const name = firstName(getFriendProfile(payload.fromUserId ?? '')?.displayName);
      return resolveInPlace(notification, 'accepted', `You and ${name} are accountability buddies now 🤝`);
    }
    case 'decline_friend':
      if (!payload.friendshipId) return;
      void useFriendsStore.getState().declineRequest(payload.friendshipId).catch(() => undefined);
      return resolveInPlace(notification, 'declined', 'Request declined.');
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

function showActionError(message: string) {
  const { showPopup, hidePopup } = usePopupStore.getState();
  showPopup({ title: 'Couldn’t do that', message, actions: [{ label: 'OK', onPress: hidePopup }] });
}

function joinSpace(navigation: Nav, spaceId: string | undefined) {
  if (!spaceId) return navigation.navigate('Main', { screen: 'Spaces' });
  useSessionStore
    .getState()
    .joinSession(spaceId)
    .then(() => navigation.navigate('SessionRoom', { sessionId: spaceId }))
    .catch((err: Error) => {
      navigation.navigate('Main', { screen: 'Spaces' });
      showActionError(err.message);
    });
}

function startOwnSpace(navigation: Nav, spaceId: string | undefined) {
  if (!spaceId) return navigation.navigate('Main', { screen: 'Spaces' });
  const space = useSessionStore.getState().sessions.find((s) => s._id === spaceId);
  const start = space?.status === 'scheduled' ? useSessionStore.getState().startScheduledSpace(spaceId) : Promise.resolve(space);
  start
    .then(() => navigation.navigate('SessionRoom', { sessionId: spaceId }))
    .catch((err: Error) => showActionError(err.message));
}
