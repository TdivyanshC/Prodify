import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import type { NotificationSender } from '../../types/social';
import { getFriendProfile } from '../../utils/friendHelpers';

const SPARK = require('../../assets/mascot/spark.png');

interface NotificationAvatarProps {
  sender: NotificationSender;
  size?: number;
}

// Who a notification is from: Spark's face for companion-voiced messages,
// the friend's avatar for social ones, an emoji badge for everything else.
export function NotificationAvatar({ sender, size = 40 }: NotificationAvatarProps) {
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (sender.kind === 'spark') {
    return (
      <View style={[styles.base, styles.spark, circle]}>
        <Image source={SPARK} style={{ width: size * 0.9, height: size * 0.9 }} resizeMode="contain" />
      </View>
    );
  }
  if (sender.kind === 'friend') {
    const profile = getFriendProfile(sender.userId);
    return (
      <View style={[styles.base, styles.friend, circle]}>
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{profile?.avatarInitial ?? '·'}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.base, styles.system, circle]}>
      <Text style={{ fontSize: size * 0.48 }}>{sender.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spark: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  friend: {
    backgroundColor: colors.primaryDeep,
  },
  system: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  initial: {
    fontFamily: fonts.headingSemiBold,
    color: colors.textPrimary,
  },
});
