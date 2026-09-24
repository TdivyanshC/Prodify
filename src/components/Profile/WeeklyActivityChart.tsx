import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, gradients, radii, shadows } from '../../theme';

interface WeeklyActivityChartProps {
  data: { day: string; minutes: number }[];
}

function formatHours(totalMinutes: number): string {
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

const CHART_HEIGHT = 92;

// Hand-built bar chart using core RN Animated — no chart library in this
// project (same "no Lottie in Expo Go" reasoning that led SuccessBadge to
// hand-roll its animation, applies here too: keep the dependency surface
// flat). The last entry is always treated as "today" and gets the gradient
// fill; the rest render as a muted violet so today reads as the standout.
export function WeeklyActivityChart({ data }: WeeklyActivityChartProps) {
  const maxMinutes = Math.max(...data.map((d) => d.minutes), 1);
  const totalMinutes = data.reduce((sum, d) => sum + d.minutes, 0);
  const heights = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      60,
      heights.map((anim, i) =>
        Animated.timing(anim, {
          toValue: data[i].minutes / maxMinutes,
          duration: 700,
          useNativeDriver: false,
        })
      )
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>THIS WEEK</Text>
        <Text style={styles.total}>{formatHours(totalMinutes)}</Text>
      </View>

      <View style={styles.chartRow}>
        {data.map((d, i) => {
          const isToday = i === data.length - 1;
          const barHeight = heights[i].interpolate({
            inputRange: [0, 1],
            outputRange: [4, CHART_HEIGHT],
          });
          return (
            <View key={d.day} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <Animated.View style={[styles.barFillWrap, { height: barHeight }]}>
                  {isToday ? (
                    <LinearGradient
                      colors={gradients.primary}
                      start={{ x: 0, y: 1 }}
                      end={{ x: 0, y: 0 }}
                      style={styles.barFill}
                    />
                  ) : (
                    <View style={[styles.barFill, styles.barFillMuted]} />
                  )}
                </Animated.View>
              </View>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{d.day}</Text>
            </View>
          );
        })}
      </View>
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
    gap: 16,
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
  total: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: CHART_HEIGHT + 22,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    width: '100%',
    height: CHART_HEIGHT,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFillWrap: {
    width: '100%',
  },
  barFill: {
    flex: 1,
    borderRadius: 8,
  },
  barFillMuted: {
    backgroundColor: colors.primaryDeep,
    opacity: 0.45,
  },
  dayLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    color: colors.textMuted,
  },
  dayLabelToday: {
    color: colors.primaryLight,
    fontFamily: fonts.bodySemiBold,
  },
});
