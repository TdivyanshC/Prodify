import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Session, SessionCategory } from '../../types/models';
import { colors, fonts, gradients, radii, shadows } from '../../theme';
import { getCategoryColor } from '../../theme/categoryColors';

interface SessionCardProps {
  session: Session;
  category: SessionCategory | undefined;
  onStart: () => void;
}

// Compact session card (Home's "Your sessions") — one clear
// action ("Start Session") rather than LiveSessionCard's fuller join/
// leave/participant-preview treatment. Capsule look = a real border plus
// the top of the locked 16-20px card radius range (radii.card), not a
// radius outside the locked scale (claude.md §3a).
export function SessionCard({ session, category, onStart }: SessionCardProps) {
  const accentColor = getCategoryColor(category?._id, colors.primary);

  return (
    <View style={[styles.card, shadows.card]}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: accentColor + '22', borderColor: accentColor + '55' },
        ]}
      >
        <Text style={styles.iconEmoji}>{category?.icon ?? '💻'}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {session.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {category?.name} · {session.durationTargetMin} min
        </Text>
      </View>

      <Pressable onPress={onStart} style={styles.buttonWrap}>
        <LinearGradient colors={gradients.primary} style={styles.button}>
          <Text style={styles.buttonLabel}>Start Session</Text>
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
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 20,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  buttonWrap: {
    borderRadius: radii.button,
  },
  button: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radii.button,
  },
  buttonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textPrimary,
  },
});
