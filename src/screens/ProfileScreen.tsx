import Feather from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/AppShell/Header';
import { ActivityHeatmap } from '../components/Profile/ActivityHeatmap';
import { BadgesPreview } from '../components/Profile/BadgesPreview';
import { ProfileHeaderCard } from '../components/Profile/ProfileHeaderCard';
import { StatTile } from '../components/Profile/StatTile';
import { WeeklyActivityChart } from '../components/Profile/WeeklyActivityChart';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import { DESKTOP_BREAKPOINT } from '../navigation/routes';
import { useAuthStore } from '../store/useAuthStore';
import { useCatalogStore } from '../store/useCatalogStore';
import { useUserStore } from '../store/useUserStore';
import { colors, fonts, radii } from '../theme';

// Profile — doubles as the mobile "more" tab (claude.md §1/§10): a personal
// dashboard rather than a settings list. Everything here is a read of
// server data: the user doc, the daily rollups, and the badge catalog.
export function ProfileScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const navigation = useNavigation();

  const user = useUserStore((state) => state.user);
  const refreshUser = useUserStore((state) => state.refresh);
  const activity = useUserStore((state) => state.activity);
  const weekStats = useUserStore((state) => state.weekStats);
  const badges = useCatalogStore((state) => state.badges);
  const signOut = useAuthStore((state) => state.signOut);

  useEffect(() => {
    if (!user) void refreshUser().catch(() => undefined);
  }, [user, refreshUser]);
  // Heatmap + weekly chart read the rollups (GET /me/activity, /me/stats).
  useEffect(() => {
    void useUserStore.getState().loadProgress().catch(() => undefined);
  }, [user?.points]);

  // Desktop has these as sidebar routes; on mobile they push over the tabs.
  const openPage = (page: 'Progress' | 'Achievements') =>
    isDesktop ? navigation.navigate(page as never) : navigation.navigate(`${page}Page` as never);

  // The API returns active days only; the grid wants every day of a
  // trailing 4-month window, never before the account existed.
  const heatmapDays = useMemo(() => {
    if (!activity) return [];
    const totals = new Map(activity.items.map((d) => [d.date, d.totalMinutes]));
    const today = new Date(`${activity.today}T00:00:00`);
    const start = new Date(today);
    start.setMonth(start.getMonth() - 4);
    const created = new Date(activity.createdAt);
    created.setHours(0, 0, 0, 0);
    const from = created > start ? created : start;
    const days = [];
    for (const d = new Date(from); d <= today; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: key, totalMinutes: totals.get(key) ?? 0 });
    }
    return days;
  }, [activity]);

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
            <StatTile emoji="✅" value={user.counters?.sessionsCompleted ?? 0} label="Sessions done" />
          </View>

          <ActivityHeatmap data={heatmapDays} targetMinutes={activity?.dailyTargetMin ?? user.dailyTargetMin ?? 30} />

          {weekStats ? <WeeklyActivityChart data={weekStats.days} /> : null}

          <Pressable onPress={() => openPage('Progress')} style={styles.linkRow} accessibilityRole="button">
            <Feather name="bar-chart-2" size={17} color={colors.primaryLight} />
            <Text style={styles.linkLabel}>Progress & recent sessions</Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>

          <BadgesPreview badges={badges} earnedIds={user.badgeIds} onSeeAll={() => openPage('Achievements')} />

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
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkLabel: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.textPrimary,
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
