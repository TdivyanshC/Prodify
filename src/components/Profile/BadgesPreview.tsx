import Feather from '@expo/vector-icons/Feather';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Badge } from '../../types/models';
import { colors, fonts, radii, shadows } from '../../theme';

interface BadgesPreviewProps {
  badges: Badge[];
  earnedIds: string[];
  onSeeAll?: () => void;
}

// Badges are one of the few places gold is allowed to appear at all
// (claude.md §3a) — earned badges get the gold-tinted circle, locked ones
// stay flat/greyed so the contrast itself communicates progress.
export function BadgesPreview({ badges, earnedIds, onSeeAll }: BadgesPreviewProps) {
  const earnedCount = badges.filter((b) => earnedIds.includes(b._id)).length;

  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>
          ACHIEVEMENTS · {earnedCount}/{badges.length}
        </Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} style={styles.seeAllButton} accessibilityLabel="See all achievements">
            <Text style={styles.seeAllLabel}>See all</Text>
            <Feather name="chevron-right" size={14} color={colors.primaryLight} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {badges.map((badge) => {
          const earned = earnedIds.includes(badge._id);
          return (
            <View key={badge._id} style={styles.badgeItem}>
              <View style={[styles.badgeCircle, earned ? styles.badgeCircleEarned : styles.badgeCircleLocked]}>
                <Text style={[styles.badgeEmoji, !earned && styles.badgeEmojiLocked]}>{badge.icon ?? '🏅'}</Text>
              </View>
              <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]} numberOfLines={2}>
                {badge.name}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryLight,
  },
  row: {
    gap: 16,
    paddingRight: 4,
  },
  badgeItem: {
    width: 68,
    alignItems: 'center',
    gap: 6,
  },
  badgeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badgeCircleEarned: {
    backgroundColor: 'rgba(242, 183, 5, 0.14)',
    borderColor: colors.accentGold,
  },
  badgeCircleLocked: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  badgeEmoji: {
    fontSize: 22,
  },
  badgeEmojiLocked: {
    opacity: 0.35,
  },
  badgeName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    lineHeight: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: colors.textMuted,
  },
});
