import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Mascot } from '../Mascot/Mascot';
import { colors, fonts, radii } from '../../theme';

interface EmptySessionsStateProps {
  onCreatePress: () => void;
}

// Architecture §1 §15: positive empty state with Spark, not a dead end.
export function EmptySessionsState({ onCreatePress }: EmptySessionsStateProps) {
  return (
    <View style={styles.container}>
      <Mascot variant="compact" messageOverride="No one's here yet 👀" />
      <Text style={styles.subtitle}>Be the first to start a session.</Text>
      <Pressable onPress={onCreatePress} style={styles.button}>
        <Text style={styles.buttonLabel}>+ Create Session</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
  },
  buttonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
});
