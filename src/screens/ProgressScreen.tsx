import { useIsFocused, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SessionHistoryItem, StatsResponse } from '../api/types';
import { PageTopBar } from '../components/AppShell/PageTopBar';
import { Card } from '../components/Card/Card';
import { StatTile } from '../components/Profile/StatTile';
import { WeeklyActivityChart } from '../components/Profile/WeeklyActivityChart';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import { DESKTOP_BREAKPOINT } from '../navigation/routes';
import { getSessionHistory, getStats } from '../services/userService';
import { getCategory } from '../store/useCatalogStore';
import { useUserStore } from '../store/useUserStore';
import { colors, fonts, radii, textStyles } from '../theme';
import { getCategoryColor } from '../theme/categoryColors';
import { formatMinutes } from '../utils/sessionHelpers';

type Range = 'week' | 'month';

// Progress — the user's own analytics, all from the rollups the server
// writes on every session close (GET /me/stats, /sessions, user doc):
// focused time per day, per theme, streak + freezes, level, recent sessions.
export function ProgressScreen() {
  const route = useRoute();
  const stacked = route.name === 'ProgressPage';
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const isFocused = useIsFocused();
  const user = useUserStore((s) => s.user);
  const summary = useUserStore((s) => s.summary);

  const [range, setRange] = useState<Range>('week');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([getStats(range), getSessionHistory(15)]);
      setStats(s);
      setHistory(h.items.filter((i) => i.status === 'completed'));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [range]);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load, user?.points]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!user) return null;
  const target = user.dailyTargetMin ?? summary?.dailyTargetMin ?? 30;
  const activeDays = stats?.days.filter((d) => d.minutes > 0).length ?? 0;
  const goalDays = stats?.days.filter((d) => d.minutes >= target).length ?? 0;
  const avg = stats && activeDays > 0 ? Math.round(stats.totalMinutes / activeDays) : 0;
  const maxCat = Math.max(1, ...(stats?.byCategory.map((c) => c.minutes) ?? [1]));
  const lp = user.levelProgress;
  const levelPct = lp ? Math.min(1, (user.points - lp.levelStartXp) / Math.max(1, lp.nextLevelXp - lp.levelStartXp)) : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenBackground />
      <PageTopBar title="Progress" stacked={stacked} avatarInitial={user.displayName[0]} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={[styles.inner, isDesktop && styles.innerDesktop]}>
          <View style={styles.segment}>
            {(['week', 'month'] as Range[]).map((r) => (
              <Pressable key={r} onPress={() => setRange(r)} style={[styles.segmentItem, range === r && styles.segmentItemActive]}>
                <Text style={[styles.segmentLabel, range === r && styles.segmentLabelActive]}>{r === 'week' ? 'Last 7 days' : 'Last 30 days'}</Text>
              </Pressable>
            ))}
          </View>

          {error ? (
            <Card>
              <Text style={styles.muted}>Couldn’t load your progress. Pull down to try again.</Text>
            </Card>
          ) : !stats ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : (
            <>
              <Card>
                <Text style={styles.eyebrow}>FOCUSED TIME</Text>
                <Text style={styles.hero}>{formatMinutes(stats.totalMinutes)}</Text>
                <Text style={styles.muted}>
                  {activeDays} active {activeDays === 1 ? 'day' : 'days'} · {avg ? `${formatMinutes(avg)} on an active day` : 'no sessions yet'} · goal hit on {goalDays}
                </Text>
              </Card>

              {range === 'week' ? (
                <WeeklyActivityChart data={stats.days} />
              ) : (
                <Card>
                  <Text style={styles.eyebrow}>DAILY MINUTES</Text>
                  <View style={styles.monthBars}>
                    {stats.days.map((d) => {
                      const max = Math.max(target, ...stats.days.map((x) => x.minutes));
                      return (
                        <View key={d.date} style={styles.monthBarSlot}>
                          <View
                            style={[
                              styles.monthBar,
                              { height: `${Math.max(2, (d.minutes / max) * 100)}%` },
                              d.minutes >= target ? styles.monthBarGoal : d.minutes === 0 ? styles.monthBarEmpty : null,
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                  <Text style={styles.caption}>Brighter bars hit your {formatMinutes(target)} daily goal.</Text>
                </Card>
              )}

              <Card>
                <Text style={styles.eyebrow}>TIME BY THEME</Text>
                {stats.byCategory.length === 0 ? (
                  <Text style={styles.muted}>Nothing logged in this range yet.</Text>
                ) : (
                  stats.byCategory.map((c) => {
                    const cat = getCategory(c.categoryId);
                    return (
                      <View key={c.categoryId} style={styles.catRow}>
                        <Text style={styles.catLabel} numberOfLines={1}>
                          {cat?.icon} {cat?.name ?? c.categoryId}
                        </Text>
                        <View style={styles.catTrack}>
                          <View style={[styles.catFill, { width: `${(c.minutes / maxCat) * 100}%`, backgroundColor: getCategoryColor(c.categoryId, colors.primary) }]} />
                        </View>
                        <Text style={styles.catValue}>{formatMinutes(c.minutes)}</Text>
                      </View>
                    );
                  })
                )}
              </Card>
            </>
          )}

          <View style={styles.statsGrid}>
            <StatTile emoji="🔥" value={user.streak.current} label="Day streak" accent />
            <StatTile emoji="🏆" value={user.streak.longest} label="Longest streak" accent />
            <StatTile emoji="❄️" value={user.streak.freezesAvailable} label="Freezes saved" accent />
            <StatTile emoji="⏱️" value={summary?.todayMinutes ?? 0} label={`Min today of ${target}`} />
          </View>

          {lp ? (
            <Card>
              <Text style={styles.eyebrow}>LEVEL {lp.level}</Text>
              <View style={styles.levelTrack}>
                <View style={[styles.levelFill, { width: `${levelPct * 100}%` }]} />
              </View>
              <Text style={styles.muted}>
                {user.points - lp.levelStartXp} / {lp.nextLevelXp - lp.levelStartXp} XP to level {lp.level + 1} · 50 XP per focused hour
              </Text>
            </Card>
          ) : null}

          <Card>
            <Text style={styles.eyebrow}>RECENT SESSIONS</Text>
            {history.length === 0 ? (
              <Text style={styles.muted}>Your finished sessions will show up here.</Text>
            ) : (
              history.map((s) => {
                const cat = getCategory(s.categoryId);
                const when = new Date(s.endTime ?? s.startTime);
                return (
                  <View key={s._id} style={styles.sessionRow}>
                    <Text style={styles.sessionIcon}>{cat?.icon ?? '•'}</Text>
                    <View style={styles.sessionText}>
                      <Text style={styles.sessionTitle} numberOfLines={1}>
                        {s.spaceName ?? `Solo · ${cat?.name ?? 'Focus'}`}
                      </Text>
                      <Text style={styles.caption}>
                        {when.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                        {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.sessionRight}>
                      <Text style={styles.sessionValue}>
                        {formatMinutes(s.durationMin)}
                        {s.targetHit ? ' ✓' : ''}
                      </Text>
                      <Text style={styles.caption}>+{s.xpEarned} XP</Text>
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 120 },
  inner: { gap: 16 },
  innerDesktop: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.button,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: radii.button - 4, alignItems: 'center' },
  segmentItemActive: { backgroundColor: colors.primarySoft },
  segmentLabel: { ...textStyles.bodySmallMedium, color: colors.textMuted },
  segmentLabelActive: { color: colors.primaryLight },
  eyebrow: { ...textStyles.label, color: colors.textMuted, marginBottom: 8 },
  hero: { ...textStyles.display, color: colors.textPrimary },
  muted: { ...textStyles.bodySmall, color: colors.textSecondary, marginTop: 4 },
  caption: { ...textStyles.caption, color: colors.textMuted },
  monthBars: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 3, marginBottom: 8 },
  monthBarSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  monthBar: { width: '100%', borderRadius: 3, backgroundColor: colors.primaryDeep },
  monthBarGoal: { backgroundColor: colors.primary },
  monthBarEmpty: { backgroundColor: colors.border },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  catLabel: { ...textStyles.bodySmallMedium, color: colors.textPrimary, width: 128 },
  catTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  catFill: { height: '100%', borderRadius: 4 },
  catValue: { ...textStyles.bodySmall, color: colors.textSecondary, width: 58, textAlign: 'right' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  // Level-ups are a reward moment — gold is allowed here (claude.md §3a).
  levelTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceMuted, overflow: 'hidden', marginTop: 2 },
  levelFill: { height: '100%', borderRadius: 5, backgroundColor: colors.accentGold },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border },
  sessionIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  sessionText: { flex: 1, gap: 2 },
  sessionTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textPrimary },
  sessionRight: { alignItems: 'flex-end', gap: 2 },
  sessionValue: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
});
