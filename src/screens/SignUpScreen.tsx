import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthLayout } from '../components/Auth/AuthLayout';
import { colors, radii, textStyles } from '../theme';

interface SignUpScreenProps {
  onSwitchToSignIn: () => void;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

// Gold only on the streak row — it's the streak (claude.md §3a).
const PERKS: { icon: IconName; color: string; text: string }[] = [
  { icon: 'people', color: colors.primaryLight, text: 'Focus alongside friends in live spaces — no cameras, no chat' },
  { icon: 'flame', color: colors.accentGold, text: 'A daily streak that forgives the odd off-day' },
  { icon: 'sparkles', color: colors.primaryLight, text: 'Spark cheers you on every step of the way' },
];

export function SignUpScreen({ onSwitchToSignIn }: SignUpScreenProps) {
  return (
    <AuthLayout
      sparkMessage="Hi, I’m Spark! Let’s get you set up 🔥"
      title="Create your account"
      subtitle="One tap with Google and you’re in."
      googleLabel="Sign up with Google"
      switchPrompt="Already have an account?"
      switchAction="Log in"
      onSwitch={onSwitchToSignIn}
    >
      <View style={styles.perks}>
        {PERKS.map((perk) => (
          <View key={perk.icon} style={styles.perk}>
            <View style={styles.perkIcon}>
              <Ionicons name={perk.icon} size={18} color={perk.color} />
            </View>
            <Text style={styles.perkText}>{perk.text}</Text>
          </View>
        ))}
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  perks: {
    gap: 14,
    padding: 18,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  perkText: { ...textStyles.bodySmall, color: colors.textSecondary, flex: 1 },
});
