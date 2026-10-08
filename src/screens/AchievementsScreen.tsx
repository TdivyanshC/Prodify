import { useIsFocused, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AchievementsResponse } from '../api/types';
import { PageTopBar } from '../components/AppShell/PageTopBar';
import { Card } from '../components/Card/Card';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import { DESKTOP_BREAKPOINT } from '../navigation/routes';
import { getAchievements } from '../services/userService';
import { useUserStore } from '../store/useUserStore';
import { colors, radii, textStyles } from '../theme';

const UNIT: Record<string, string> = {
  total_xp: 'XP',
  streak: 'days',
  sessions_completed: 'sessions',
  early_sessions: 'early sessions',
  late_sessions: 'late sessions',
  friend_count: 'friends',
};

// Achievements — the badge catalog with earned state, the date each was
// earned (from the append-only points ledger) and live progress toward the
// rest (GET /me/achievements). Gold marks earned badges only (claude.md §3a).
export function AchievementsScreen() {
  const route = useRoute();
  const stacked = route.name === 'AchievementsPage';
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const isFocused = useIsFocused();
  const user = useUserStore((s) => s.user);
  const [data, setData] = useState<AchievementsResponse | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getAchievements());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load, user?.badgeIds.length]);

  const columns = width >= 1024 ? 3 : 2;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenBackground />
      <PageTopBar title="Achievements" stacked={stacked} avatarInitial={user?.displayName[0]} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={[styles.inner, isDesktop && styles.innerDesktop]}>
          {error ? (
            <Card>
              <Text style={styles.muted}>Couldn’t load achievements. Pull down to try again.</Text>
            </Card>
          ) : !data ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : (
            <>
              <Card>
                <Text style={styles.eyebrow}>BADGES EARNED</Text>
                <Text style={styles.hero}>
                  {data.earnedCount}
                  <Text style={styles.heroOf}> / {data.items.length}</Text>
                </Text>
                <Text style={styles.muted}>Each one unlocks the moment you cross its line — and stays yours.</Text>
              </Card>

              <View style={styles.grid}>
                {data.items.map(({ badge, earned, earnedAt, progress }) => {
                  const pct = Math.min(1, progress.current / Math.max(1, progress.target));
                  return (
                    <View key={badge._id} style={[styles.badgeCard, { width: `${100 / columns - 2}%` }, earned && styles.badgeCardEarned]}>
                      <View style={[styles.iconCircle, earned ? styles.iconCircleEarned : styles.iconCircleLocked]}>
                        <Text style={[styles.icon, !earned && styles.iconLocked]}>{badge.icon ?? '🏅'}</Text>
                      </View>
                      <Text style={styles.badgeName} numberOfLines={1}>
                        {badge.name}
                      </Text>
                      <Text style={styles.badgeDesc} numberOfLines={2}>
                        {badge.description}
                      </Text>
                      {earned ? (
                        <Text style={styles.earned}>
                          {earnedAt ? `Earned ${new Date(earnedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Earned'}
                        </Text>
                      ) : (
                        <>
                          <View style={styles.track}>
                            <View style={[styles.fill, { width: `${pct * 100}%` }]} />
                          </View>
                          <Text style={styles.progressLabel}>
                            {progress.current.toLocaleString()} / {progress.target.toLocaleString()} {UNIT[badge.criteriaType] ?? ''}
                          </Text>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 120 },
  inner: { gap: 16 },
  innerDesktop: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  eyebrow: { ...textStyles.label, color: colors.textMuted, marginBottom: 6 },
  hero: { ...textStyles.display, color: colors.accentGold },
  heroOf: { ...textStyles.h2, color: colors.textMuted },
  muted: { ...textStyles.bodySmall, color: colors.textSecondary, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  badgeCard: {
    borderRadius: radii.cardSmall,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  badgeCardEarned: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  iconCircleEarned: { backgroundColor: colors.accentGold + '26', borderWidth: 1.5, borderColor: colors.accentGold },
  iconCircleLocked: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  icon: { fontSize: 26 },
  iconLocked: { opacity: 0.4 },
  badgeName: { ...textStyles.h3, color: colors.textPrimary, textAlign: 'center' },
  badgeDesc: { ...textStyles.caption, color: colors.textSecondary, textAlign: 'center', minHeight: 30 },
  earned: { ...textStyles.caption, color: colors.accentGold },
  track: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  progressLabel: { ...textStyles.caption, color: colors.textMuted },
});
