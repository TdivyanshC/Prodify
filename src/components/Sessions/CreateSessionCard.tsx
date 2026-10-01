import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, gradients, radii } from '../../theme';

interface CreateSessionCardProps {
  onCreate: (name: string) => void;
}

// Always-visible last tile in the suggestions grid — same footprint as
// LiveSessionCard (minHeight 178) so it sits in the grid like any other
// suggestion. Two states: a solid green button (so it's unmissable, not a
// faint outline), and — once tapped — a grey inline editor in the same
// spot, so typing a name and creating happens without leaving the grid or
// opening the full multi-step sheet.
export function CreateSessionCard({ onCreate }: CreateSessionCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);

  const cancel = () => {
    setEditing(false);
    setName('');
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setEditing(false);
    setName('');
  };

  if (editing) {
    return (
      <View style={styles.cardEditing}>
        <View style={styles.editingHeader}>
          <Text style={styles.editingLabel}>New session</Text>
          <Pressable onPress={cancel} hitSlop={8} accessibilityLabel="Cancel">
            <Feather name="x" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        <TextInput
          ref={inputRef}
          value={name}
          onChangeText={setName}
          placeholder="Session name..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        <Pressable
          onPress={submit}
          disabled={!name.trim()}
          style={[styles.submitButtonWrap, !name.trim() && styles.submitButtonDisabled]}
        >
          <View style={styles.submitButton}>
            <Text style={styles.submitButtonLabel}>Create</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setEditing(true)}
      accessibilityRole="button"
      accessibilityLabel="Create your own session"
    >
      <LinearGradient colors={gradients.primary} style={styles.card}>
        <LinearGradient colors={[colors.sheen, 'transparent']} style={styles.sheen} pointerEvents="none" />
        <View style={styles.iconCircle}>
          <Feather name="plus" size={20} color={colors.textPrimary} />
        </View>
        <Text style={styles.title}>Create your own</Text>
        <Text style={styles.subtitle}>Didn't find your type of session?</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 178,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 6,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  cardEditing: {
    minHeight: 178,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
    gap: 10,
    justifyContent: 'center',
  },
  editingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editingLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  input: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  submitButtonWrap: {
    borderRadius: radii.button,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 9,
    borderRadius: radii.button,
    alignItems: 'center',
  },
  submitButtonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
});
