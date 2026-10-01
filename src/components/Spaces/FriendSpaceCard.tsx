import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSpaceAlertsStore } from '../../store/useSpaceAlertsStore';
import { useTogetherStreakStore } from '../../store/useTogetherStreakStore';
import { getLiveTogetherStreak } from '../../utils/togetherStreak';
import { Card } from '../Card/Card';
import type { Session, SessionCategory } from '../../types/models';
import { colors, fonts, gradients, radii } from '../../theme';
import { getCategoryColor } from '../../theme/categoryColors';
import { SpaceReactionRow } from './SpaceReactionRow';
import { SpaceTimer } from './SpaceTimer';

interface FriendSpaceCardProps {
  session: Session;
  category: SessionCategory | undefined;
  // Accepted friends' user ids — decides who gets named on the card vs.
  // folded into the "+N others" count.
  friendIds: Set<string>;
  currentUserId: string | undefined;
  // Join (if not already in) and open the room — the screen owns both.
  onJoin: () => void;
  // Set when the host (or another friend) invited the user in — renders
  // the invite banner with its own dismiss.
  invitedByName?: string;
  onDismissInvite?: () => void;
}

const firstName = (displayName: string) => displayName.split(' ')[0];

// A space started by a friend. Reads top-down in the order the user
// decides to join: who started it -> what it is -> how far in it is ->
// which friends are already there -> join.
export function FriendSpaceCard({
  session,
  category,
  friendIds,
  currentUserId,
  onJoin,
  invitedByName,
  onDismissInvite,
}: FriendSpaceCardProps) {
  const accentColor = getCategoryColor(category?._id, colors.primary);
  const self = session.participants.find((p) => p.userId === currentUserId && !p.leftAt);
  const joined = Boolean(self);
  // The same card doubles as "Your space" when the user is the host.
  const isOwnSpace = Boolean(currentUserId && session.hostId === currentUserId);

  const host = session.participants.find((p) => p.userId === session.hostId);
  const hostFirstName = host ? firstName(host.displayName) : 'your friend';
  const alertOn = useSpaceAlertsStore((s) => (session.hostId ? s.friendAlertIds.includes(session.hostId) : false));
  const toggleFriendAlert = useSpaceAlertsStore((s) => s.toggleFriendAlert);
  const togetherDays = useTogetherStreakStore((s) =>
    session.hostId && !isOwnSpace ? getLiveTogetherStreak(s.streaks[session.hostId]) : 0
  );

  const friendsHere = session.participants.filter(
    (p) => !p.leftAt && p.userId !== session.hostId && friendIds.has(p.userId)
  );
  // The user gets a "You" chip only as a guest — as host they're already
  // the host row.
  const showSelfChip = joined && !isOwnSpace;
  // Everyone present who isn't the host, a named friend, or the user.
  const othersCount = Math.max(0, session.participantCount - 1 - friendsHere.length - (showSelfChip ? 1 : 0));
  const showAttendeeRow = friendsHere.length > 0 || showSelfChip;
  const invitedCount = session.invitedUserIds?.length ?? 0;
  const emptyAttendeeCopy = isOwnSpace
    ? invitedCount > 0
      ? `Invites sent to ${invitedCount} ${invitedCount === 1 ? 'friend' : 'friends'} — they'll show up here when they join.`
      : 'Just you so far.'
    : othersCount > 0
      ? `None of your other friends yet · ${othersCount} ${othersCount === 1 ? 'other' : 'others'} here`
      : `Just ${hostFirstName} so far — be the first to join.`;

  return (
    <Card style={styles.card}>
      <View style={[styles.accentStripe, { backgroundColor: accentColor }]} />

      {invitedByName && !joined ? (
        <View style={styles.inviteBanner}>
          <Text style={styles.inviteText} numberOfLines={1}>
            ✉️ <Text style={styles.inviteName}>{invitedByName}</Text> invited you
          </Text>
          {onDismissInvite ? (
            <Pressable onPress={onDismissInvite} hitSlop={8} accessibilityLabel="Dismiss invite">
              <Text style={styles.inviteDismiss}>Not now</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.badgeRow}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>LIVE</Text>
          </View>
          <View style={styles.visibilityBadge}>
            <Text style={styles.visibilityLabel}>{session.isPublic ? '🌍 Public' : '🔒 Friends only'}</Text>
          </View>
        </View>
        <View style={[styles.themeChip, { backgroundColor: accentColor + '20' }]}>
          <Text style={styles.themeLabel}>
            {category?.icon} {category?.name}
          </Text>
        </View>
      </View>

      <View style={styles.hostRow}>
        <View style={styles.hostAvatar}>
          <Text style={styles.hostAvatarInitial}>{host?.avatarInitial ?? '·'}</Text>
        </View>
        <View style={styles.hostText}>
          <View style={styles.hostNameRow}>
            <Text style={styles.hostName} numberOfLines={1}>
              {isOwnSpace ? 'You' : host?.displayName ?? 'A friend'}
            </Text>
            <View style={styles.hostPill}>
              <Text style={styles.hostPillLabel}>HOST</Text>
            </View>
          </View>
          <Text style={styles.hostCaption}>
            started this space
            {togetherDays > 0 ? (
              <Text style={styles.togetherStreak}>  🔥 {togetherDays}-day together streak</Text>
            ) : null}
          </Text>
        </View>
        {!isOwnSpace && session.hostId ? (
          <Pressable
            onPress={() => session.hostId && toggleFriendAlert(session.hostId)}
            hitSlop={8}
            style={[styles.bellButton, alertOn && styles.bellButtonOn]}
            accessibilityRole="switch"
            accessibilityState={{ checked: alertOn }}
            accessibilityLabel={`Notify me when ${hostFirstName} starts a space`}
          >
            <Feather
              name={alertOn ? 'bell' : 'bell-off'}
              size={15}
              color={alertOn ? colors.primaryLight : colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.name}>{session.name}</Text>
        {session.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {session.description}
          </Text>
        ) : null}
      </View>

      <SpaceTimer session={session} />

      <View style={styles.attendees}>
        <Text style={styles.attendeesLabel}>
          FRIENDS HERE{friendsHere.length > 0 ? ` · ${friendsHere.length}` : ''}
        </Text>
        {showAttendeeRow ? (
          <View style={styles.attendeeRow}>
            {self && showSelfChip ? <AttendeeChip initial={self.avatarInitial} label="You" isSelf /> : null}
            {friendsHere.map((p) => (
              <AttendeeChip key={p.userId} initial={p.avatarInitial} label={firstName(p.displayName)} />
            ))}
            {othersCount > 0 ? (
              <Text style={styles.othersLabel}>
                +{othersCount} {othersCount === 1 ? 'other' : 'others'}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.attendeesEmpty}>{emptyAttendeeCopy}</Text>
        )}
      </View>

      {!isOwnSpace && session.hostId ? (
        <SpaceReactionRow sessionId={session._id} toUserId={session.hostId} toFirstName={hostFirstName} />
      ) : null}

      <Pressable onPress={onJoin} accessibilityRole="button" style={styles.joinWrap}>
        {joined ? (
          <View style={[styles.joinButton, styles.joinButtonJoined]}>
            <Text style={[styles.joinLabel, styles.joinLabelJoined]}>
              {isOwnSpace ? 'Back to your space' : "You're in ✓ · Open space"}
            </Text>
          </View>
        ) : (
          <LinearGradient colors={gradients.primary} style={styles.joinButton}>
            <LinearGradient colors={[colors.sheen, 'transparent']} style={styles.joinSheen} pointerEvents="none" />
            <Text style={styles.joinLabel}>Join {hostFirstName}</Text>
          </LinearGradient>
        )}
      </Pressable>
    </Card>
  );
}

function AttendeeChip({ initial, label, isSelf }: { initial: string; label: string; isSelf?: boolean }) {
  return (
    <View style={[styles.attendeeChip, isSelf && styles.attendeeChipSelf]}>
      <View style={styles.attendeeAvatar}>
        <Text style={styles.attendeeInitial}>{initial}</Text>
      </View>
      <Text style={styles.attendeeName} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    overflow: 'hidden',
  },
  accentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.button,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inviteText: {
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textPrimary,
  },
  inviteName: {
    fontFamily: fonts.bodySemiBold,
    color: colors.primaryLight,
  },
  inviteDismiss: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  visibilityBadge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  visibilityLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    color: colors.textSecondary,
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
  themeChip: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  themeLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hostAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDeep,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarInitial: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  hostText: {
    flex: 1,
    gap: 1,
  },
  hostNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostName: {
    flexShrink: 1,
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  hostPill: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: colors.primarySoft,
  },
  hostPillLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: colors.primaryLight,
  },
  bellButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bellButtonOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
  },
  hostCaption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  // Gold is allowed here — it's a streak (claude.md §3a discipline rule).
  togetherStreak: {
    fontFamily: fonts.bodySemiBold,
    color: colors.accentGold,
  },
  titleBlock: {
    gap: 3,
  },
  name: {
    fontFamily: fonts.headingBold,
    fontSize: 19,
    color: colors.textPrimary,
  },
  description: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  attendees: {
    gap: 8,
  },
  attendeesLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  attendeeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  attendeeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attendeeChipSelf: {
    borderColor: colors.success,
  },
  attendeeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeInitial: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.textPrimary,
  },
  attendeeName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textPrimary,
  },
  othersLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  attendeesEmpty: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  joinWrap: {
    borderRadius: radii.button,
  },
  joinButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radii.button,
    overflow: 'hidden',
  },
  joinSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 16,
  },
  joinButtonJoined: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.success,
  },
  joinLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  joinLabelJoined: {
    color: colors.success,
  },
});
