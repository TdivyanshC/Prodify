import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/routes';
import { useNotificationStore } from '../store/useNotificationStore';
import type { AppNotification } from '../types/social';

// Shared by the toast and the Notifications screen. Every space
// notification lands on the Spaces tab rather than auto-joining a room —
// the card there shows who's in and lets the user choose (join, remind,
// start), which is the decision the notification was asking them to make.
export function openNotification(navigation: NavigationProp<RootStackParamList>, notification: AppNotification) {
  useNotificationStore.getState().markOpened(notification._id);
  useNotificationStore.getState().dismissToast();
  navigation.navigate('Main', { screen: 'Spaces' });
}
