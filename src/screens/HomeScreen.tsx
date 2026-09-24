import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatWallpaper } from '../components/ChatWallpaper/ChatWallpaper';
import { CreateSessionCTA } from '../components/Home/CreateSessionCTA';
import { HomeHeader } from '../components/Home/HomeHeader';
import { SessionCapsulesRow, type SessionCapsuleEntry } from '../components/Home/SessionCapsulesRow';
import { StreakSpotlight } from '../components/Home/StreakSpotlight';
import { CreateSessionModal } from '../components/Sessions/CreateSessionModal';
import { SparkPeek } from '../components/Mascot/SparkPeek';
import { mockHomeStats } from '../mocks/homeStats.mock';
import { mockSessionCategories } from '../mocks/sessionCategories.mock';
import type { RootStackParamList } from '../navigation/routes';
import { useCreateSessionModalStore } from '../store/useCreateSessionModalStore';
import { usePopupStore } from '../store/usePopupStore';
import { useSessionStore } from '../store/useSessionStore';
import { useSparkOverlayStore, type SparkEventKey } from '../store/useSparkOverlayStore';
import { useUserStore } from '../store/useUserStore';
import { getCategoryColor } from '../theme/categoryColors';
import { pickRandomLottie } from '../utils/lottiePool';
import { getRemainingMinutes } from '../utils/sessionHelpers';
import { ACTIVE_THEME, colors, fonts, palettes, radii } from '../theme';

// Wireframe (primary layout reference for this screen): Greeting -> Daily
// Tracker -> Create & Start Session -> Session Capsules -> Spark -> nav.
// Home stays a single intentional composition, not a dashboard — no
// section here exists just because it's common in productivity apps.
export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useUserStore((state) => state.user);
  const refreshUser = useUserStore((state) => state.refresh);
  const sessions = useSessionStore((state) => state.sessions);
  const refreshSessions = useSessionStore((state) => state.refresh);
  const createSession = useSessionStore((state) => state.createSession);
  const joinSession = useSessionStore((state) => state.joinSession);
  const openCreateModal = useCreateSessionModalStore((state) => state.open);
  const showSpark = useSparkOverlayStore((state) => state.showSpark);

  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  useEffect(() => {
    if (!user) refreshUser();
  }, [user, refreshUser]);
  useEffect(() => {
    if (sessions.length === 0) refreshSessions();
  }, [sessions.length, refreshSessions]);

  // Spark is contextual, never random (§10): one relevant moment on
  // arrival at most — streak milestone > inactivity > first visit > quiet.
  useEffect(() => {
    if (!user || hasAutoTriggered) return;
    setHasAutoTriggered(true);

    const streak = user.streak.current;
    const daysSinceActive = user.streak.lastActiveDate
      ? (Date.now() - new Date(user.streak.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    let eventKey: SparkEventKey | null = null;
    if (streak > 0 && streak % 7 === 0) eventKey = 'streak_milestone';
    else if (daysSinceActive >= 2) eventKey = 'inactivity';
    else if (mockHomeStats.sessionsCompletedTotal === 0) eventKey = 'first_visit';

    if (eventKey) {
      const timer = setTimeout(() => showSpark(eventKey as SparkEventKey), 500);
      return () => clearTimeout(timer);
    }
  }, [user, hasAutoTriggered, showSpark]);

  const handlePeekPress = () => {
    // Personality tier (§9): Spark gets more familiar as sessionsCompleted
    // grows — first_visit -> returning -> regular.
    const sessionsCompleted = mockHomeStats.sessionsCompletedTotal;
    const tier: SparkEventKey =
      sessionsCompleted === 0 ? 'first_visit' : sessionsCompleted < 6 ? 'returning' : 'regular';
    showSpark(tier);
  };

  const joinedSessions = sessions
    .filter((s) => s.participants.some((p) => p.userId === user?._id && !p.leftAt))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  const lastJoinedSession = joinedSessions[0];

  const handleStartAgain = () => {
    if (!lastJoinedSession) return;
    const session = createSession({
      name: lastJoinedSession.name,
      categoryId: lastJoinedSession.categoryId,
      durationMin: lastJoinedSession.durationTargetMin,
      description: lastJoinedSession.description,
      isPublic: lastJoinedSession.isPublic,
    });
    navigation.navigate('SessionRoom', { sessionId: session._id });
  };

  // Suggested: one live session the user hasn't joined — keeps the row at
  // 1-3 capsules total, never a discovery feed (§5, §13).
  const suggestedSession = sessions.find(
    (s) => !s.participants.some((p) => p.userId === user?._id && !p.leftAt)
  );

  const capsuleEntries: SessionCapsuleEntry[] = [];
  if (lastJoinedSession) {
    const category = mockSessionCategories.find((c) => c._id === lastJoinedSession.categoryId);
    capsuleEntries.push({
      id: lastJoinedSession._id,
      icon: category?.icon ?? '💻',
      title: lastJoinedSession.name,
      meta: `${category?.name} · ${lastJoinedSession.durationTargetMin} min`,
      accentColor: getCategoryColor(lastJoinedSession.categoryId, colors.primary),
      actionLabel: 'Continue',
      onAction: handleStartAgain,
    });
  }
  if (suggestedSession) {
    const category = mockSessionCategories.find((c) => c._id === suggestedSession.categoryId);
    capsuleEntries.push({
      id: suggestedSession._id,
      icon: category?.icon ?? '💻',
      title: suggestedSession.name,
      isLive: true,
      meta: `${suggestedSession.participantCount} people · ${getRemainingMinutes(suggestedSession)} min left`,
      accentColor: getCategoryColor(suggestedSession.categoryId, colors.primary),
      actionLabel: 'Join',
      onAction: () => {
        joinSession(suggestedSession._id);
        navigation.navigate('SessionRoom', { sessionId: suggestedSession._id });
      },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {palettes[ACTIVE_THEME].hasWallpaper ? <ChatWallpaper /> : null}
      <LinearGradient
        colors={[colors.primaryDeep + '2E', colors.background]}
        style={styles.backdrop}
        pointerEvents="none"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <HomeHeader
            name={user?.displayName ?? 'there'}
            avatarInitial={user?.displayName?.[0]}
          />

          {user ? (
            <StreakSpotlight
              productiveMinutesToday={mockHomeStats.productiveMinutesToday}
              dailyTargetMinutes={mockHomeStats.dailyTargetMinutes}
              xpToday={mockHomeStats.xpToday}
              currentStreak={user.streak.current}
            />
          ) : null}

          <CreateSessionCTA onPress={() => openCreateModal()} />

          <SessionCapsulesRow entries={capsuleEntries} />

          {/* TEMP: dev-client Lottie check — remove once confirmed */}
          <Pressable
            onPress={() =>
              usePopupStore.getState().showPopup({
                title: 'Session started!',
                message: "You're locked in — stay focused and we'll catch you at the finish line.",
                lottieSource: pickRandomLottie(),
                actions: [{ label: 'Close', onPress: () => usePopupStore.getState().hidePopup() }],
              })
            }
            style={styles.lottieTestButton}
          >
            <Text style={styles.lottieTestLabel}>🧪 Lottie test — Start Session</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.peekWrap}>
        <SparkPeek onPress={handlePeekPress} />
      </View>

      <CreateSessionModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  inner: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 24,
  },
  lottieTestButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.warning,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  lottieTestLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.warning,
  },
  peekWrap: {
    alignItems: 'flex-start',
    paddingLeft: 20,
    paddingBottom: 4,
  },
});
