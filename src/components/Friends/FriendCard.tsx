import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../Card/Card';
import type { FriendProfile } from '../../types/social';
import { colors, fonts, radii } from '../../theme';

interface FriendCardProps {
  profile: FriendProfile;
  onPress: () => void;
}

// The engaging grid capsule for an accepted friend — avatar with an
// online/offline presence ring (no camera/video per claude.md §4, so
// presence reads through avatars + status pulses), a tagline for
// personality, and a streak chip since that's the one shared stat that
// actually matters for an accountability-focused friend system.
//
// The 47% grid width lives on this outer wrapper, not on Card's own style
// prop — Card renders its content inside an unstyled Pressable/Animated.View
// pair for the press-squish effect, so a percentage width passed to Card
// itself has no parent box to resolve against and lays out inconsistently.
export function FriendCard({ profile, onPress }: FriendCardProps) {
  return (
    <View style={styles.wrapper}>
      <Card onPress={onPress} style={styles.card}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatarRing, profile.isOnline && styles.avatarRingOnline]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{profile.avatarInitial}</Text>
            </View>
            {profile.isOnline ? <View style={styles.onlineDot} /> : null}
          </View>
          <View style={styles.categoryChip}>
            <Text style={styles.categoryIcon}>{profile.favoriteCategoryIcon}</Text>
          </View>
        </View>

        <Text style={styles.name} numberOfLines={1}>
          {profile.displayName}
        </Text>
        <Text style={styles.tagline} numberOfLines={2}>
          {profile.tagline}
        </Text>

        <View style={styles.streakChip}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakValue}>{profile.streak.current}</Text>
          <Text style={styles.streakLabel}>day streak</Text>
        </View>
      </Card>
    </View>
  );
}

const AVATAR_SIZE = 52;

const styles = StyleSheet.create({
  wrapper: {
    width: '47%',
  },
  card: {
    gap: 8,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatarRing: {
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingOnline: {
    borderColor: colors.success,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.headingBold,
    fontSize: 19,
    color: colors.textPrimary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
  },
  categoryChip: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIcon: {
    fontSize: 14,
  },
  name: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: 2,
  },
  tagline: {
    fontFamily: fonts.bodyRegular,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    minHeight: 32,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 2,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakEmoji: {
    fontSize: 12,
  },
  streakValue: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 12.5,
    color: colors.accentGold,
  },
  streakLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
