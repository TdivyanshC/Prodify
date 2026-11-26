import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { API_URL } from '../../api/config';
import { colors, fonts } from '../../theme';

// Opens the public policy pages served by the API (also the URLs given to Google Play).
const open = (path: string) => void Linking.openURL(`${API_URL}${path}`).catch(() => undefined);

export function LegalLinks() {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => open('/privacy')} hitSlop={8} accessibilityRole="link">
        <Text style={styles.link}>Privacy Policy</Text>
      </Pressable>
      <Text style={styles.dot}>·</Text>
      <Pressable onPress={() => open('/terms')} hitSlop={8} accessibilityRole="link">
        <Text style={styles.link}>Terms of Service</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 8 },
  link: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary, textDecorationLine: 'underline' },
  dot: { color: colors.textMuted },
});
