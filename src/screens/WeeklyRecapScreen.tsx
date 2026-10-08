import Feather from '@expo/vector-icons/Feather';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card/Card';
import { StatTile } from '../components/Profile/StatTile';
import { WeeklyActivityChart } from '../components/Profile/WeeklyActivityChart';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import type { RootStackParamList } from '../navigation/routes';
import { useCreateSessionModalStore } from '../store/useCreateSessionModalStore';
import { colors, fonts, gradients, radii } from '../theme';
import type { FriendProfile } from '../types/social';
import { getFriendProfile } from '../utils/friendHelpers';
import type { WeeklyRecapResponse } from '../api/types';
import { getLatestRecap } from '../services/userService';
import { getCategory } from '../store/useCatalogStore';
import { formatMinutes } from '../utils/sessionHelpers';

type Props = NativeStackScreenProps<RootStackParamList, 'WeeklyRecap'>;

// The Sunday "your week in focus" recap — a small, weekly taste of the
// Wrapped-style recap the append-only points ledger is kept for
// (claude.md §4). Opened from the weekly_recap notification.
export function WeeklyRecapScreen({ navigation }: Props) {
  const [data, setData] = useState<WeeklyRecapResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getLatestRecap().then(setData).catch(() => setFailed(true));
  }, []);

  if (!data) {
    return (
      <SafeAreaView style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center' }]}>
        <ScreenBackground />
        {failed ? <Text style={styles.heroSub}>Couldn’t load your week. Try again in a bit.</Text> : <ActivityIndicator color={colors.primary} />}
      </SafeAreaView>
    );
  }

  // Last complete Mon–Sun week, from the weeklyRecaps rollup.
  const recap = { ...data, totalLabel: formatMinutes(data.totalMinutes), topCategory: getCategory(data.topCategoryId ?? undefined) };
  const friends = recap.focusedWithFriendIds
    .map((id) => getFriendProfile(id))
    .filter((p): p is FriendProfile => Boolean(p));

  const startNextWeek = () => {
    navigation.goBack();
    useCreateSessionModalStore.getState().open({ categoryId: recap.topCategory?._id });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.iconButton} accessibilityLabel="Back">
          <Feather name="arrow-left" size={19} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.topBarTitle}>Your week</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <View style={styles.hero}>
            <LinearGradient colors={gradients.wash} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Text style={styles.heroEyebrow}>THIS WEEK YOU FOCUSED FOR</Text>
            <Text style={styles.heroValue}>{recap.totalLabel}</Text>
            <Text style={styles.heroSub}>
              Best day: <Text style={styles.heroStrong}>{recap.bestDay.day}</Text> with{' '}
              {formatMinutes(recap.bestDay.minutes)}
            </Text>
          </View>

          <WeeklyActivityChart data={recap.days} />

          <View style={styles.tiles}>
            <StatTile emoji="✅" value={recap.sessionsCompleted} label="Sessions done" />
            <StatTile emoji="🟢" value={recap.spacesJoined} label="Spaces joined" />
            <StatTile emoji="👏" value={recap.cheersReceived} label="Cheers received" />
            <StatTile emoji="🤝" value={friends.length} label="Friends focused with" />
          </View>

          {recap.topCategory ? (
            <Card style={styles.row}>
              <Text style={styles.rowEmoji}>{recap.topCategory.icon}</Text>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>TOP THEME</Text>
                <Text style={styles.rowTitle}>{recap.topCategory.name}</Text>
              </View>
            </Card>
          ) : null}

          {friends.length > 0 ? (
            <Card style={styles.row}>
              <View style={styles.avatarStack}>
                {friends.map((f, i) => (
                  <View key={f._id} style={[styles.avatar, i > 0 && styles.avatarOverlap]}>
                    <Text style={styles.avatarInitial}>{f.avatarInitial}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>YOUR FOCUS CREW</Text>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {friends.map((f) => f.displayName.split(' ')[0]).join(', ')}
                </Text>
              </View>
            </Card>
          ) : null}

          <Text style={styles.sparkLine}>
            ✨ Spark says: that’s a week to be proud of. Same energy next week?
          </Text>

          <Pressable onPress={startNextWeek} style={styles.ctaWrap} accessibilityRole="button">
            <LinearGradient colors={gradients.primary} style={styles.cta}>
              <Text style={styles.ctaLabel}>Start next week strong</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconButton: {
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
    paddingTop: 4,
  },
  inner: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: 16,
  },
  hero: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  heroEyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  heroValue: {
    fontFamily: fonts.headingBold,
    fontSize: 44,
    color: colors.textPrimary,
  },
  heroSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  heroStrong: {
    fontFamily: fonts.bodySemiBold,
    color: colors.primaryLight,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowEmoji: {
    fontSize: 28,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  rowTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryDeep,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarInitial: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  sparkLine: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  ctaWrap: {
    borderRadius: radii.card,
  },
  cta: {
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: radii.card,
  },
  ctaLabel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
