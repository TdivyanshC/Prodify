import { SafeAreaView, StyleSheet } from 'react-native';
import { Header } from '../components/AppShell/Header';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import { ScreenPlaceholder } from '../components/ScreenPlaceholder/ScreenPlaceholder';
import { colors } from '../theme';

export function ProgressScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground />
      <Header title="Progress" />
      <ScreenPlaceholder
        title="Progress"
        description="Streak history, XP trends, and productivity analytics are coming in a later section."
        icon="bar-chart-2"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
