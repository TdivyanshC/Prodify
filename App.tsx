import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingScreen } from './src/components/LoadingScreen/LoadingScreen';
import { SparkOverlay } from './src/components/Mascot/SparkOverlay';
import { Popup } from './src/components/Popup/Popup';
import { ThemeDebugBadge } from './src/components/ThemeDebugBadge/ThemeDebugBadge';
import { RootStack } from './src/navigation/RootStack';
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

  if (!fontsLoaded) {
    return <LoadingScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
          <RootStack />
        </NavigationContainer>
        <SparkOverlay />
        <Popup />
        <ThemeDebugBadge />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </View>
  );
}
