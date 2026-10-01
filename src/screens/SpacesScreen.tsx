import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/AppShell/Header';
import { Card } from '../components/Card/Card';
import { Mascot } from '../components/Mascot/Mascot';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import { CreatorQuote } from '../components/Sessions/CreatorQuote';
import { LiveSessionCard } from '../components/Sessions/LiveSessionCard';
import { EndedSpaceRow } from '../components/Spaces/EndedSpaceRow';
import { FriendSpaceCard } from '../components/Spaces/FriendSpaceCard';
import { ScheduledSpaceCard } from '../components/Spaces/ScheduledSpaceCard';
import { mockSessionCategories } from '../mocks/sessionCategories.mock';
import { DESKTOP_BREAKPOINT, type RootStackParamList } from '../navigation/routes';
import { useCreateSessionModalStore } from '../store/useCreateSessionModalStore';
import { useFriendsStore } from '../store/useFriendsStore';
import { usePopupStore } from '../store/usePopupStore';
import { useSessionStore } from '../store/useSessionStore';
import { useSpaceInviteStore } from '../store/useSpaceInviteStore';
import { useUserStore } from '../store/useUserStore';
import { colors, fonts, gradients, radii } from '../theme';
import { getFriendProfile, getOtherUserId } from '../utils/friendHelpers';
import { getRemainingMinutes, isFriendSpace, isUserInSession } from '../utils/sessionHelpers';
import { pickRandomSpaceQuote } from '../utils/sessionQuotePool';

const GRID_GAP = 12;
const SCREEN_PADDING = 20;
const MAX_CONTAINER_WIDTH = 960;

// Spaces tab (replaces the old Sessions browse tab). Top to bottom, in
// order of "can I act on this right now": your own live space, friends'
// live spaces (invited ones first — host, live timer, friends inside,
// cheer/join), friends' scheduled spaces (remind me), public spaces from
// everyone else, then friends' recently ended ones (start one like this).
// "Start a space" is still the floating Create tab's job — it's only
// repeated here when no friend is live, where it's the one useful next
// action.
export function SpacesScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const user = useUserStore((state) => state.user);
  const sessions = useSessionStore((state) => state.sessions);
  const refreshSessions = useSessionStore((state) => state.refresh);
  const joinSession = useSessionStore((state) => state.joinSession);
  const leaveSession = useSessionStore((state) => state.leaveSession);
  const startScheduledSpace = useSessionStore((state) => state.startScheduledSpace);
  const friendships = useFriendsStore((state) => state.friendships);
  const friendsLoaded = useFriendsStore((state) => state.hasLoaded);
  const refreshFriends = useFriendsStore((state) => state.refresh);
  const openCreateModal = useCreateSessionModalStore((state) => state.open);
  const invites = useSpaceInviteStore((state) => state.invites);
  const invitesLoaded = useSpaceInviteStore((state) => state.hasLoaded);
  const refreshInvites = useSpaceInviteStore((state) => state.refresh);
  const acceptInvite = useSpaceInviteStore((state) => state.acceptInvite);
  const declineInvite = useSpaceInviteStore((state) => state.declineInvite);
  const announcedInviteIds = useSpaceInviteStore((state) => state.announcedIds);
  const markInviteAnnounced = useSpaceInviteStore((state) => state.markAnnounced);
  const isFocused = useIsFocused();

  // One quote per visit to the app, not a new one on every re-render.
  const [quote] = useState(pickRandomSpaceQuote);

  useEffect(() => {
    if (sessions.length === 0) refreshSessions();
  }, [sessions.length, refreshSessions]);
  useEffect(() => {
    if (!friendsLoaded) refreshFriends();
  }, [friendsLoaded, refreshFriends]);
  useEffect(() => {
    if (!invitesLoaded) refreshInvites();
  }, [invitesLoaded, refreshInvites]);

  const friendIds = useMemo(
    () =>
      new Set(
        friendships.filter((f) => f.status === 'accepted').map((f) => getOtherUserId(f, user?._id))
      ),
    [friendships, user?._id]
  );

  const activeSessions = sessions.filter((s) => s.status === 'active');

  // Pending invites to the user, keyed by space. Only ever looked up for
  // live friend spaces, so an invite into one that already ended is
  // silently ignored rather than surfaced.
  const pendingInviteBySpace = useMemo(() => {
    const map = new Map<string, (typeof invites)[number]>();
    for (const invite of invites) {
      if (invite.status === 'pending' && invite.toUserId === user?._id) map.set(invite.spaceId, invite);
    }
    return map;
  }, [invites, user?._id]);

  // Invited spaces float to the top — someone asked for you specifically.
  const friendSpaces = activeSessions
    .filter((s) => isFriendSpace(s, friendIds))
    .sort((a, b) => Number(pendingInviteBySpace.has(b._id)) - Number(pendingInviteBySpace.has(a._id)));
  // Friends' scheduled spaces plus the user's own, soonest first.
  const scheduledSpaces = sessions
    .filter((s) => s.status === 'scheduled' && (isFriendSpace(s, friendIds) || s.hostId === user?._id))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const endedFriendSpaces = sessions
    .filter((s) => s.status === 'completed' && isFriendSpace(s, friendIds))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  // Spaces the user is hosting and still sitting in.
  const yourSpaces = activeSessions.filter(
    (s) => user !== null && s.hostId === user._id && isUserInSession(s, user._id)
  );
  // Friends-only spaces never reach this list — that's the whole point of
  // the visibility toggle. Friends' public spaces already sit up top.
  const openSpaces = activeSessions.filter(
    (s) => s.isPublic && !isFriendSpace(s, friendIds) && s.hostId !== user?._id
  );

  const categoryForId = (categoryId: string) => mockSessionCategories.find((c) => c._id === categoryId);
  const inviterFirstName = (fromUserId: string) =>
    getFriendProfile(fromUserId)?.displayName.split(' ')[0] ?? 'A friend';

  // Column count + a pixel-exact card width (rather than percentage
  // widths) so the grid stays a clean N-up layout at every breakpoint
  // without RN's flex-gap-plus-percentage rounding fighting the wrap.
  const containerWidth = Math.min(width, isDesktop ? MAX_CONTAINER_WIDTH : width) - SCREEN_PADDING * 2;
  const columns = width >= 1024 ? 3 : width >= 600 ? 2 : 1;
  const cardWidth = columns === 1 ? containerWidth : (containerWidth - GRID_GAP * (columns - 1)) / columns;

  const startOwnScheduledSpace = (sessionId: string) => {
    if (!user) return;
    startScheduledSpace(sessionId, {
      userId: user._id,
      joinedAt: new Date().toISOString(),
      leftAt: null,
      completed: false,
      targetHit: false,
      displayName: user.displayName,
      avatarInitial: user.displayName[0],
    });
    navigation.navigate('SessionRoom', { sessionId });
  };

  const joinAndOpen = (sessionId: string) => {
    joinSession(sessionId);
    const invite = pendingInviteBySpace.get(sessionId);
    if (invite) acceptInvite(invite._id);
    navigation.navigate('SessionRoom', { sessionId });
  };

  // "Kabir invited you" — greets each live invite once, the first time the
  // user lands on this tab after it arrives. Phase 4 turns the same
  // `space_invite` notification into a push.
  const nextUnannouncedInvite = friendSpaces
    .map((s) => pendingInviteBySpace.get(s._id))
    .find((invite) => invite && !announcedInviteIds.includes(invite._id));

  useEffect(() => {
    if (!isFocused || !nextUnannouncedInvite) return;
    const invite = nextUnannouncedInvite;
    const space = activeSessions.find((s) => s._id === invite.spaceId);
    if (!space) return;

    const category = categoryForId(space.categoryId);
    const { showPopup, hidePopup } = usePopupStore.getState();
    // Marked announced inside the timer, not before it — marking changes
    // this effect's deps, and the re-run's cleanup would cancel the popup.
    const timer = setTimeout(() => {
      markInviteAnnounced(invite._id);
      showPopup({
        title: `${inviterFirstName(invite.fromUserId)} invited you ✉️`,
        message: `“${space.name}” · ${category?.icon ?? ''} ${category?.name ?? ''} · ${getRemainingMinutes(space)} min left. Come focus together.`,
        actions: [
          { label: 'Not now', variant: 'secondary', onPress: hidePopup },
          {
            label: 'Join',
            onPress: () => {
              hidePopup();
              joinAndOpen(space._id);
            },
          },
        ],
      });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, nextUnannouncedInvite?._id]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenBackground />
      <Header title="Spaces" avatarInitial={user?.displayName?.[0]} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.inner, isDesktop && styles.innerDesktop]}>
          <CreatorQuote quote={quote} />

          {yourSpaces.length > 0 ? (
            <View style={styles.gridSection}>
              <Text style={styles.sectionLabel}>YOUR SPACE</Text>
              <View style={styles.grid}>
                {yourSpaces.map((session) => (
                  <View key={session._id} style={{ width: cardWidth }}>
                    <FriendSpaceCard
                      session={session}
                      category={categoryForId(session.categoryId)}
                      friendIds={friendIds}
                      currentUserId={user?._id}
                      onJoin={() => navigation.navigate('SessionRoom', { sessionId: session._id })}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.gridSection}>
            <Text style={styles.sectionLabel}>
              FRIENDS LIVE NOW{friendSpaces.length > 0 ? ` · ${friendSpaces.length}` : ''}
            </Text>
            {friendSpaces.length === 0 ? (
              <Card>
                <View style={styles.emptyState}>
                  <Mascot variant="compact" messageOverride="Quiet in here right now 👀" />
                  <Text style={styles.emptyText}>
                    None of your friends have a space open. Start one and they'll see it here.
                  </Text>
                  <Pressable onPress={() => openCreateModal()} style={styles.emptyButtonWrap}>
                    <LinearGradient colors={gradients.primary} style={styles.emptyButton}>
                      <Text style={styles.emptyButtonLabel}>Start a space</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </Card>
            ) : (
              <View style={styles.grid}>
                {friendSpaces.map((session) => {
                  const invite = pendingInviteBySpace.get(session._id);
                  return (
                    <View key={session._id} style={{ width: cardWidth }}>
                      <FriendSpaceCard
                        session={session}
                        category={categoryForId(session.categoryId)}
                        friendIds={friendIds}
                        currentUserId={user?._id}
                        onJoin={() => joinAndOpen(session._id)}
                        invitedByName={invite ? inviterFirstName(invite.fromUserId) : undefined}
                        onDismissInvite={invite ? () => declineInvite(invite._id) : undefined}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {scheduledSpaces.length > 0 ? (
            <View style={styles.gridSection}>
              <Text style={styles.sectionLabel}>COMING UP</Text>
              <View style={styles.grid}>
                {scheduledSpaces.map((session) => (
                  <View key={session._id} style={{ width: cardWidth }}>
                    <ScheduledSpaceCard
                      session={session}
                      category={categoryForId(session.categoryId)}
                      onStartNow={
                        user && session.hostId === user._id ? () => startOwnScheduledSpace(session._id) : undefined
                      }
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {openSpaces.length > 0 ? (
            <View style={styles.gridSection}>
              <Text style={styles.sectionLabel}>OPEN TO EVERYONE</Text>
              <View style={styles.grid}>
                {openSpaces.map((session) => (
                  <View key={session._id} style={{ width: cardWidth }}>
                    <LiveSessionCard
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
                          joinAndOpen(session._id);
                        }
                      }}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {endedFriendSpaces.length > 0 ? (
            <View style={styles.gridSection}>
              <Text style={styles.sectionLabel}>RECENTLY ENDED</Text>
              <View style={styles.grid}>
                {endedFriendSpaces.map((session) => (
                  <View key={session._id} style={{ width: cardWidth }}>
                    <EndedSpaceRow
                      session={session}
                      category={categoryForId(session.categoryId)}
                      onStartLikeThis={() =>
                        openCreateModal({
                          categoryId: session.categoryId,
                          name: session.name,
                          durationMin: session.durationTargetMin,
                        })
                      }
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: SCREEN_PADDING,
    gap: 16,
  },
  inner: {
    gap: 22,
  },
  innerDesktop: {
    width: '100%',
    maxWidth: MAX_CONTAINER_WIDTH,
    alignSelf: 'center',
  },
  gridSection: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyButtonWrap: {
    borderRadius: radii.button,
    marginTop: 4,
  },
  emptyButton: {
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: radii.button,
  },
  emptyButtonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
});
