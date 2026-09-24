import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

interface HeaderProps {
  title: string;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  avatarInitial?: string;
  hasNotification?: boolean;
}

// Shared top bar (architecture §2 §3): page title on the left, notification
// bell + avatar on the right. Deliberately minimal — no extra controls.
export function Header({
  title,
  onNotificationPress,
  onProfilePress,
  avatarInitial,
  hasNotification,
}: HeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onNotificationPress}
          hitSlop={8}
          style={styles.iconButton}
          accessibilityLabel="Notifications"
        >
          <Feather name="bell" size={19} color={colors.textSecondary} />
          {hasNotification ? <View style={styles.badgeDot} /> : null}
        </Pressable>
        <Pressable
          onPress={onProfilePress}
          hitSlop={8}
          style={styles.avatar}
          accessibilityLabel="Profile"
        >
          <Text style={styles.avatarText}>{avatarInitial ?? '·'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accentGold,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDeep,
  },
  avatarText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
