import Feather from '@expo/vector-icons/Feather';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatTile } from '../components/Profile/StatTile';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import type { RootStackParamList } from '../navigation/routes';
import { useFriendsStore } from '../store/useFriendsStore';
import { usePopupStore } from '../store/usePopupStore';
import { useSpaceAlertsStore } from '../store/useSpaceAlertsStore';
import { useTogetherStreakStore } from '../store/useTogetherStreakStore';
import { getLiveTogetherStreak } from '../utils/togetherStreak';
import { colors, fonts, gradients, radii } from '../theme';
import { getFriendProfile } from '../utils/friendHelpers';

type Props = NativeStackScreenProps<RootStackParamList, 'FriendProfile'>;

function formatFriendsSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// A friend's own dashboard-style profile page — reached by drilling into a
// FriendCard on the Friends screen instead of just a quick-glance popup.
// Same visual language as the logged-in user's Profile screen (StatTile,
// gold-for-streak discipline, gradient hero) so it reads as "the same app,"
// but Unfriend replaces Sign Out as the account-level action.
export function FriendProfileScreen({ route, navigation }: Props) {
  const { friendshipId, userId } = route.params;
  const friendship = useFriendsStore((s) => s.friendships.find((f) => f._id === friendshipId));
  const removeFriend = useFriendsStore((s) => s.removeFriend);
  const profile = getFriendProfile(userId);
  const alertOn = useSpaceAlertsStore((s) => s.friendAlertIds.includes(userId));
  const toggleFriendAlert = useSpaceAlertsStore((s) => s.toggleFriendAlert);
  const togetherStreak = useTogetherStreakStore((s) => s.streaks[userId]);

  if (!friendship || !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenBackground />
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>This friend couldn't be found.</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.missingButton}>
            <Text style={styles.missingButtonLabel}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleUnfriend = () => {
    usePopupStore.getState().showPopup({
      title: `Remove ${profile.displayName}?`,
      message: "You can always send a new request later — this won't notify them.",
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => usePopupStore.getState().hidePopup() },
        {
          label: 'Unfriend',
          onPress: () => {
            void removeFriend(friendshipId).catch(() => undefined);
            usePopupStore.getState().hidePopup();
            navigation.goBack();
          },
        },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backButton} accessibilityLabel="Back">
          <Feather name="arrow-left" size={19} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.topBarTitle}>Profile</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <LinearGradient colors={gradients.wash} style={styles.wash} pointerEvents="none" />

          <View style={[styles.avatarRing, profile.isOnline && styles.avatarRingOnline]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{profile.avatarInitial}</Text>
            </View>
          </View>

          {profile.isOnline ? (
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlinePillLabel}>Online now</Text>
            </View>
          ) : null}

          <Text style={styles.name}>{profile.displayName}</Text>
          <Text style={styles.tagline}>{profile.tagline}</Text>
          <Text style={styles.friendsSince}>Friends since {formatFriendsSince(friendship.respondedAt ?? friendship.createdAt)}</Text>

          <View style={styles.pillRow}>
            <View style={styles.mascotPill}>
              <Text style={styles.pillEmoji}>🔥</Text>
              <Text style={styles.mascotPillLabel}>Spark · Stage {profile.mascotStage}</Text>
            </View>
            <View style={styles.categoryPill}>
              <Text style={styles.pillEmoji}>{profile.favoriteCategoryIcon}</Text>
              <Text style={styles.categoryPillLabel}>Favorite theme</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatTile emoji="🔥" value={profile.streak.current} label="Day streak" accent />
          <StatTile emoji="🏆" value={profile.streak.longest} label="Longest streak" accent />
          <StatTile emoji="🤝" value={getLiveTogetherStreak(togetherStreak)} label="Together streak" accent />
          <StatTile emoji="✨" value={togetherStreak?.longest ?? 0} label="Best together" accent />
        </View>

        <View style={styles.alertRow}>
          <Feather name={alertOn ? 'bell' : 'bell-off'} size={17} color={alertOn ? colors.primaryLight : colors.textMuted} />
          <View style={styles.alertText}>
            <Text style={styles.alertTitle}>Space alerts</Text>
            <Text style={styles.alertHint}>
              Notify me when {profile.displayName.split(' ')[0]} starts a space
            </Text>
          </View>
          <Switch
            value={alertOn}
            onValueChange={() => toggleFriendAlert(userId)}
            trackColor={{ false: colors.surface, true: colors.primaryDeep }}
            thumbColor={alertOn ? colors.primaryLight : colors.textSecondary}
            accessibilityLabel={`Notify me when ${profile.displayName} starts a space`}
          />
        </View>

        <Pressable onPress={handleUnfriend} style={styles.unfriendRow}>
          <Feather name="user-minus" size={17} color={colors.error} />
          <Text style={styles.unfriendLabel}>Unfriend</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 84;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  missingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  missingText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  missingButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
  },
  missingButtonLabel: {
    fontFamily: fonts.bodySemiBold,
    color: colors.textPrimary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  topBarTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  avatarRing: {
    width: AVATAR_SIZE + 8,
    height: AVATAR_SIZE + 8,
    borderRadius: (AVATAR_SIZE + 8) / 2,
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
    fontSize: 32,
    color: colors.textPrimary,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  onlinePillLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.success,
  },
  name: {
    fontFamily: fonts.headingBold,
    fontSize: 21,
    color: colors.textPrimary,
    marginTop: 14,
  },
  tagline: {
    fontFamily: fonts.bodyRegular,
    fontStyle: 'italic',
    fontSize: 13.5,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  friendsSince: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  mascotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  mascotPillLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryLight,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  pillEmoji: {
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertText: {
    flex: 1,
    gap: 1,
  },
  alertTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  alertHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  unfriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unfriendLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.error,
  },
});
