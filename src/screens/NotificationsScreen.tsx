import Feather from '@expo/vector-icons/Feather';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card/Card';
import { NotificationRow } from '../components/Notifications/NotificationRow';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import type { RootStackParamList } from '../navigation/routes';
import { useNotificationStore } from '../store/useNotificationStore';
import { colors, fonts, radii } from '../theme';
import type { AppNotification, NotificationCategory } from '../types/social';
import { openNotification, runNotificationAction } from '../utils/notifications/actions';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

type Filter = 'all' | 'spaces' | 'friends' | 'progress';

// Playful nudges are about getting into a space, so they file under Spaces.
const FILTERS: { key: Filter; label: string; categories: NotificationCategory[] }[] = [
  { key: 'all', label: 'All', categories: ['spaces', 'friends', 'progress', 'nudges'] },
  { key: 'spaces', label: 'Spaces', categories: ['spaces', 'nudges'] },
  { key: 'friends', label: 'Friends', categories: ['friends'] },
  { key: 'progress', label: 'Progress', categories: ['progress'] },
];

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

// The inbox: everything delivered, newest first, filterable by kind and
// split into Today / Earlier. Rows carry their own buttons (Join, Accept,
// Send 🔥…) and swipe left to dismiss. Settings live one tap away (gear).
export function NotificationsScreen({ navigation }: Props) {
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllOpened = useNotificationStore((s) => s.markAllOpened);
  const remove = useNotificationStore((s) => s.remove);
  const [filter, setFilter] = useState<Filter>('all');

  const categories = FILTERS.find((f) => f.key === filter)!.categories;
  const visible = notifications.filter((n) => categories.includes(n.category));
  const today = visible.filter((n) => isToday(n.sentAt));
  const earlier = visible.filter((n) => !isToday(n.sentAt));
  const hasUnread = notifications.some((n) => !n.openedAt);
  const unreadIn = (f: Filter) =>
    notifications.filter((n) => !n.openedAt && FILTERS.find((x) => x.key === f)!.categories.includes(n.category)).length;

  const renderSection = (label: string, items: AppNotification[]) =>
    items.length === 0 ? null : (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {items.map((n) => (
          <NotificationRow
            key={n._id}
            notification={n}
            onPress={() => openNotification(navigation, n)}
            onAction={(action) => runNotificationAction(navigation, n, action)}
            onDismiss={() => remove(n._id)}
          />
        ))}
      </View>
    );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.iconButton} accessibilityLabel="Back">
          <Feather name="arrow-left" size={19} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.topBarTitle}>Notifications</Text>
        <Pressable
          onPress={() => navigation.navigate('NotificationSettings')}
          hitSlop={8}
          style={styles.iconButton}
          accessibilityLabel="Notification settings"
        >
          <Feather name="settings" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <View style={styles.filterRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filters}
            >
              {FILTERS.map((f) => {
                const active = f.key === filter;
                const unread = unreadIn(f.key);
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                      {f.label}
                      {unread > 0 ? ` · ${unread}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {hasUnread ? (
              <Pressable onPress={markAllOpened} hitSlop={8} accessibilityLabel="Mark all as read">
                <Text style={styles.markAll}>Mark all read</Text>
              </Pressable>
            ) : null}
          </View>

          {visible.length === 0 ? (
            <Card>
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🔔</Text>
                <Text style={styles.emptyTitle}>All quiet</Text>
                <Text style={styles.emptyText}>
                  {filter === 'all'
                    ? 'Invites, reminders, cheers, and rewards will show up here.'
                    : 'Nothing here yet. Check back after your next session.'}
                </Text>
              </View>
            </Card>
          ) : (
            <>
              {renderSection('TODAY', today)}
              {renderSection('EARLIER', earlier)}
              <Text style={styles.hint}>Swipe a notification left to dismiss it.</Text>
            </>
          )}
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
  iconButton: {
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
  scrollContent: {
    padding: 20,
    paddingTop: 4,
  },
  inner: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: 18,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterScroll: {
    flexShrink: 1,
  },
  filters: {
    gap: 8,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  filterLabelActive: {
    color: colors.textPrimary,
  },
  markAll: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryLight,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.textSecondary,
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
  hint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
