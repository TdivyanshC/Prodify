import { StyleSheet, Text, View } from 'react-native';
import type { Streak } from '../../types/models';
import { colors, fonts } from '../../theme';

interface StreakIndicatorProps {
  streak: Streak;
}

// The streak flame + count are the one place outside badges/level-up/
// subscription that accentGold is allowed (claude.md §3a discipline rule).
export function StreakIndicator({ streak }: StreakIndicatorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.flame}>🔥</Text>
      <Text style={styles.count}>{streak.current}</Text>
      <Text style={styles.label}>day streak</Text>
      {streak.freezesAvailable > 0 ? (
        <Text style={styles.freezes}>❄️ {streak.freezesAvailable} freeze available</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 24,
  },
  flame: {
    fontSize: 28,
  },
  count: {
    fontFamily: fonts.headingBold,
    fontSize: 32,
    color: colors.accentGold,
  },
  label: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  freezes: {
    marginTop: 6,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.primaryLight,
  },
});
