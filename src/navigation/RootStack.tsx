import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FriendProfileScreen } from '../screens/FriendProfileScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { WeeklyRecapScreen } from '../screens/WeeklyRecapScreen';
import { PostSessionScreen } from '../screens/PostSessionScreen';
import { SessionRoomScreen } from '../screens/SessionRoomScreen';
import { RootNavigator } from './RootNavigator';
import type { RootStackParamList } from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Root of the whole app (mounted in App.tsx): the tab/sidebar app itself
// lives at "Main", with Session Room and Post-Session pushed as full-screen
// destinations on top of it — they deliberately cover the tab bar rather
// than being just another tab.
export function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={RootNavigator} />
      <Stack.Screen
        name="SessionRoom"
        component={SessionRoomScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="PostSession"
        component={PostSessionScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
      />
      <Stack.Screen
        name="FriendProfile"
        component={FriendProfileScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="WeeklyRecap"
        component={WeeklyRecapScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
