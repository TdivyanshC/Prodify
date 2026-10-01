import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FriendProfile } from '../../types/social';
import { colors, fonts, radii } from '../../theme';

interface FriendsLiveNudgeProps {
  friends: FriendProfile[];
  onPress: () => void;
}

// Home's one-line "your friends are focusing right now" strip — the
// tappable follow-through for Spark's friends_live message (the overlay
// itself has no buttons). Only rendered when at least one friend is live.
export function FriendsLiveNudge({ friends, onPress }: FriendsLiveNudgeProps) {
  const firstNames = friends.map((f) => f.displayName.split(' ')[0]);
  const title =
    friends.length === 1 ? `${firstNames[0]} is focusing right now` : `${friends.length} friends are focusing right now`;
  const subtitle = friends.length === 1 ? 'Tap to join them in Spaces' : firstNames.join(', ');

  return (
    <Pressable onPress={onPress} style={styles.strip} accessibilityRole="button" accessibilityLabel={`${title}. Open Spaces`}>
      <View style={styles.avatarStack}>
        {friends.slice(0, 3).map((f, i) => (
          <View key={f._id} style={[styles.avatar, i > 0 && styles.avatarOverlap]}>
            <Text style={styles.avatarInitial}>{f.avatarInitial}</Text>
          </View>
        ))}
        <View style={styles.liveDot} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.primaryLight} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.card,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryDeep,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlap: {
    marginLeft: -9,
  },
  avatarInitial: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textPrimary,
  },
  liveDot: {
    position: 'absolute',
    right: -2,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
