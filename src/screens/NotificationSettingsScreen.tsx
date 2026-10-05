import Feather from '@expo/vector-icons/Feather';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card/Card';
import { ScreenBackground } from '../components/ScreenBackground/ScreenBackground';
import type { RootStackParamList } from '../navigation/routes';
import { useFriendsStore } from '../store/useFriendsStore';
import { useNotificationSettingsStore } from '../store/useNotificationSettingsStore';
import { useSpaceAlertsStore } from '../store/useSpaceAlertsStore';
import { colors, fonts, radii } from '../theme';
import type { FriendProfile, NotificationCategory } from '../types/social';
import { getAcceptedFriendIds, getFriendProfile } from '../utils/friendHelpers';
import { PREVIEW_TYPES, sendPreview } from '../utils/notifications/preview';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;

const CATEGORY_ROWS: { key: NotificationCategory; emoji: string; title: string; hint: string }[] = [
  { key: 'spaces', emoji: '🟢', title: 'Spaces & invites', hint: 'Invites, reminders, friends going live' },
  { key: 'friends', emoji: '🤝', title: 'Friends', hint: 'Requests, cheers, milestones, together streaks' },
  { key: 'progress', emoji: '🔥', title: 'Progress & rewards', hint: 'Streak check-ins, goals, badges, weekly recap' },
  { key: 'nudges', emoji: '✨', title: 'Playful nudges', hint: 'Spark’s cheeky “come focus” reminders' },
];
const QUIET_STARTS = [21, 22, 23, 0];
const QUIET_ENDS = [6, 7, 8, 9];
const CAP_OPTIONS = [3, 6, 10, 0];

const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });

// Notification preferences (claude.md §2 "Notifications settings"): which
// kinds to get, quiet hours, a daily limit on interruptions, and per-friend
// space alerts. Reached from the gear on the Notifications screen.
export function NotificationSettingsScreen({ navigation }: Props) {
  const categories = useNotificationSettingsStore((s) => s.categories);
  const toggleCategory = useNotificationSettingsStore((s) => s.toggleCategory);
  const quietHours = useNotificationSettingsStore((s) => s.quietHours);
  const setQuietHours = useNotificationSettingsStore((s) => s.setQuietHours);
  const dailyToastCap = useNotificationSettingsStore((s) => s.dailyToastCap);
  const setDailyToastCap = useNotificationSettingsStore((s) => s.setDailyToastCap);
  const friendships = useFriendsStore((s) => s.friendships);
  const friendAlertIds = useSpaceAlertsStore((s) => s.friendAlertIds);
  const toggleFriendAlert = useSpaceAlertsStore((s) => s.toggleFriendAlert);

  const friends = [...getAcceptedFriendIds(friendships)]
    .map((id) => getFriendProfile(id))
    .filter((p): p is FriendProfile => Boolean(p));

  const switchProps = (on: boolean) => ({
    trackColor: { false: colors.surface, true: colors.primaryDeep },
    thumbColor: on ? colors.primaryLight : colors.textSecondary,
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.iconButton} accessibilityLabel="Back">
          <Feather name="arrow-left" size={19} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.topBarTitle}>Notification settings</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHAT TO SEND</Text>
            <Card style={styles.listCard}>
              {CATEGORY_ROWS.map((row, i) => (
                <View key={row.key} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <Text style={styles.rowEmoji}>{row.emoji}</Text>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{row.title}</Text>
                    <Text style={styles.rowHint}>{row.hint}</Text>
                  </View>
                  <Switch
                    value={categories[row.key]}
                    onValueChange={() => toggleCategory(row.key)}
                    accessibilityLabel={row.title}
                    {...switchProps(categories[row.key])}
                  />
                </View>
              ))}
            </Card>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>QUIET HOURS</Text>
            <Card style={styles.listCard}>
              <View style={styles.row}>
                <Text style={styles.rowEmoji}>🌙</Text>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Quiet hours</Text>
                  <Text style={styles.rowHint}>
                    No pop-ups {hourLabel(quietHours.startHour)}–{hourLabel(quietHours.endHour)}. Rewards, invites, and
                    reminders you set still come through.
                  </Text>
                </View>
                <Switch
                  value={quietHours.enabled}
                  onValueChange={(enabled) => setQuietHours({ enabled })}
                  accessibilityLabel="Quiet hours"
                  {...switchProps(quietHours.enabled)}
                />
              </View>
              {quietHours.enabled ? (
                <View style={[styles.rowDivider, styles.chipBlock]}>
                  <ChipRow
                    label="From"
                    options={QUIET_STARTS}
                    value={quietHours.startHour}
                    format={hourLabel}
                    onSelect={(startHour) => setQuietHours({ startHour })}
                  />
                  <ChipRow
                    label="Until"
                    options={QUIET_ENDS}
                    value={quietHours.endHour}
                    format={hourLabel}
                    onSelect={(endHour) => setQuietHours({ endHour })}
                  />
                </View>
              ) : null}
            </Card>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DAILY LIMIT</Text>
            <Text style={styles.sectionHint}>
              Max pop-ups a day. Past the limit, notifications still wait in your inbox.
            </Text>
            <ChipRow
              options={CAP_OPTIONS}
              value={dailyToastCap}
              format={(n) => (n === 0 ? 'No limit' : `${n} a day`)}
              onSelect={setDailyToastCap}
            />
          </View>

          {friends.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SPACE ALERTS</Text>
              <Text style={styles.sectionHint}>Get a heads-up when these friends start a space.</Text>
              <Card style={styles.listCard}>
                {friends.map((friend, i) => {
                  const on = friendAlertIds.includes(friend._id);
                  return (
                    <View key={friend._id} style={[styles.row, i > 0 && styles.rowDivider]}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarInitial}>{friend.avatarInitial}</Text>
                      </View>
                      <Text style={[styles.rowTitle, styles.rowText]} numberOfLines={1}>
                        {friend.displayName}
                      </Text>
                      <Switch
                        value={on}
                        onValueChange={() => toggleFriendAlert(friend._id)}
                        accessibilityLabel={`Space alerts for ${friend.displayName}`}
                        {...switchProps(on)}
                      />
                    </View>
                  );
                })}
              </Card>
            </View>
          ) : null}

          {__DEV__ ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PREVIEW (DEV ONLY)</Text>
              <Text style={styles.sectionHint}>
                Send any notification now, with real fixture data. Skips quiet hours, limits, and focus mode.
              </Text>
              <View style={styles.previewGrid}>
                {PREVIEW_TYPES.map(({ type, label }) => (
                  <Pressable key={type} onPress={() => sendPreview(type)} style={styles.previewChip}>
                    <Text style={styles.previewLabel}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChipRow({
  label,
  options,
  value,
  format,
  onSelect,
}: {
  label?: string;
  options: number[];
  value: number;
  format: (n: number) => string;
  onSelect: (n: number) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {label ? <Text style={styles.chipRowLabel}>{label}</Text> : null}
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{format(option)}</Text>
          </Pressable>
        );
      })}
    </View>
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
    gap: 24,
  },
  section: {
    gap: 8,
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
    lineHeight: 17,
    color: colors.textSecondary,
  },
  listCard: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowEmoji: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  chipBlock: {
    gap: 10,
    paddingVertical: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  chipRowLabel: {
    width: 44,
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: colors.textPrimary,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.button,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  previewLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
});
