import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Session, SessionCategory } from '../../types/models';
import { colors, fonts, radii, shadows } from '../../theme';
import { getCategoryColor } from '../../theme/categoryColors';
import { getFriendProfile } from '../../utils/friendHelpers';

interface EndedSpaceRowProps {
  session: Session;
  category: SessionCategory | undefined;
  onStartLikeThis: () => void;
}

function formatEndedAgo(session: Session): string {
  const endMs = new Date(session.startTime).getTime() + session.durationTargetMin * 60000;
  const minutes = Math.max(0, Math.round((Date.now() - endMs) / 60000));
  if (minutes < 60) return `ended ${minutes} min ago`;
  return `ended ${Math.floor(minutes / 60)}h ago`;
}

// A friend's space that already wrapped up. Nothing to join, so the one
// action is borrowing it: same theme, name, and length, as your own space.
export function EndedSpaceRow({ session, category, onStartLikeThis }: EndedSpaceRowProps) {
  const host = session.hostId ? getFriendProfile(session.hostId) : undefined;
  const hostFirstName = host?.displayName.split(' ')[0] ?? 'A friend';
  const accentColor = getCategoryColor(category?._id, colors.primary);

  return (
    <View style={[styles.row, shadows.card]}>
      <View style={[styles.iconCircle, { backgroundColor: accentColor + '22', borderColor: accentColor + '55' }]}>
        <Text style={styles.iconEmoji}>{category?.icon ?? '✨'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {session.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {hostFirstName} · {session.durationTargetMin} min · {session.participantCount} people · {formatEndedAgo(session)}
        </Text>
      </View>
      <Pressable onPress={onStartLikeThis} style={styles.button} accessibilityLabel={`Start a space like ${session.name}`}>
        <Text style={styles.buttonLabel}>Start one{'\n'}like this</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 18,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  button: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  buttonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    lineHeight: 14,
    color: colors.primaryLight,
    textAlign: 'center',
  },
});
