import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SessionCategory } from '../../types/models';
import { colors, fonts, gradients, radii, shadows } from '../../theme';
import { getCategoryColor } from '../../theme/categoryColors';

interface RunAgainCardProps {
  name: string;
  category: SessionCategory | undefined;
  durationMin: number;
  onPress: () => void;
}

// One-tap way back into the session the user last finished: opens the Create sheet pre-filled with
// the same theme, name and length, so a daily habit isn't four wizard steps every time.
export function RunAgainCard({ name, category, durationMin, onPress }: RunAgainCardProps) {
  const accent = getCategoryColor(category?._id, colors.primary);
  return (
    <View style={[styles.card, shadows.card]}>
      <View style={[styles.iconCircle, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
        <Text style={styles.iconEmoji}>{category?.icon ?? '✨'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.meta} numberOfLines={1}>Last time · {category?.name ?? 'Focus'} · {durationMin} min</Text>
      </View>
      <Pressable onPress={onPress} style={styles.buttonWrap} accessibilityLabel={`Run ${name} again`}>
        <LinearGradient colors={gradients.primary} style={styles.button}>
          <Text style={styles.buttonLabel}>Run again</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 20 },
  info: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.headingSemiBold, fontSize: 14.5, color: colors.textPrimary },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  buttonWrap: { borderRadius: radii.button },
  button: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radii.button },
  buttonLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.textPrimary },
});
