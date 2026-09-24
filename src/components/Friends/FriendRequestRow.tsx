import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../Card/Card';
import type { FriendProfile } from '../../types/social';
import { colors, fonts, gradients, radii } from '../../theme';

interface FriendRequestRowProps {
  profile: FriendProfile;
  onAccept: () => void;
  onDecline: () => void;
}

// Incoming friend request — inline accept/decline rather than a popup
// interrupt, since these sit in a list the user is already browsing.
// Declining is quiet (no "rejected" messaging) per the never-shaming
// principle in claude.md §4 — it just removes the row.
export function FriendRequestRow({ profile, onAccept, onDecline }: FriendRequestRowProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarInitial}>{profile.avatarInitial}</Text>
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.name} numberOfLines={1}>
          {profile.displayName}
        </Text>
        <Text style={styles.tagline} numberOfLines={1}>
          {profile.tagline}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onDecline} accessibilityLabel="Decline" style={styles.declineButton}>
          <Feather name="x" size={16} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={onAccept} accessibilityLabel="Accept">
          <LinearGradient colors={gradients.primary} style={styles.acceptButton}>
            <Feather name="check" size={16} color={colors.textPrimary} />
          </LinearGradient>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  tagline: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  declineButton: {
    width: 34,
    height: 34,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  acceptButton: {
    width: 34,
    height: 34,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
