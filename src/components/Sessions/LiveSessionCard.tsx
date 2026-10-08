import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../Card/Card';
import type { Session, SessionCategory } from '../../types/models';
import { colors, fonts, gradients, radii } from '../../theme';
import { getCategoryColor } from '../../theme/categoryColors';
import { getRemainingMinutes, isUserInSession } from '../../utils/sessionHelpers';
import { useUserStore } from '../../store/useUserStore';

interface LiveSessionCardProps {
  session: Session;
  category: SessionCategory | undefined;
  onToggleJoin: () => void;
  onPress?: () => void;
  // The single most active session gets a bigger, category-tinted
  // "spotlight" treatment instead of sitting in the uniform list — gives
  // the browse screen a real visual hierarchy instead of a flat stack of
  // identical cards.
  featured?: boolean;
}

export function LiveSessionCard({ session, category, onToggleJoin, onPress, featured }: LiveSessionCardProps) {
  const userId = useUserStore((state) => state.user?._id ?? '');
  const joined = isUserInSession(session, userId);
  const remainingMin = getRemainingMinutes(session);
  const scale = useRef(new Animated.Value(1)).current;
  const accentColor = getCategoryColor(category?._id, colors.primary);

  const handleToggleJoin = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    onToggleJoin();
  };

  const previewNames = session.participants.filter((p) => !p.leftAt).slice(0, 4);
  const extraCount = Math.max(0, session.participantCount - previewNames.length);

  return (
    <Card onPress={onPress} style={[styles.card, featured && styles.cardFeatured]}>
      <View style={[styles.accentStripe, { backgroundColor: accentColor }]} />
      {featured ? (
        <LinearGradient
          colors={[accentColor + '24', 'transparent']}
          style={styles.featuredWash}
          pointerEvents="none"
        />
      ) : null}

      {featured ? (
        <View style={styles.featuredEyebrowRow}>
          <Text style={styles.featuredEyebrow}>🔥 MOST ACTIVE RIGHT NOW</Text>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>LIVE</Text>
        </View>
        <View style={[styles.themeChip, { backgroundColor: accentColor + '20' }]}>
          <Text style={styles.themeLabel}>
            {category?.icon} {category?.name}
          </Text>
        </View>
      </View>

      <Text style={[styles.name, featured && styles.nameFeatured]}>{session.name}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>👥 {session.participantCount} people</Text>
        <Text style={styles.metaText}>⏱ {remainingMin} min left</Text>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.avatarStack}>
          {previewNames.map((p, i) => (
            <View
              key={p.userId}
              style={[
                styles.avatarCircle,
                featured && styles.avatarCircleFeatured,
                i > 0 && styles.avatarOverlap,
              ]}
            >
              <Text style={styles.avatarInitial}>{p.avatarInitial}</Text>
            </View>
          ))}
          {extraCount > 0 ? (
            <View
              style={[
                styles.avatarCircle,
                featured && styles.avatarCircleFeatured,
                styles.avatarOverlap,
                styles.avatarExtra,
              ]}
            >
              <Text style={styles.avatarExtraLabel}>+{extraCount}</Text>
            </View>
          ) : null}
        </View>

        <Pressable onPress={handleToggleJoin} accessibilityRole="button">
          <Animated.View style={[styles.joinButtonWrap, { transform: [{ scale }] }]}>
            {joined ? (
              <View style={[styles.joinButton, featured && styles.joinButtonFeatured, styles.joinButtonJoined]}>
                <Text style={[styles.joinButtonLabel, styles.joinButtonLabelJoined]}>Joined ✓</Text>
              </View>
            ) : (
              <LinearGradient colors={gradients.primary} style={[styles.joinButton, featured && styles.joinButtonFeatured]}>
                <LinearGradient colors={[colors.sheen, 'transparent']} style={styles.joinButtonSheen} pointerEvents="none" />
                <Text style={styles.joinButtonLabel}>Join</Text>
              </LinearGradient>
            )}
          </Animated.View>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    overflow: 'hidden',
  },
  cardFeatured: {
    padding: 18,
  },
  accentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
  },
  featuredWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  featuredEyebrowRow: {
    marginBottom: -2,
  },
  featuredEyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: colors.accentGold,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.error,
  },
  liveLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.error,
  },
  themeChip: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  themeLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  name: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  nameFeatured: {
    fontSize: 21,
    fontFamily: fonts.headingBold,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metaText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryDeep,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleFeatured: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarInitial: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.textPrimary,
  },
  avatarExtra: {
    backgroundColor: colors.surface,
  },
  avatarExtraLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.textSecondary,
  },
  joinButtonWrap: {
    borderRadius: radii.button,
  },
  joinButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: radii.button,
    overflow: 'hidden',
  },
  joinButtonFeatured: {
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  joinButtonSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 14,
  },
  joinButtonJoined: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.success,
  },
  joinButtonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  joinButtonLabelJoined: {
    color: colors.success,
  },
});
