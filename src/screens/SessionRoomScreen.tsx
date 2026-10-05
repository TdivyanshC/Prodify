import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card/Card';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import { ParticipantList } from '../components/SessionRoom/ParticipantList';
import { ReactionBar, type ReactionType } from '../components/SessionRoom/ReactionBar';
import { mockSessionCategories } from '../mocks/sessionCategories.mock';
import type { RootStackParamList } from '../navigation/routes';
import { usePopupStore } from '../store/usePopupStore';
import { useSessionStore } from '../store/useSessionStore';
import { useUserStore } from '../store/useUserStore';
import { colors, fonts, gradients, radii } from '../theme';
import { useFriendsStore } from '../store/useFriendsStore';
import { useTogetherStreakStore } from '../store/useTogetherStreakStore';
import { useFocusModeStore } from '../store/useFocusModeStore';
import { useSpaceInviteStore } from '../store/useSpaceInviteStore';
import { getAcceptedFriendIds, getFriendProfile, getOtherUserId } from '../utils/friendHelpers';
import { InviteFriendsSheet } from '../components/SessionRoom/InviteFriendsSheet';
import { formatClock, formatMinutes, getGroupFocusedMinutes } from '../utils/sessionHelpers';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionRoom'>;

// The actual core-loop screen (per this task's brief) — timer, target
// progress, who else is here (avatars + status pulse, no camera per §4),
// the fixed reaction set, and leave/complete. Same polish level as Home,
// same Card/gradient/radii conventions rather than a one-off look.
export function SessionRoomScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;
  const session = useSessionStore((s) => s.sessions.find((sess) => sess._id === sessionId));
  const completeSession = useSessionStore((s) => s.completeSession);
  const recordSessionResult = useUserStore((s) => s.recordSessionResult);
  const recordTogether = useTogetherStreakStore((s) => s.recordTogether);
  const friendships = useFriendsStore((s) => s.friendships);
  const addInvitees = useSessionStore((s) => s.addInvitees);
  const sendInvites = useSpaceInviteStore((s) => s.sendInvites);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);

  // Focus mode for as long as the room is open: notifications are held
  // back and shown together on Post-Session ("While you focused").
  useEffect(() => {
    useFocusModeStore.getState().enter(sessionId);
    return () => useFocusModeStore.getState().exit();
  }, [sessionId]);
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
        <ScreenBackground />
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
  // Friends-only spaces are the host's circle, so only the host can widen
  // it; in a public space anyone can bring their own friends.
  const canInvite = session.hostId === user._id || session.isPublic;
  const alreadyAskedIds = new Set([
    ...activeParticipants.map((p) => p.userId),
    ...(session.invitedUserIds ?? []),
  ]);
  const invitableFriends = [...getAcceptedFriendIds(friendships, user._id)]
    .filter((id) => !alreadyAskedIds.has(id))
    .map((id) => getFriendProfile(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const handleSendInvites = (userIds: string[]) => {
    addInvitees(session._id, userIds);
    sendInvites(session._id, userIds);
    setInviteSheetOpen(false);
  };

  // Re-derived every second alongside elapsedSeconds (the tick re-renders).
  const groupMinutes = getGroupFocusedMinutes(session);
  const peopleHere = Math.max(session.participantCount, activeParticipants.length);
  const invitedNotHere = (session.invitedUserIds ?? [])
    .filter((id) => !activeParticipants.some((p) => p.userId === id))
    .map((id) => getFriendProfile(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ userId: p._id, displayName: p.displayName, avatarInitial: p.avatarInitial }));

  const finish = (targetHit: boolean) => {
    // Exit before recording the result, so this session's own rewards
    // (badge, level-up, freeze) toast right away instead of being held.
    useFocusModeStore.getState().exit();
    const completion = completeSession(session._id, targetHit);
    const outcome = recordSessionResult(completion);

    // Together streaks follow the same bar as the main streak — only a
    // streak-eligible session counts as a day focused together.
    const friendIds = new Set(
      friendships.filter((f) => f.status === 'accepted').map((f) => getOtherUserId(f, user._id))
    );
    const friendsHere = activeParticipants.filter((p) => friendIds.has(p.userId));
    const togetherChanges = completion.streakEligible ? recordTogether(friendsHere.map((p) => p.userId)) : [];

    navigation.replace('PostSession', {
      sessionId: session._id,
      targetHit: completion.targetHit,
      minutesLogged: completion.minutesLogged,
      pointsEarned: outcome.pointsEarned,
      streakBefore: outcome.streakBefore,
      streakAfter: outcome.streakAfter,
      togetherStreaks: togetherChanges.map((c) => ({
        name: friendsHere.find((p) => p.userId === c.userId)?.displayName.split(' ')[0] ?? 'A friend',
        days: c.after,
        grew: c.after > c.before,
      })),
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
      <ScreenBackground />
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

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
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

          {peopleHere > 1 ? (
            <View style={styles.groupRow}>
              <Text style={styles.groupEmoji}>👥</Text>
              <Text style={styles.groupText}>
                Together: <Text style={styles.groupValue}>{formatMinutes(groupMinutes)}</Text> focused across{' '}
                {peopleHere} people
              </Text>
            </View>
          ) : null}
        </Card>

        <Card>
          <ParticipantList
            participants={activeParticipants}
            currentUserId={user._id}
            hostId={session.hostId}
            invited={invitedNotHere}
            onInvite={canInvite ? () => setInviteSheetOpen(true) : undefined}
          />
        </Card>

        <Card>
          <ReactionBar
            counts={reactionCounts}
            onReact={(type) => setReactionCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }))}
          />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handleComplete} style={styles.completeWrap}>
          <LinearGradient colors={gradients.primary} style={styles.completeButton}>
            <Feather name="flag" size={17} color={colors.textPrimary} />
            <Text style={styles.completeLabel}>Complete session</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <InviteFriendsSheet
        visible={inviteSheetOpen}
        friends={invitableFriends}
        onClose={() => setInviteSheetOpen(false)}
        onSend={handleSendInvites}
      />
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
  contentScroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 12,
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
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  groupEmoji: {
    fontSize: 15,
  },
  groupText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  groupValue: {
    fontFamily: fonts.headingBold,
    color: colors.primaryLight,
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
