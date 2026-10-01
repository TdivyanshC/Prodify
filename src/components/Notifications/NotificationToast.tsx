import Feather from '@expo/vector-icons/Feather';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/routes';
import { useNotificationStore } from '../../store/useNotificationStore';
import { colors, fonts, radii, shadows } from '../../theme';
import type { AppNotification, AppNotificationType } from '../../types/social';
import { openNotification } from '../../utils/openNotification';

const AUTO_HIDE_MS = 4500;

export const NOTIFICATION_EMOJI: Record<AppNotificationType, string> = {
  space_invite: '✉️',
  friend_started_space: '🟢',
  space_reminder: '⏰',
  own_space_due: '🚀',
};

// Top-of-screen banner for a freshly delivered notification — the in-app
// half of what Phase 4 also sends as a push. Mounted once in App.tsx inside
// NavigationContainer (tapping it navigates). Slides down, auto-hides, and
// can be dismissed with the x.
export function NotificationToast() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const toastId = useNotificationStore((s) => s.toastId);
  const notification = useNotificationStore((s) => s.notifications.find((n) => n._id === s.toastId));
  const dismissToast = useNotificationStore((s) => s.dismissToast);

  // Holds the last shown notification through the exit animation, after
  // the store has already cleared toastId.
  const [shown, setShown] = useState<AppNotification | null>(null);
  const translateY = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    if (notification) {
      setShown(notification);
      translateY.setValue(-200);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 70 }).start();
      const timer = setTimeout(dismissToast, AUTO_HIDE_MS);
      return () => clearTimeout(timer);
    }
    Animated.timing(translateY, {
      toValue: -200,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setShown(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastId]);

  if (!shown) return null;

  return (
    <View style={[styles.outer, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <Animated.View style={[styles.toast, shadows.card, { transform: [{ translateY }] }]}>
        <Pressable
          style={styles.body}
          onPress={() => openNotification(navigation, shown)}
          accessibilityRole="button"
          accessibilityLabel={`${shown.title}. ${shown.body}`}
        >
          <Text style={styles.emoji}>{NOTIFICATION_EMOJI[shown.type]}</Text>
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>
              {shown.title}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              {shown.body}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={dismissToast} hitSlop={10} style={styles.close} accessibilityLabel="Dismiss">
          <Feather name="x" size={16} color={colors.textSecondary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    paddingLeft: 14,
    paddingRight: 8,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  emoji: {
    fontSize: 20,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  message: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
