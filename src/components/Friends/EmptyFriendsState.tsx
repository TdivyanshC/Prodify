import { StyleSheet, Text, View } from 'react-native';
import { Mascot } from '../Mascot/Mascot';
import { colors, fonts } from '../../theme';

// Positive empty state with Spark rather than a dead end, same treatment as
// EmptySessionsState — shown only if mockUser has zero friends and zero
// pending requests, since the "People you may know" section already gives
// a next step right below it.
export function EmptyFriendsState() {
  return (
    <View style={styles.container}>
      <Mascot variant="compact" messageOverride="No friends yet — let's fix that 👋" />
      <Text style={styles.subtitle}>Add a few people below to stay accountable together.</Text>
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
});
