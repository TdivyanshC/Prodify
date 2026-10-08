import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { API_URL } from '../../api/config';
import { colors, fonts, gradients, radii, textStyles } from '../../theme';
import { Mascot } from '../Mascot/Mascot';

interface ConnectionErrorScreenProps {
  message: string;
  onRetry: () => void;
}

// Shown when sign-in/bootstrap can't reach the API. Supportive, never
// alarming (claude.md §3b) — and specific enough to fix in dev.
export function ConnectionErrorScreen({ message, onRetry }: ConnectionErrorScreenProps) {
  return (
    <View style={styles.wrap}>
      <Mascot variant="compact" messageOverride="Hmm, I can’t find the server 🔌" />
      <Text style={styles.title}>Couldn’t connect</Text>
      <Text style={styles.body}>{message}</Text>
      {__DEV__ ? (
        <Text style={styles.hint}>
          Dev: is the API running (cd server && npm run dev)? On a USB phone run{'\n'}adb reverse tcp:4000 tcp:4000{'\n'}({API_URL})
        </Text>
      ) : null}
      <Pressable onPress={onRetry} style={styles.buttonWrap}>
        <LinearGradient colors={gradients.primary} style={styles.button}>
          <Text style={styles.buttonLabel}>Try again</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  title: {
    ...textStyles.h1,
    color: colors.textPrimary,
  },
  body: {
    ...textStyles.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  hint: {
    ...textStyles.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  buttonWrap: {
    marginTop: 8,
    borderRadius: radii.button,
    overflow: 'hidden',
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  buttonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
