import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

interface HomeHeaderProps {
  name: string;
  avatarInitial?: string;
  hasNotification?: boolean;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
}

function getGreetingWord(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Home's own top section — replaces the generic AppShell Header + a
// separate Greeting block. Wireframe: the very first thing a user reads is
// "who I am talking to" (greeting) and "is anything waiting for me"
// (notification), not a repeated app wordmark. Kept to two lines total so
// Home stays direct, not a dashboard banner.
export function HomeHeader({
  name,
  avatarInitial,
  hasNotification,
  onNotificationPress,
  onProfilePress,
}: HomeHeaderProps) {
  const hour = new Date().getHours();

  return (
    <View style={styles.row}>
      <View style={styles.textBlock}>
        <Text style={styles.eyebrow}>{getGreetingWord(hour)}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {name} 👋
        </Text>
      </View>

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
          <Text style={styles.avatarText}>{avatarInitial ?? '?'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textBlock: {
    flexShrink: 1,
    gap: 2,
  },
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  name: {
    fontFamily: fonts.headingBold,
    fontSize: 24,
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
    backgroundColor: colors.surface,
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
    borderColor: colors.surface,
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
