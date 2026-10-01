import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import type { Session } from '../../types/models';
import { colors, fonts, gradients, radii } from '../../theme';
import { formatClock, getElapsedSeconds } from '../../utils/sessionHelpers';
import { useNow } from '../../utils/useNow';

interface SpaceTimerProps {
  session: Session;
}

// Live clock for a space — same "elapsed since startTime, against the
// duration target" read as Session Room's timer, so the number on the
// card is the number you land on after joining. Owns its own tick so a
// second passing re-renders this block only, not the whole Spaces screen.
export function SpaceTimer({ session }: SpaceTimerProps) {
  const isFocused = useIsFocused();
  const now = useNow(1000, isFocused);

  const elapsedSeconds = getElapsedSeconds(session, now);
  const targetSeconds = session.durationTargetMin * 60;
  const progress = Math.min(1, elapsedSeconds / targetSeconds);
  const remainingMin = Math.max(0, Math.ceil((targetSeconds - elapsedSeconds) / 60));
  const targetReached = progress >= 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>FOCUSED TIME</Text>
          <Text style={styles.clock}>{formatClock(elapsedSeconds)}</Text>
        </View>
        <View style={styles.targetColumn}>
          <Text style={styles.target}>of {session.durationTargetMin} min</Text>
          <Text style={[styles.remaining, targetReached && styles.remainingReached]}>
            {targetReached ? 'Target reached' : `${remainingMin} min left`}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${progress * 100}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    padding: 12,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  clock: {
    fontFamily: fonts.headingBold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  targetColumn: {
    alignItems: 'flex-end',
    gap: 1,
    paddingBottom: 4,
  },
  target: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  remaining: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryLight,
  },
  remainingReached: {
    color: colors.success,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
