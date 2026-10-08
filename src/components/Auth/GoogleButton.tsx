import { AntDesign } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { fonts, radii, shadows } from '../../theme';

interface GoogleButtonProps {
  label: string;
  pending: boolean;
  disabled?: boolean;
  onPress: () => void;
}

// Google's sign-in button guidelines ask for a light button with their mark,
// so this is deliberately the one non-teal CTA in the app — it sits on the
// auth screens only, as the primary (and only) action there.
export function GoogleButton({ label, pending, disabled, onPress }: GoogleButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={pending || disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, (pending || disabled) && styles.dimmed]}
    >
      {pending ? <ActivityIndicator color="#1F1F1F" /> : <AntDesign name="google" size={20} color="#1F1F1F" />}
      <Text style={styles.label}>{pending ? 'Opening Google…' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 54,
    borderRadius: radii.button,
    backgroundColor: '#FFFFFF',
    ...shadows.card,
  },
  pressed: { backgroundColor: '#ECECEC' },
  dimmed: { opacity: 0.7 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#1F1F1F' },
});
