import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card/Card';
import { ParticipantList } from '../components/SessionRoom/ParticipantList';
import { ReactionBar, type ReactionType } from '../components/SessionRoom/ReactionBar';
import { mockSessionCategories } from '../mocks/sessionCategories.mock';
import type { RootStackParamList } from '../navigation/routes';
import { usePopupStore } from '../store/usePopupStore';
import { useSessionStore } from '../store/useSessionStore';
import { useUserStore } from '../store/useUserStore';
import { colors, fonts, gradients, radii } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionRoom'>;

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// The actual core-loop screen (per this task's brief) — timer, target
// progress, who else is here (avatars + status pulse, no camera per §4),
// the fixed reaction set, and leave/complete. Same polish level as Home,
// same Card/gradient/radii conventions rather than a one-off look.
export function SessionRoomScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;
  const session = useSessionStore((s) => s.sessions.find((sess) => sess._id === sessionId));
  const completeSession = useSessionStore((s) => s.completeSession);
  const recordSessionResult = useUserStore((s) => s.recordSessionResult);
  const user = useUserStore((s) => s.user);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reactionCounts, setReactionCounts] = useState<Record<ReactionType, number>>({
    clap: 6,
    fire: 11,
    fist_bump: 2,
  });

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000));
      setElapsedSeconds(elapsed);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session || !user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>This session has ended.</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.missingButton}>
            <Text style={styles.missingButtonLabel}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const category = mockSessionCategories.find((c) => c._id === session.categoryId);
  const targetSeconds = session.durationTargetMin * 60;
  const progress = Math.min(1, elapsedSeconds / targetSeconds);
  const activeParticipants = session.participants.filter((p) => !p.leftAt);

  const finish = (targetHit: boolean) => {
    const completion = completeSession(session._id, targetHit);
    const outcome = recordSessionResult(completion);
    navigation.replace('PostSession', {
      sessionId: session._id,
      targetHit: completion.targetHit,
      minutesLogged: completion.minutesLogged,
      pointsEarned: outcome.pointsEarned,
      streakBefore: outcome.streakBefore,
      streakAfter: outcome.streakAfter,
    });
  };

  const handleComplete = () => finish(elapsedSeconds >= targetSeconds);
  const handleConfirmLeave = () => {
    usePopupStore.getState().hidePopup();
    finish(false);
  };
  const handleLeavePress = () => {
    usePopupStore.getState().showPopup({
      message:
        progress >= 0.5
          ? "Leave now? You've already put in enough time to keep your streak safe today."
          : "Leave before the halfway mark and this session won't count toward today's streak — that's okay, showing up again tomorrow still counts.",
      actions: [
        { label: 'Stay', onPress: () => usePopupStore.getState().hidePopup(), variant: 'secondary' },
        { label: 'Leave session', onPress: handleConfirmLeave },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleLeavePress}
          hitSlop={8}
          style={styles.closeButton}
          accessibilityLabel="Leave session"
        >
          <Feather name="x" size={20} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.topBarText}>
          <Text style={styles.themeLabel}>
            {category?.icon} {category?.name}
          </Text>
          <Text style={styles.sessionName} numberOfLines={1}>
            {session.name}
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>LIVE</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Card style={styles.timerCard}>
          <LinearGradient
            colors={[colors.primaryDeep + '33', 'transparent']}
            style={styles.timerWash}
            pointerEvents="none"
          />
          <Text style={styles.timerLabel}>
            {progress >= 1 ? "Target reached — nice work" : 'Focused time'}
          </Text>
          <Text style={styles.timerClock}>{formatClock(elapsedSeconds)}</Text>
          <Text style={styles.timerTarget}>of {session.durationTargetMin} min target</Text>

          <View style={styles.progressTrack}>
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
        </Card>

        <Card>
          <ParticipantList participants={activeParticipants} currentUserId={user._id} />
        </Card>

        <Card>
          <ReactionBar
            counts={reactionCounts}
            onReact={(type) => setReactionCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }))}
          />
        </Card>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={handleComplete} style={styles.completeWrap}>
          <LinearGradient colors={gradients.primary} style={styles.completeButton}>
            <Feather name="flag" size={17} color={colors.textPrimary} />
            <Text style={styles.completeLabel}>Complete session</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  topBarText: {
    flex: 1,
    gap: 1,
  },
  themeLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  sessionName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.error,
  },
  liveLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.error,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  timerCard: {
    alignItems: 'center',
    overflow: 'hidden',
    paddingVertical: 24,
  },
  timerWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
  },
  timerLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  timerClock: {
    fontFamily: fonts.headingBold,
    fontSize: 44,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  timerTarget: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginTop: 18,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  completeWrap: {
    borderRadius: radii.card,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: radii.card,
  },
  completeLabel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
