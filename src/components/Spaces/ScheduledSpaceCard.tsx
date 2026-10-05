import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSpaceAlertsStore } from '../../store/useSpaceAlertsStore';
import type { Session, SessionCategory } from '../../types/models';
import { colors, fonts, gradients, radii } from '../../theme';
import { getCategoryColor } from '../../theme/categoryColors';
import { getFriendProfile } from '../../utils/friendHelpers';
import { REMINDER_LEAD_MIN } from '../../utils/notifications/triggers/spaces';
import { Card } from '../Card/Card';

interface ScheduledSpaceCardProps {
  session: Session;
  category: SessionCategory | undefined;
  // Set when the user is the host — swaps "Remind me" for "Start now".
  onStartNow?: () => void;
}

function formatStartsIn(startTime: string): string {
  const minutes = Math.round((new Date(startTime).getTime() - Date.now()) / 60000);
  // Friends' spaces go live on their own at start time, so only the
  // user's own (which waits for "Start now") ever sits here past due.
  if (minutes <= 0) return 'ready now';
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

// A space that hasn't started yet: who, what, when, and one action — ask
// to be reminded (a friend's) or start it early (your own). Deliberately
// smaller than a live card; the live ones are what you can act on now.
export function ScheduledSpaceCard({ session, category, onStartNow }: ScheduledSpaceCardProps) {
  const isOwn = Boolean(onStartNow);
  const host = session.hostId ? getFriendProfile(session.hostId) : undefined;
  const hostFirstName = host?.displayName.split(' ')[0] ?? 'A friend';
  const invitedCount = session.invitedUserIds?.length ?? 0;
  const accentColor = getCategoryColor(category?._id, colors.primary);
  const reminderOn = useSpaceAlertsStore((s) => s.reminderSpaceIds.includes(session._id));
  const toggleReminder = useSpaceAlertsStore((s) => s.toggleReminder);

  const startLabel = new Date(session.startTime).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Card style={styles.card}>
      <View style={[styles.accentStripe, { backgroundColor: accentColor }]} />
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{isOwn ? '✦' : host?.avatarInitial ?? '·'}</Text>
        </View>
        <View style={styles.text}>
          <Text style={styles.headline} numberOfLines={2}>
            <Text style={styles.hostName}>{isOwn ? "You're" : `${hostFirstName} is`}</Text> starting{' '}
            <Text style={styles.spaceName}>{session.name}</Text>
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {category?.icon} {category?.name} · {session.durationTargetMin} min ·{' '}
            {session.isPublic ? '🌍 Public' : '🔒 Friends only'}
            {isOwn && invitedCount > 0 ? ` · ${invitedCount} invited` : ''}
          </Text>
        </View>
        <View style={styles.timeColumn}>
          <Text style={styles.time}>{startLabel}</Text>
          <Text style={styles.startsIn}>{formatStartsIn(session.startTime)}</Text>
        </View>
      </View>

      {onStartNow ? (
        <Pressable onPress={onStartNow} style={styles.startWrap} accessibilityRole="button">
          <LinearGradient colors={gradients.primary} style={styles.startButton}>
            <Text style={styles.startLabel}>Start now</Text>
          </LinearGradient>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => toggleReminder(session._id)}
          style={[styles.remindButton, reminderOn && styles.remindButtonOn]}
          accessibilityRole="switch"
          accessibilityState={{ checked: reminderOn }}
        >
          <Text style={[styles.remindLabel, reminderOn && styles.remindLabelOn]}>
            {reminderOn ? `🔔 Reminder set ✓ · ${REMINDER_LEAD_MIN} min before` : '🔔 Remind me'}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    overflow: 'hidden',
  },
  accentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  headline: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  hostName: {
    fontFamily: fonts.bodySemiBold,
    color: colors.textPrimary,
  },
  spaceName: {
    fontFamily: fonts.headingSemiBold,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  timeColumn: {
    alignItems: 'flex-end',
    gap: 1,
  },
  time: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  startsIn: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: colors.primaryLight,
  },
  startWrap: {
    borderRadius: radii.button,
  },
  startButton: {
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: radii.button,
  },
  startLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  remindButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  remindButtonOn: {
    borderColor: colors.success,
  },
  remindLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  remindLabelOn: {
    color: colors.success,
  },
});
