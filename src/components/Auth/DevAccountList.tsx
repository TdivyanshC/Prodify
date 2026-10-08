import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DevAccount } from '../../api/types';
import { getDevAccounts } from '../../services/devService';
import { useAuthStore } from '../../store/useAuthStore';
import { colors, radii, textStyles } from '../../theme';

// Seeded test accounts (server AUTH_MODE=dev), shown while Google sign-in is
// paused — so every social flow can be tried from both sides (e.g. send a
// request as Simran, sign in as Priya, accept it).
export function DevAccountList() {
  const signIn = useAuthStore((s) => s.signInWithDevAccount);
  const status = useAuthStore((s) => s.status);
  const lastAccount = useAuthStore((s) => s.accountId);
  const [accounts, setAccounts] = useState<DevAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    getDevAccounts()
      .then(({ items }) => setAccounts(items))
      .catch((err: Error) => setError(err.message));
  };
  useEffect(load, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>TEST ACCOUNTS</Text>
      {error ? (
        <Pressable onPress={load} style={styles.row}>
          <Text style={styles.errorText}>Couldn’t reach the server. Tap to retry.</Text>
        </Pressable>
      ) : !accounts ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        accounts.map((a) => (
          <Pressable
            key={a.firebaseUid}
            disabled={status === 'signing-in'}
            onPress={() => void signIn(a.firebaseUid)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed, a.firebaseUid === lastAccount && styles.rowLast]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{a.displayName.charAt(0)}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.name}>{a.displayName}</Text>
              <Text style={styles.handle}>@{a.handle}</Text>
            </View>
            <Text style={styles.continue}>Continue</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  eyebrow: { ...textStyles.label, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.cardSmall,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceElevated },
  rowLast: { borderColor: colors.primaryDeep },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { ...textStyles.h3, color: colors.primaryLight },
  rowText: { flex: 1 },
  name: { ...textStyles.bodyMedium, color: colors.textPrimary },
  handle: { ...textStyles.caption, color: colors.textMuted },
  continue: { ...textStyles.bodySmallMedium, color: colors.primaryLight },
  errorText: { ...textStyles.bodySmall, color: colors.warning },
});
