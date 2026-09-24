import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/AppShell/Header';
import { Card } from '../components/Card/Card';
import { EmptyFriendsState } from '../components/Friends/EmptyFriendsState';
import { FriendCard } from '../components/Friends/FriendCard';
import { FriendRequestRow } from '../components/Friends/FriendRequestRow';
import { SuggestedFriendCard } from '../components/Friends/SuggestedFriendCard';
import { mockFriendProfiles } from '../mocks/friends.mock';
import { DESKTOP_BREAKPOINT, type RootStackParamList } from '../navigation/routes';
import { useFriendsStore } from '../store/useFriendsStore';
import { usePopupStore } from '../store/usePopupStore';
import { useUserStore } from '../store/useUserStore';
import { colors, fonts } from '../theme';
import { getFriendProfile, getOtherUserId } from '../utils/friendHelpers';

// Friends — architecture §1/§4: a lightweight, accountability-focused
// social layer (reactions only, no in-app chat). Three sections: incoming
// requests to act on, the friends you already have, and people you may
// know to grow the list — each backed by useFriendsStore so accept/
// decline/add actually mutate shared state instead of faking it.
export function FriendsScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const user = useUserStore((state) => state.user);
  const friendships = useFriendsStore((state) => state.friendships);
  const refresh = useFriendsStore((state) => state.refresh);
  const acceptRequest = useFriendsStore((state) => state.acceptRequest);
  const declineRequest = useFriendsStore((state) => state.declineRequest);
  const sendRequest = useFriendsStore((state) => state.sendRequest);
  const showPopup = usePopupStore((state) => state.showPopup);
  const hidePopup = usePopupStore((state) => state.hidePopup);

  useEffect(() => {
    if (friendships.length === 0) refresh();
  }, [friendships.length, refresh]);

  const incomingRequests = useMemo(
    () => friendships.filter((f) => f.status === 'pending' && f.requestedBy !== user?._id),
    [friendships, user?._id]
  );
  const acceptedFriendships = useMemo(
    () => friendships.filter((f) => f.status === 'accepted'),
    [friendships]
  );
  const outgoingRequestedIds = useMemo(
    () =>
      new Set(
        friendships
          .filter((f) => f.status === 'pending' && f.requestedBy === user?._id)
          .map((f) => getOtherUserId(f, user?._id))
      ),
    [friendships, user?._id]
  );
  const suggested = useMemo(() => {
    const excluded = new Set([
      ...acceptedFriendships.map((f) => getOtherUserId(f, user?._id)),
      ...incomingRequests.map((f) => getOtherUserId(f, user?._id)),
    ]);
    return mockFriendProfiles.filter((p) => !excluded.has(p._id));
  }, [acceptedFriendships, incomingRequests, user?._id]);

  const handleAccept = (friendshipId: string, name: string) => {
    acceptRequest(friendshipId);
    showPopup({
      title: 'New friend! 🎉',
      message: `You and ${name} are now accountability buddies.`,
      actions: [{ label: 'Nice!', onPress: hidePopup }],
    });
  };

  const handleAdd = (userId: string, name: string) => {
    sendRequest(userId);
    showPopup({ message: `Friend request sent to ${name} 🤝`, actions: [{ label: 'OK', onPress: hidePopup }] });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header title="Friends" avatarInitial={user?.displayName?.[0]} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.inner, isDesktop && styles.innerDesktop]}>
          {incomingRequests.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.eyebrow}>FRIEND REQUESTS · {incomingRequests.length}</Text>
              <View style={styles.requestList}>
                {incomingRequests.map((f) => {
                  const profile = getFriendProfile(getOtherUserId(f, user?._id));
                  if (!profile) return null;
                  return (
                    <FriendRequestRow
                      key={f._id}
                      profile={profile}
                      onAccept={() => handleAccept(f._id, profile.displayName)}
                      onDecline={() => declineRequest(f._id)}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.eyebrow}>YOUR FRIENDS · {acceptedFriendships.length}</Text>
            {acceptedFriendships.length === 0 ? (
              <Card>
                <EmptyFriendsState />
              </Card>
            ) : (
              <View style={styles.friendGrid}>
                {acceptedFriendships.map((f) => {
                  const profile = getFriendProfile(getOtherUserId(f, user?._id));
                  if (!profile) return null;
                  return (
                    <FriendCard
                      key={f._id}
                      profile={profile}
                      onPress={() =>
                        navigation.navigate('FriendProfile', { friendshipId: f._id, userId: profile._id })
                      }
                    />
                  );
                })}
              </View>
            )}
          </View>

          {suggested.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.eyebrow}>PEOPLE YOU MAY KNOW</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedRow}>
                {suggested.map((profile) => (
                  <SuggestedFriendCard
                    key={profile._id}
                    profile={profile}
                    requested={outgoingRequestedIds.has(profile._id)}
                    onAdd={() => handleAdd(profile._id, profile.displayName)}
                  />
                ))}
              </ScrollView>
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
    padding: 20,
    gap: 20,
  },
  inner: {
    gap: 24,
  },
  innerDesktop: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  section: {
    gap: 12,
  },
  eyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  requestList: {
    gap: 10,
  },
  friendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  suggestedRow: {
    gap: 12,
    paddingRight: 4,
  },
});
