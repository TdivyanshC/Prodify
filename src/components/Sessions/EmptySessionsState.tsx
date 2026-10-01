import { StyleSheet, Text, View } from 'react-native';
import { Mascot } from '../Mascot/Mascot';
import { colors, fonts } from '../../theme';
import { CreateSessionCard } from './CreateSessionCard';

interface EmptySessionsStateProps {
  onCreate: (name: string) => void;
}

// Architecture §1 §15: positive empty state with Spark, not a dead end —
// same green-to-grey quick-create card as the suggestions grid, so
// starting a session works identically whether the theme has live
// sessions or not.
export function EmptySessionsState({ onCreate }: EmptySessionsStateProps) {
  return (
    <View style={styles.container}>
      <Mascot variant="compact" messageOverride="No one's here yet 👀" />
      <Text style={styles.subtitle}>Be the first to start a session.</Text>
      <View style={styles.cardWrap}>
        <CreateSessionCard onCreate={onCreate} />
      </View>
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
  cardWrap: {
    width: '100%',
    marginTop: 4,
  },
});
