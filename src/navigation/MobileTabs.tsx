import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { FriendsScreen } from '../screens/FriendsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SpacesScreen } from '../screens/SpacesScreen';
import { useCreateSessionModalStore } from '../store/useCreateSessionModalStore';
import { CustomTabBar } from './CustomTabBar';
import { MOBILE_TAB_ITEMS } from './routes';

const Tab = createBottomTabNavigator();

const SCREEN_COMPONENTS = {
  Home: HomeScreen,
  Spaces: SpacesScreen,
  Friends: FriendsScreen,
  Profile: ProfileScreen,
};

// A tab that renders nothing — its tabPress listener always intercepts
// before this would show (architecture §1 §10: "Create" opens the Create
// Session modal, it isn't a navigable page).
function NoopScreen() {
  return <View />;
}

// Mobile nav (architecture §1 §10): Home / Spaces / Create / Friends /
// Profile, rendered by CustomTabBar as a floating pill with Create
// levitating above it. Each real screen renders its own Header, so the tab
// navigator itself has none.
export function MobileTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      {MOBILE_TAB_ITEMS.slice(0, 2).map((item) => (
        <Tab.Screen
          key={item.label}
          name={item.name}
          component={SCREEN_COMPONENTS[item.name as keyof typeof SCREEN_COMPONENTS]}
          options={{ title: item.label }}
        />
      ))}

      <Tab.Screen
        name="CreateAction"
        component={NoopScreen}
        options={{ title: 'Create' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            useCreateSessionModalStore.getState().open();
          },
        }}
      />

      {MOBILE_TAB_ITEMS.slice(2).map((item) => (
        <Tab.Screen
          key={item.label}
          name={item.name}
          component={SCREEN_COMPONENTS[item.name as keyof typeof SCREEN_COMPONENTS]}
          options={{ title: item.label }}
        />
      ))}
    </Tab.Navigator>
  );
}
