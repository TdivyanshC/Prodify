import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { Sidebar } from '../components/AppShell/Sidebar';
import { AchievementsScreen } from '../screens/AchievementsScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SpacesScreen } from '../screens/SpacesScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

// Desktop layout (architecture §1 §10/§12): fixed sidebar + full-height
// content area. Content screens still render their own Header, so this
// stack has none of its own.
export function DesktopShell() {
  return (
    <View style={styles.container}>
      <Sidebar />
      <View style={styles.content}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Spaces" component={SpacesScreen} />
          <Stack.Screen name="Friends" component={FriendsScreen} />
          <Stack.Screen name="Progress" component={ProgressScreen} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </Stack.Navigator>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
});
