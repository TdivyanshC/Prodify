import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConnectionErrorScreen } from './src/components/LoadingScreen/ConnectionErrorScreen';
import { LoadingScreen } from './src/components/LoadingScreen/LoadingScreen';
import { SparkOverlay } from './src/components/Mascot/SparkOverlay';
import { NotificationToast } from './src/components/Notifications/NotificationToast';
import { Popup } from './src/components/Popup/Popup';
import { CreateSessionModal } from './src/components/Sessions/CreateSessionModal';
import { ThemeDebugBadge } from './src/components/ThemeDebugBadge/ThemeDebugBadge';
import { RootStack } from './src/navigation/RootStack';
import { AuthScreen } from './src/screens/AuthScreen';
import { useAuthStore } from './src/store/useAuthStore';
import { colors } from './src/theme';
import { useAppFonts } from './src/theme/useAppFonts';

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.primary,
  },
};

export default function App() {
  const [fontsLoaded] = useAppFonts();
  const authStatus = useAuthStore((s) => s.status);
  const authError = useAuthStore((s) => s.error);
  const restore = useAuthStore((s) => s.restore);

  // Reopen the saved session (or, with Google sign-in paused, the dev
  // account) and load every store from the API before showing the app —
  // screens never render half-empty. Signed out → Log in / Sign up.
  useEffect(() => {
    if (authStatus === 'idle') void restore();
  }, [authStatus, restore]);

  if (!fontsLoaded || authStatus === 'idle' || authStatus === 'signing-in') {
    return <LoadingScreen />;
  }
  if (authStatus === 'signed-out') {
    return (
      <SafeAreaProvider>
        <AuthScreen />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }
  if (authStatus === 'error') {
    return (
      <SafeAreaProvider>
        <ConnectionErrorScreen message={authError ?? 'Something went wrong'} onRetry={() => void restore()} />
      </SafeAreaProvider>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
          <RootStack />
          {/* Mounted once here, not per-screen — Home and Sessions both
              open it via useCreateSessionModalStore, and since bottom-tab
              screens stay mounted while inactive, per-screen instances
              would double up (two overlapping forms, same bug class Popup
              already avoids by living at the root). Needs to stay inside
              NavigationContainer (unlike Popup) because it navigates to
              SessionRoom on create. */}
          <CreateSessionModal />
          {/* Same reason as CreateSessionModal: mounted once, and inside
              NavigationContainer because tapping a toast navigates. */}
          <NotificationToast />
        </NavigationContainer>
        <SparkOverlay />
        <Popup />
        <ThemeDebugBadge />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </View>
  );
}
