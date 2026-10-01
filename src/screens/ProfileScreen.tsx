import Feather from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/AppShell/Header';
import { ActivityHeatmap } from '../components/Profile/ActivityHeatmap';
import { BadgesPreview } from '../components/Profile/BadgesPreview';
import { ProfileHeaderCard } from '../components/Profile/ProfileHeaderCard';
import { StatTile } from '../components/Profile/StatTile';
import { WeeklyActivityChart } from '../components/Profile/WeeklyActivityChart';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import { mockBadges } from '../mocks/badges.mock';
import { mockDailyActivity } from '../mocks/dailyActivity.mock';
import { mockHomeStats } from '../mocks/homeStats.mock';
import { mockWeeklyActivity } from '../mocks/weeklyActivity.mock';
import { DESKTOP_BREAKPOINT } from '../navigation/routes';
import { useAuthStore } from '../store/useAuthStore';
import { useUserStore } from '../store/useUserStore';
import { colors, fonts, radii } from '../theme';

// Profile — doubles as the mobile "more" tab (claude.md §1/§10): a personal
// dashboard rather than a settings list. Stats/chart/badges all read from
// existing mock sources (user.mock, homeStats.mock, badges.mock) so this
// stays a pure aggregation view, not a new source of truth.
export function ProfileScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const navigation = useNavigation();

  const user = useUserStore((state) => state.user);
  const refreshUser = useUserStore((state) => state.refresh);
  const signOut = useAuthStore((state) => state.signOut);

  useEffect(() => {
    if (!user) refreshUser();
  }, [user, refreshUser]);

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenBackground />
      <Header title="Profile" avatarInitial={user.displayName[0]} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.inner, isDesktop && styles.innerDesktop]}>
          <ProfileHeaderCard user={user} />

          <View style={styles.statsGrid}>
            <StatTile emoji="🔥" value={user.streak.current} label="Day streak" accent />
            <StatTile emoji="🏆" value={user.streak.longest} label="Longest streak" accent />
            <StatTile emoji="⚡" value={user.points} label="Total points" accent />
            <StatTile emoji="✅" value={mockHomeStats.sessionsCompletedTotal} label="Sessions done" />
          </View>

          <ActivityHeatmap data={mockDailyActivity} targetMinutes={mockHomeStats.dailyTargetMinutes} />

          <WeeklyActivityChart data={mockWeeklyActivity} />

          <BadgesPreview
            badges={mockBadges}
            earnedIds={user.badgeIds}
            onSeeAll={isDesktop ? () => navigation.navigate('Achievements' as never) : undefined}
          />

          <Pressable onPress={signOut} style={styles.signOutRow}>
            <Feather name="log-out" size={17} color={colors.error} />
            <Text style={styles.signOutLabel}>Sign Out</Text>
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
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  inner: {
    gap: 16,
  },
  innerDesktop: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  signOutRow: {
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
  signOutLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.error,
  },
});
