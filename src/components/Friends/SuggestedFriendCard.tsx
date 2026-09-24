import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FriendProfile } from '../../types/social';
import { colors, fonts, radii, shadows } from '../../theme';

interface SuggestedFriendCardProps {
  profile: FriendProfile;
  requested: boolean;
  onAdd: () => void;
}

// Discovery capsule for the horizontal "People you may know" row — a
// lighter-weight card than FriendCard since there's no relationship yet,
// just a name, tagline, and a single clear action.
export function SuggestedFriendCard({ profile, requested, onAdd }: SuggestedFriendCardProps) {
  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarInitial}>{profile.avatarInitial}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {profile.displayName}
      </Text>
      <Text style={styles.tagline} numberOfLines={2}>
        {profile.tagline}
      </Text>

      <Pressable
        onPress={requested ? undefined : onAdd}
        disabled={requested}
        style={[styles.addButton, requested && styles.addButtonRequested]}
      >
        {requested ? (
          <>
            <Feather name="check" size={13} color={colors.textSecondary} />
            <Text style={styles.addLabelRequested}>Requested</Text>
          </>
        ) : (
          <>
            <Feather name="user-plus" size={13} color={colors.textPrimary} />
            <Text style={styles.addLabel}>Add</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const CARD_WIDTH = 148;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: radii.cardSmall,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarInitial: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  name: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13.5,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.bodyRegular,
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    minHeight: 28,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
  },
  addButtonRequested: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textPrimary,
  },
  addLabelRequested: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
