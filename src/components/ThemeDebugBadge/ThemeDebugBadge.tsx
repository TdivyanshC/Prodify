import { StyleSheet, Text, View } from 'react-native';
import { ACTIVE_THEME, colors, palettes } from '../../theme';

// Dev-only label so whoever is looking at the running app (or a screenshot)
// knows which palette variant is on screen during theme comparison. Never
// rendered in a production build.
export function ThemeDebugBadge() {
  if (!__DEV__) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.text}>{palettes[ACTIVE_THEME].label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    zIndex: 999,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 10,
    letterSpacing: 0.4,
  },
});
