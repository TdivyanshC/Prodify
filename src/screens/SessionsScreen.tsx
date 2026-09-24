import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/AppShell/Header';
import { Card } from '../components/Card/Card';
import { CreateSessionModal } from '../components/Sessions/CreateSessionModal';
import { EmptySessionsState } from '../components/Sessions/EmptySessionsState';
import { LiveSessionCard } from '../components/Sessions/LiveSessionCard';
import { ThemeCarousel } from '../components/Sessions/ThemeCarousel';
import { mockSessionCategories } from '../mocks/sessionCategories.mock';
import { DESKTOP_BREAKPOINT, type RootStackParamList } from '../navigation/routes';
import { useCreateSessionModalStore } from '../store/useCreateSessionModalStore';
import { useSessionStore } from '../store/useSessionStore';
import { useUserStore } from '../store/useUserStore';
import { colors, fonts, gradients, radii, shadows } from '../theme';
import { isUserInSession } from '../utils/sessionHelpers';

// Full session browse page — the same live-session data/state as Home's
// Live Now, just uncapped and filterable by theme. Backs both the desktop
// "Sessions" sidebar item and the mobile "Explore" tab (architecture §1
// §10).
export function SessionsScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const user = useUserStore((state) => state.user);
  const sessions = useSessionStore((state) => state.sessions);
  const refreshSessions = useSessionStore((state) => state.refresh);
  const joinSession = useSessionStore((state) => state.joinSession);
  const leaveSession = useSessionStore((state) => state.leaveSession);
  const openCreateModal = useCreateSessionModalStore((state) => state.open);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (sessions.length === 0) refreshSessions();
  }, [sessions.length, refreshSessions]);

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const filteredSessions = selectedCategoryId
    ? activeSessions.filter((s) => s.categoryId === selectedCategoryId)
    : activeSessions;

  // The busiest session gets pulled out as a spotlight card above the
  // regular list — real visual hierarchy instead of a flat stack of
  // identically-sized cards.
  const sortedByActivity = [...filteredSessions].sort((a, b) => b.participantCount - a.participantCount);
  const featuredSession = sortedByActivity[0];
  const restSessions = sortedByActivity.slice(1);

  const categoryForId = (categoryId: string) => mockSessionCategories.find((c) => c._id === categoryId);

  const liveCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const session of activeSessions) {
      counts[session.categoryId] = (counts[session.categoryId] ?? 0) + 1;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessions.length]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header title="Sessions" avatarInitial={user?.displayName?.[0]} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.inner, isDesktop && styles.innerDesktop]}>
          <ThemeCarousel
            categories={mockSessionCategories}
            selectedCategoryId={selectedCategoryId}
            liveCounts={liveCounts}
            onSelect={setSelectedCategoryId}
          />

          <CreateSessionButton onPress={() => openCreateModal(selectedCategoryId)} />

          {filteredSessions.length === 0 ? (
            <Card>
              <EmptySessionsState onCreatePress={() => openCreateModal(selectedCategoryId)} />
            </Card>
          ) : (
            <>
              {featuredSession ? (
                <LiveSessionCard
                  featured
                  session={featuredSession}
                  category={categoryForId(featuredSession.categoryId)}
                  onPress={() => {
                    if (user && isUserInSession(featuredSession, user._id)) {
                      navigation.navigate('SessionRoom', { sessionId: featuredSession._id });
                    }
                  }}
                  onToggleJoin={() => {
                    const alreadyJoined = Boolean(user && isUserInSession(featuredSession, user._id));
                    if (alreadyJoined) {
                      leaveSession(featuredSession._id);
                    } else {
                      joinSession(featuredSession._id);
                      navigation.navigate('SessionRoom', { sessionId: featuredSession._id });
                    }
                  }}
                />
              ) : null}

              {restSessions.length > 0 ? (
                <View style={styles.sessionList}>
                  {restSessions.map((session) => (
                    <LiveSessionCard
                      key={session._id}
                      session={session}
                      category={categoryForId(session.categoryId)}
                      onPress={() => {
                        if (user && isUserInSession(session, user._id)) {
                          navigation.navigate('SessionRoom', { sessionId: session._id });
                        }
                      }}
                      onToggleJoin={() => {
                        const alreadyJoined = Boolean(user && isUserInSession(session, user._id));
                        if (alreadyJoined) {
                          leaveSession(session._id);
                        } else {
                          joinSession(session._id);
                          navigation.navigate('SessionRoom', { sessionId: session._id });
                        }
                      }}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <CreateSessionModal />
    </SafeAreaView>
  );
}

function CreateSessionButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8, tension: 220 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 160 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[shadows.glow, { transform: [{ scale }] }]}>
        <LinearGradient colors={gradients.primary} style={styles.createCta}>
          <LinearGradient colors={[colors.sheen, 'transparent']} style={styles.createCtaSheen} pointerEvents="none" />
          <Text style={styles.createCtaTitle}>+ Create a Session</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  inner: {
    gap: 16,
  },
  innerDesktop: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  createCta: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radii.card,
    alignItems: 'center',
    overflow: 'hidden',
  },
  createCtaSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  createCtaTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  sessionList: {
    gap: 12,
  },
});
