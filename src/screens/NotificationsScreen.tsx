import Feather from '@expo/vector-icons/Feather';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card/Card';
import { NOTIFICATION_EMOJI } from '../components/Notifications/NotificationToast';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import type { RootStackParamList } from '../navigation/routes';
import { useFriendsStore } from '../store/useFriendsStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useSpaceAlertsStore } from '../store/useSpaceAlertsStore';
import { colors, fonts, radii } from '../theme';
import type { FriendProfile } from '../types/social';
import { getAcceptedFriendIds, getFriendProfile } from '../utils/friendHelpers';
import { openNotification } from '../utils/openNotification';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

// Inbox for everything the space lifecycle delivered (invites, friends
// going live, reminders, your own space coming due), plus the per-friend
// "space alerts" switches — the Phase 1 Notifications settings (claude.md
// §2). Reached from the bell on any header.
export function NotificationsScreen({ navigation }: Props) {
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllOpened = useNotificationStore((s) => s.markAllOpened);
  const friendships = useFriendsStore((s) => s.friendships);
  const friendAlertIds = useSpaceAlertsStore((s) => s.friendAlertIds);
  const toggleFriendAlert = useSpaceAlertsStore((s) => s.toggleFriendAlert);

  const hasUnread = notifications.some((n) => !n.openedAt);
  const friends = [...getAcceptedFriendIds(friendships)]
    .map((id) => getFriendProfile(id))
    .filter((p): p is FriendProfile => Boolean(p));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backButton} accessibilityLabel="Back">
          <Feather name="arrow-left" size={19} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.topBarTitle}>Notifications</Text>
        {hasUnread ? (
          <Pressable onPress={markAllOpened} hitSlop={8} accessibilityLabel="Mark all as read">
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          {notifications.length === 0 ? (
            <Card>
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🔔</Text>
                <Text style={styles.emptyTitle}>All quiet</Text>
                <Text style={styles.emptyText}>
                  Invites, reminders, and friends going live will show up here.
                </Text>
              </View>
            </Card>
          ) : (
            <View style={styles.list}>
              {notifications.map((n) => (
                <Pressable
                  key={n._id}
                  onPress={() => openNotification(navigation, n)}
                  style={[styles.row, !n.openedAt && styles.rowUnread]}
                  accessibilityRole="button"
                  accessibilityLabel={`${n.openedAt ? '' : 'Unread. '}${n.title}. ${n.body}`}
                >
                  <Text style={styles.rowEmoji}>{NOTIFICATION_EMOJI[n.type]}</Text>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {n.title}
                    </Text>
                    <Text style={styles.rowBody} numberOfLines={2}>
                      {n.body}
                    </Text>
                    <Text style={styles.rowTime}>{timeAgo(n.sentAt)}</Text>
                  </View>
                  {!n.openedAt ? <View style={styles.unreadDot} /> : null}
                </Pressable>
              ))}
            </View>
          )}

          {friends.length > 0 ? (
            <View style={styles.settings}>
              <Text style={styles.sectionLabel}>SPACE ALERTS</Text>
              <Text style={styles.sectionHint}>Get a heads-up when these friends start a space.</Text>
              <Card style={styles.settingsCard}>
                {friends.map((friend, i) => {
                  const on = friendAlertIds.includes(friend._id);
                  return (
                    <View key={friend._id} style={[styles.settingRow, i > 0 && styles.settingRowDivider]}>
                      <View style={styles.settingAvatar}>
                        <Text style={styles.settingInitial}>{friend.avatarInitial}</Text>
                      </View>
                      <Text style={styles.settingName} numberOfLines={1}>
                        {friend.displayName}
                      </Text>
                      <Switch
                        value={on}
                        onValueChange={() => toggleFriendAlert(friend._id)}
                        trackColor={{ false: colors.surface, true: colors.primaryDeep }}
                        thumbColor={on ? colors.primaryLight : colors.textSecondary}
                        accessibilityLabel={`Space alerts for ${friend.displayName}`}
                      />
                    </View>
                  );
                })}
              </Card>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  topBarTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  markAll: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryLight,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 4,
  },
  inner: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: 24,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyEmoji: {
    fontSize: 28,
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowUnread: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  },
  rowEmoji: {
    fontSize: 20,
    marginTop: 1,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  rowTime: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  settings: {
    gap: 6,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  sectionHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  settingsCard: {
    paddingVertical: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  settingRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  settingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInitial: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  settingName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
