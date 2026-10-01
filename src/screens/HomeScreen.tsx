import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FriendsLiveNudge } from '../components/Home/FriendsLiveNudge';
import { HomeHeader } from '../components/Home/HomeHeader';
import { StreakSpotlight } from '../components/Home/StreakSpotlight';
import { SparkPeek } from '../components/Mascot/SparkPeek';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import { CreatorQuote } from '../components/Sessions/CreatorQuote';
import { SessionCard } from '../components/Sessions/SessionCard';
import { mockHomeStats } from '../mocks/homeStats.mock';
import { mockSessionCategories } from '../mocks/sessionCategories.mock';
import type { RootStackParamList } from '../navigation/routes';
import { useCreateSessionModalStore } from '../store/useCreateSessionModalStore';
import { useFriendsStore } from '../store/useFriendsStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { usePopupStore } from '../store/usePopupStore';
import { useSessionStore } from '../store/useSessionStore';
import { useSparkOverlayStore, type SparkEventKey } from '../store/useSparkOverlayStore';
import { useUserStore } from '../store/useUserStore';
import { pickRandomLottie } from '../utils/lottiePool';
import { getFriendProfile, getOtherUserId } from '../utils/friendHelpers';
import { getFocusingFriendIds, isUserInSession } from '../utils/sessionHelpers';
import type { FriendProfile } from '../types/social';
import { pickRandomSessionQuote } from '../utils/sessionQuotePool';
import { colors, fonts, gradients, radii } from '../theme';

// Wireframe (primary layout reference for this screen): Greeting -> Daily
// Tracker -> Your Sessions + Create + quote -> Spark -> nav. Home stays a
// single intentional composition, not a dashboard — no section here
// exists just because it's common in productivity apps. The old separate
// "continue/suggested" capsule row was folded into this one Your
// Sessions list instead of showing the same sessions twice. The session-
// cards/Create-button/quote block itself moved here from the Sessions
// tab (by request) — Sessions tab reverted to its pure browse/join grid.
export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useUserStore((state) => state.user);
  const refreshUser = useUserStore((state) => state.refresh);
  const sessions = useSessionStore((state) => state.sessions);
  const refreshSessions = useSessionStore((state) => state.refresh);
  const joinSession = useSessionStore((state) => state.joinSession);
  const showSpark = useSparkOverlayStore((state) => state.showSpark);
  const openCreateModal = useCreateSessionModalStore((state) => state.open);
  const friendships = useFriendsStore((state) => state.friendships);
  const friendsLoaded = useFriendsStore((state) => state.hasLoaded);
  const refreshFriends = useFriendsStore((state) => state.refresh);
  const hasUnreadNotifications = useNotificationStore((state) => state.notifications.some((n) => !n.openedAt));

  // Refs, not state: flipping a state flag re-ran the effect below, and
  // that re-run's cleanup cancelled the pending timer before Spark ever
  // appeared. The timer is only cleared on unmount now.
  const hasAutoTriggered = useRef(false);
  const autoTriggerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (autoTriggerTimer.current) clearTimeout(autoTriggerTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!user) refreshUser();
  }, [user, refreshUser]);
  useEffect(() => {
    if (sessions.length === 0) refreshSessions();
  }, [sessions.length, refreshSessions]);
  useEffect(() => {
    if (!friendsLoaded) refreshFriends();
  }, [friendsLoaded, refreshFriends]);

  const focusingFriends = useMemo(() => {
    const friendIds = new Set(
      friendships.filter((f) => f.status === 'accepted').map((f) => getOtherUserId(f, user?._id))
    );
    return getFocusingFriendIds(sessions, friendIds)
      .map((id) => getFriendProfile(id))
      .filter((p): p is FriendProfile => Boolean(p));
  }, [friendships, sessions, user?._id]);

  // Spark is contextual, never random (§10): one relevant moment on
  // arrival at most — streak milestone > inactivity > first visit >
  // friends live right now > quiet. Waits for friends + sessions so the
  // friends_live check isn't made against empty stores.
  useEffect(() => {
    if (!user || hasAutoTriggered.current || !friendsLoaded || sessions.length === 0) return;
    hasAutoTriggered.current = true;

    const streak = user.streak.current;
    const daysSinceActive = user.streak.lastActiveDate
      ? (Date.now() - new Date(user.streak.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    let eventKey: SparkEventKey | null = null;
    let vars: Record<string, string | number> = {};
    if (streak > 0 && streak % 7 === 0) eventKey = 'streak_milestone';
    else if (daysSinceActive >= 2) eventKey = 'inactivity';
    else if (mockHomeStats.sessionsCompletedTotal === 0) eventKey = 'first_visit';
    else if (focusingFriends.length > 0) {
      eventKey = 'friends_live';
      vars = {
        crew:
          focusingFriends.length === 1
            ? `${focusingFriends[0].displayName.split(' ')[0]} is`
            : `${focusingFriends.length} of your friends are`,
      };
    }

    if (eventKey) {
      const key = eventKey;
      autoTriggerTimer.current = setTimeout(() => showSpark(key, vars), 500);
    }
  }, [user, friendsLoaded, sessions.length, focusingFriends, showSpark]);

  const handlePeekPress = () => {
    // Personality tier (§9): Spark gets more familiar as sessionsCompleted
    // grows — first_visit -> returning -> regular.
    const sessionsCompleted = mockHomeStats.sessionsCompletedTotal;
    const tier: SparkEventKey =
      sessionsCompleted === 0 ? 'first_visit' : sessionsCompleted < 6 ? 'returning' : 'regular';
    showSpark(tier);
  };

  // Friends' spaces share this store but belong to the Spaces tab — Home's
  // list stays the seeded sessions plus anything the user started.
  const activeSessions = sessions.filter(
    (s) => s.status === 'active' && (s.isBotSeeded || s.hostId === user?._id)
  );
  const categoryForId = (categoryId: string) => mockSessionCategories.find((c) => c._id === categoryId);

  // Every Start Session tap shows the popup with a fresh quote — never
  // the same canned line twice in a row (pickRandomSessionQuote) — and
  // only navigates into the room once the user acknowledges it.
  const handleStartSession = (session: (typeof activeSessions)[number]) => {
    if (!(user && isUserInSession(session, user._id))) {
      joinSession(session._id);
    }
    usePopupStore.getState().showPopup({
      title: 'Session started!',
      message: pickRandomSessionQuote(),
      lottieSource: pickRandomLottie(),
      actions: [
        {
          label: "Let's go",
          onPress: () => {
            usePopupStore.getState().hidePopup();
            navigation.navigate('SessionRoom', { sessionId: session._id });
          },
        },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenBackground />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <HomeHeader
            name={user?.displayName ?? 'there'}
            avatarInitial={user?.displayName?.[0]}
            hasNotification={hasUnreadNotifications}
            onNotificationPress={() => navigation.navigate('Notifications')}
          />

          {user ? (
            <StreakSpotlight
              productiveMinutesToday={mockHomeStats.productiveMinutesToday}
              dailyTargetMinutes={mockHomeStats.dailyTargetMinutes}
              xpToday={mockHomeStats.xpToday}
              currentStreak={user.streak.current}
            />
          ) : null}

          {focusingFriends.length > 0 ? (
            <FriendsLiveNudge
              friends={focusingFriends}
              // A tab route, not a RootStack one — same cast Sidebar uses.
              onPress={() => navigation.navigate('Spaces' as never)}
            />
          ) : null}

          {activeSessions.length > 0 ? (
            <View style={styles.sessionsContainer}>
              <Text style={styles.sectionLabel}>YOUR SESSIONS</Text>
              {activeSessions.map((session) => (
                <SessionCard
                  key={session._id}
                  session={session}
                  category={categoryForId(session.categoryId)}
                  onStart={() => handleStartSession(session)}
                />
              ))}
            </View>
          ) : null}

          <Pressable onPress={() => openCreateModal()} style={styles.createButtonWrap}>
            <LinearGradient colors={gradients.primary} style={styles.createButton}>
              <Text style={styles.createButtonLabel}>+ Create Session</Text>
            </LinearGradient>
          </Pressable>

          <CreatorQuote />
        </View>
      </ScrollView>

      <View style={styles.peekWrap}>
        <SparkPeek onPress={handlePeekPress} />
      </View>
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
    paddingTop: 16,
    paddingBottom: 12,
  },
  sessionsContainer: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  createButtonWrap: {
    borderRadius: radii.card,
  },
  createButton: {
    paddingVertical: 14,
    borderRadius: radii.card,
    alignItems: 'center',
  },
  createButtonLabel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inner: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 24,
  },
  peekWrap: {
    alignItems: 'flex-start',
    paddingLeft: 20,
    paddingBottom: 4,
  },
});
