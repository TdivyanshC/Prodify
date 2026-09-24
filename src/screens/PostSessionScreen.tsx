import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card/Card';
import { SuccessBadge } from '../components/PostSession/SuccessBadge';
import type { RootStackParamList } from '../navigation/routes';
import { useSparkOverlayStore } from '../store/useSparkOverlayStore';
import { colors, fonts, gradients, radii } from '../theme';
import { useCountUp } from '../utils/useCountUp';

type Props = NativeStackScreenProps<RootStackParamList, 'PostSession'>;

// Completion summary — both the "target hit" and "ended early" paths land
// here (routed by targetHit), sharing the same layout with different copy
// per claude.md §4 (never shaming a missed target). The mascot reaction
// itself reuses the existing Spark popup (blur + compact mascot + queued
// quotes) rather than a bespoke mascot UI on this screen — it pops in on
// arrival, and clearing it reveals the summary underneath.
export function PostSessionScreen({ route, navigation }: Props) {
  const { targetHit, minutesLogged, pointsEarned, streakBefore, streakAfter } = route.params;
  const showSpark = useSparkOverlayStore((s) => s.showSpark);
  const countedPoints = useCountUp(pointsEarned);
  const streakGrew = streakAfter > streakBefore;

  useEffect(() => {
    const timer = setTimeout(() => {
      showSpark(targetHit ? 'session_complete' : 'missed_target', { minutes: minutesLogged });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDone = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <SuccessBadge emoji={targetHit ? '🎉' : '🌱'} variant={targetHit ? 'celebrate' : 'grow'} />
        <Text style={styles.heading}>{targetHit ? 'Session complete' : 'Session logged'}</Text>
        <Text style={styles.subheading}>
          {targetHit
            ? `You stayed focused for ${minutesLogged} minutes — that's another one in the log.`
            : "Didn't hit the full target this time — that's okay, showing up still counts."}
        </Text>

        <Card style={styles.summaryCard}>
          <LinearGradient
            colors={[colors.primaryDeep + '33', 'transparent']}
            style={styles.wash}
            pointerEvents="none"
          />

          <View style={styles.metricRow}>
            <View style={styles.metric}>
              <Text style={styles.metricEmoji}>⚡</Text>
              <Text style={styles.metricValue}>+{countedPoints}</Text>
              <Text style={styles.metricLabel}>XP earned</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metric}>
              <Text style={styles.metricEmoji}>⏱️</Text>
              <Text style={styles.metricValue}>{minutesLogged}m</Text>
              <Text style={styles.metricLabel}>Logged</Text>
            </View>
          </View>

          <View style={styles.streakRow}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>
              <Text style={styles.streakValue}>{streakAfter}</Text> day streak
              {streakGrew ? <Text style={styles.streakDelta}>  +1 today</Text> : null}
            </Text>
          </View>
        </Card>

        <Pressable onPress={handleDone} style={styles.doneWrap}>
          <LinearGradient colors={gradients.primary} style={styles.doneButton}>
            <Text style={styles.doneLabel}>Done</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  heading: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 2,
  },
  summaryCard: {
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    marginTop: 24,
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  metric: {
    alignItems: 'center',
    gap: 2,
  },
  metricEmoji: {
    fontSize: 16,
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: fonts.headingBold,
    fontSize: 24,
    color: colors.accentGold,
  },
  metricLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  streakEmoji: {
    fontSize: 18,
  },
  streakText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  streakValue: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
    color: colors.accentGold,
  },
  streakDelta: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.success,
  },
  doneWrap: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.card,
    marginTop: 28,
  },
  doneButton: {
    paddingVertical: 15,
    borderRadius: radii.card,
    alignItems: 'center',
  },
  doneLabel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
