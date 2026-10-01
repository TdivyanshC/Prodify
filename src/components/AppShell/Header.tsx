import Feather from '@expo/vector-icons/Feather';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RootStackParamList } from '../../navigation/routes';
import { useNotificationStore } from '../../store/useNotificationStore';
import { colors, fonts } from '../../theme';
import type { FeatherIconName } from '../icons/FeatherIconName';

interface HeaderProps {
  title: string;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  avatarInitial?: string;
  hasNotification?: boolean;
  // Optional highlighted control (brand-tinted, unlike the neutral bell/
  // avatar chrome) for a screen's single primary top-corner action — e.g.
  // Sessions' "+ Create" tab. Omitted by every other screen, so this is
  // additive and never changes existing headers. `label` renders it as a
  // small pill (icon + text) instead of an icon-only circle.
  rightAction?: { icon: FeatherIconName; onPress: () => void; accessibilityLabel: string; label?: string };
}

// Shared top bar (architecture §2 §3): page title on the left, notification
// bell + avatar on the right. Deliberately minimal — no extra controls.
export function Header({
  title,
  onNotificationPress,
  onProfilePress,
  avatarInitial,
  hasNotification,
  rightAction,
}: HeaderProps) {
  // The bell works on every screen by default — unread dot from the
  // inbox, tap opens Notifications. Screens can still override either.
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const hasUnread = useNotificationStore((s) => s.notifications.some((n) => !n.openedAt));
  const showDot = hasNotification ?? hasUnread;
  const handleNotificationPress = onNotificationPress ?? (() => navigation.navigate('Notifications'));

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.actions}>
        {rightAction ? (
          <Pressable
            onPress={rightAction.onPress}
            hitSlop={8}
            style={rightAction.label ? styles.primaryPillButton : styles.primaryIconButton}
            accessibilityLabel={rightAction.accessibilityLabel}
          >
            <Feather name={rightAction.icon} size={16} color={colors.textPrimary} />
            {rightAction.label ? <Text style={styles.primaryPillLabel}>{rightAction.label}</Text> : null}
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleNotificationPress}
          hitSlop={8}
          style={styles.iconButton}
          accessibilityLabel={showDot ? 'Notifications, unread' : 'Notifications'}
        >
          <Feather name="bell" size={19} color={colors.textSecondary} />
          {showDot ? <View style={styles.badgeDot} /> : null}
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
  primaryIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  primaryPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: colors.primary,
  },
  primaryPillLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textPrimary,
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
