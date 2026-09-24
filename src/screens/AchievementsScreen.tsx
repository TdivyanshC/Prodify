import { SafeAreaView, StyleSheet } from 'react-native';
import { Header } from '../components/AppShell/Header';
import { ScreenPlaceholder } from '../components/ScreenPlaceholder/ScreenPlaceholder';
import { colors } from '../theme';

export function AchievementsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Header title="Achievements" />
      <ScreenPlaceholder
        title="Achievements"
        description="Badges and milestones are coming in a later section."
        icon="award"
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
