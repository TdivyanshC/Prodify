import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GOOGLE_AUTH_ENABLED } from '../../api/config';
import { useAuthStore } from '../../store/useAuthStore';
import { colors, radii, shadows, textStyles } from '../../theme';
import { Mascot } from '../Mascot/Mascot';
import { ScreenBackground } from '../ScreenBackground/ScreenBackground';
import { DevAccountList } from './DevAccountList';
import { GoogleButton } from './GoogleButton';

interface AuthLayoutProps {
  sparkMessage: string;
  title: string;
  subtitle: string;
  googleLabel: string;
  children?: ReactNode;
  switchPrompt: string;
  switchAction: string;
  onSwitch: () => void;
}

// Shared frame for Log in / Sign up. With Google sign-in on, the one action
// is the Google button; with it paused (Expo Go, EXPO_PUBLIC_AUTH_MODE=dev)
// the seeded test accounts stand in for it.
export function AuthLayout({ sparkMessage, title, subtitle, googleLabel, children, switchPrompt, switchAction, onSwitch }: AuthLayoutProps) {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const pending = useAuthStore((s) => s.googlePending);
  const error = useAuthStore((s) => s.error);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <View style={styles.brandIcon}><Feather name="zap" size={22} color={colors.primaryLight} /></View>
          <Text style={styles.brandName}>Prodify</Text>
        </View>
        <Text style={styles.tagline}>A little focus. A little company.</Text>
        <View style={styles.card}>
        <Mascot variant="compact" messageOverride={sparkMessage} />
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {children}

        {GOOGLE_AUTH_ENABLED ? (
          <View style={styles.actions}>
            <GoogleButton label={googleLabel} pending={pending} onPress={() => void signInWithGoogle()} />
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            <Text style={styles.fineprint}>We only use your name, email and profile photo.</Text>
          </View>
        ) : (
          <>
            <DevAccountList />
            <Text style={styles.fineprint}>Google sign-in is paused in this build (Expo Go or EXPO_PUBLIC_AUTH_MODE=dev).</Text>
          </>
        )}

        {GOOGLE_AUTH_ENABLED ? (
          <Pressable accessibilityRole="button" disabled={pending} onPress={onSwitch} hitSlop={8} style={styles.switchRow}>
            <Text style={styles.switchPrompt}>
              {switchPrompt} <Text style={styles.switchAction}>{switchAction}</Text>
            </Text>
          </Pressable>
        ) : null}
        </View>
        <View style={styles.footer}>
          <Feather name="shield" size={14} color={colors.textMuted} />
          <Text style={styles.fineprint}>Your focus, your space, your pace.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 32, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  brandIcon: { width: 42, height: 42, borderRadius: radii.button, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  brandName: { ...textStyles.h1, color: colors.textPrimary },
  tagline: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  card: { padding: 20, gap: 24, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  heading: { gap: 10 },
  title: { ...textStyles.display, color: colors.textPrimary, textAlign: 'center' },
  subtitle: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center' },
  actions: { gap: 12, marginTop: 4 },
  error: { ...textStyles.bodySmall, color: colors.error, textAlign: 'center' },
  fineprint: { ...textStyles.caption, color: colors.textMuted, textAlign: 'center' },
  switchRow: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  switchPrompt: { ...textStyles.bodySmall, color: colors.textSecondary },
  switchAction: { ...textStyles.bodySmallMedium, color: colors.primaryLight },
});
