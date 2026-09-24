import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, gradients } from '../../theme';
import { useCountUp } from '../../utils/useCountUp';

interface StreakSpotlightProps {
  currentStreak: number;
  productiveMinutesToday: number;
  dailyTargetMinutes: number;
  xpToday: number;
}

function formatMinutes(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// The streak is the emotional core of the gamification loop (claude.md
// §1/§4) — this makes it the actual visual hero of Home instead of one
// number among several in a flat stats row. A ground-up rebuild of the
// old "Today's Progress" card: the streak count is huge and glowing, a
// goal-progress bar shows today's standing at a glance, and XP/remaining
// time drop to secondary chips underneath rather than competing for
// attention.
export function StreakSpotlight({
  currentStreak,
  productiveMinutesToday,
  dailyTargetMinutes,
  xpToday,
}: StreakSpotlightProps) {
  const countedStreak = useCountUp(currentStreak, 700);
  const countedXp = useCountUp(xpToday);
  const progress = Math.min(1, productiveMinutesToday / dailyTargetMinutes);
  const remaining = Math.max(0, dailyTargetMinutes - productiveMinutesToday);

  const glow = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    );
    loop.start();
    Animated.timing(barWidth, {
      toValue: progress,
      duration: 900,
      useNativeDriver: false,
    }).start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glow, progress]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.65] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });
  const barWidthPercent = barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.card}>
      <LinearGradient colors={gradients.wash} style={styles.wash} pointerEvents="none" />
      <View style={styles.blob} pointerEvents="none">
        <LinearGradient colors={gradients.primary} style={styles.blobFill} />
      </View>

      <Text style={styles.eyebrow}>YOUR STREAK</Text>

      <View style={styles.heroRow}>
        <View style={styles.flameWrap}>
          <AnimatedLinearGradient
            colors={[colors.accentGold, gradients.primary[0]]}
            style={[styles.flameGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
          />
          <Text style={styles.flame}>🔥</Text>
        </View>
        <View style={styles.heroTextBlock}>
          <Text style={styles.heroNumber}>{countedStreak}</Text>
          <Text style={styles.heroLabel}>day streak — keep it lit</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Today's goal</Text>
          <Text style={styles.progressValue}>
            {formatMinutes(productiveMinutesToday)} / {formatMinutes(dailyTargetMinutes)}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFillWrap, { width: barWidthPercent }]}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.progressFill} />
          </Animated.View>
        </View>
      </View>

      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <Text style={styles.chipEmoji}>⚡</Text>
          <Text style={styles.chipText}>
            <Text style={styles.chipValue}>+{countedXp}</Text> XP today
          </Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipEmoji}>🎯</Text>
          <Text style={styles.chipText}>
            {remaining > 0 ? (
              <>
                <Text style={styles.chipValue}>{formatMinutes(remaining)}</Text> to goal
              </>
            ) : (
              'Goal hit today'
            )}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: 20,
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
    height: 140,
  },
  blob: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    opacity: 0.18,
  },
  blobFill: {
    width: '100%',
    height: '100%',
  },
  eyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  flameWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGlow: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  flame: {
    fontSize: 32,
  },
  heroTextBlock: {
    gap: 0,
  },
  heroNumber: {
    fontFamily: fonts.headingBold,
    fontSize: 48,
    lineHeight: 52,
    color: colors.accentGold,
  },
  heroLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -2,
  },
  progressSection: {
    marginTop: 20,
    gap: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  progressValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFillWrap: {
    height: '100%',
  },
  progressFill: {
    flex: 1,
    borderRadius: 5,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipEmoji: {
    fontSize: 15,
  },
  chipText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  chipValue: {
    fontFamily: fonts.bodySemiBold,
    color: colors.textPrimary,
  },
});
