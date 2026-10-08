import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GOOGLE_AUTH_ENABLED } from '../../api/config';
import { useAuthStore } from '../../store/useAuthStore';
import { colors, textStyles } from '../../theme';
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Mascot variant="compact" messageOverride={sparkMessage} />
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {children}

        {GOOGLE_AUTH_ENABLED ? (
          <View style={styles.actions}>
            <GoogleButton label={googleLabel} pending={pending} onPress={() => void signInWithGoogle()} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.fineprint}>We only use your name, email and profile photo.</Text>
          </View>
        ) : (
          <>
            <DevAccountList />
            <Text style={styles.fineprint}>Google sign-in is paused in this build (Expo Go or EXPO_PUBLIC_AUTH_MODE=dev).</Text>
          </>
        )}

        {GOOGLE_AUTH_ENABLED ? (
          <Pressable onPress={onSwitch} hitSlop={8} style={styles.switchRow}>
            <Text style={styles.switchPrompt}>
              {switchPrompt} <Text style={styles.switchAction}>{switchAction}</Text>
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20, maxWidth: 480, width: '100%', alignSelf: 'center' },
  heading: { gap: 8 },
  title: { ...textStyles.display, color: colors.textPrimary, textAlign: 'center' },
  subtitle: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center' },
  actions: { gap: 12, marginTop: 4 },
  error: { ...textStyles.bodySmall, color: colors.warning, textAlign: 'center' },
  fineprint: { ...textStyles.caption, color: colors.textMuted, textAlign: 'center' },
  switchRow: { alignSelf: 'center', paddingVertical: 4 },
  switchPrompt: { ...textStyles.bodySmall, color: colors.textSecondary },
  switchAction: { ...textStyles.bodySmallMedium, color: colors.primaryLight },
});
