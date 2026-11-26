import Feather from '@expo/vector-icons/Feather';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { colors, radii, textStyles } from '../../theme';

// Account deletion (required by Google Play): a clearly separate, two-step destructive action. The
// server removes the account and all of its data; on success the app returns to sign-in.
export function DeleteAccountButton() {
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const close = () => {
    if (!busy.current) setVisible(false);
  };
  const confirm = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await deleteAccount();
      setVisible(false);
    } catch {
      setError('Could not delete your account. Check your connection and try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setError(null);
          setVisible(true);
        }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          <Feather name="trash-2" size={20} color={colors.error} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.label}>Delete account</Text>
          <Text style={styles.caption}>Permanently remove your account and data</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <SafeAreaView style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.dialog} accessibilityViewIsModal>
              <View style={styles.dialogIcon}>
                <Feather name="alert-triangle" size={28} color={colors.error} />
              </View>
              <Text style={styles.title} accessibilityRole="header">
                Delete your account?
              </Text>
              <Text style={styles.message}>
                This permanently deletes your profile, sessions, streaks, XP, badges, friends and notifications. It can&apos;t be undone.
              </Text>
              {error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: pending, busy: pending }}
                disabled={pending}
                onPress={() => void confirm()}
                style={({ pressed }) => [styles.danger, pressed && styles.pressed, pending && styles.disabled]}
              >
                {pending ? <ActivityIndicator color={colors.background} /> : null}
                <Text style={styles.dangerLabel}>{pending ? 'Deleting...' : 'Delete everything'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={pending}
                onPress={close}
                style={({ pressed }) => [styles.cancel, pressed && styles.pressed, pending && styles.disabled]}
              >
                <Text style={styles.label}>Keep my account</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: radii.button, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 4 },
  label: { ...textStyles.bodyMedium, color: colors.textPrimary },
  caption: { ...textStyles.bodySmall, color: colors.textSecondary },
  overlay: { flex: 1, backgroundColor: colors.scrim },
  modalContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 420, alignSelf: 'center', padding: 24, gap: 16, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dialogIcon: { width: 64, height: 64, borderRadius: radii.card, backgroundColor: colors.surfaceMuted, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  title: { ...textStyles.h1, color: colors.textPrimary, textAlign: 'center' },
  message: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center' },
  error: { ...textStyles.bodySmall, color: colors.error, textAlign: 'center' },
  danger: { minHeight: 50, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', borderRadius: radii.button, backgroundColor: colors.error },
  dangerLabel: { ...textStyles.bodyMedium, color: colors.background },
  cancel: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: radii.button, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
});
