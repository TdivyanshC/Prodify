import { StyleSheet, Text, View } from 'react-native';
import type { Streak } from '../../types/models';

interface StreakIndicatorProps {
  streak: Streak;
}

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
    fontSize: 32,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  label: {
    fontSize: 13,
    color: '#6b6b6b',
  },
  freezes: {
    marginTop: 6,
    fontSize: 12,
    color: '#4a90d9',
  },
});
