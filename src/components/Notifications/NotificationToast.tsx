import Feather from '@expo/vector-icons/Feather';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/routes';
import { useNotificationStore } from '../../store/useNotificationStore';
import { colors, fonts, radii, shadows } from '../../theme';
import type { AppNotification } from '../../types/social';
import { openNotification, runNotificationAction } from '../../utils/notifications/actions';
import { NotificationActions } from './NotificationActions';
import { NotificationAvatar } from './NotificationAvatar';
import { TONE_ACCENT } from './notificationTone';

const AUTO_HIDE_MS = 5000;
// Toasts with buttons stay up longer — there's a decision to make.
const AUTO_HIDE_WITH_ACTIONS_MS = 8000;
const SWIPE_DISMISS_PX = 60;
const OFFSCREEN_Y = -240;

// Light tap for social, success buzz for rewards, a firmer tap for nudges.
// Played when the toast appears — held/quiet notifications never buzz.
function playNotificationHaptic(notification: AppNotification) {
  if (notification.tone === 'reward') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } else if (notification.tone === 'nudge') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

// Top-of-screen banner — the in-app half of what Phase 4 also sends as a
// push. Shows the store's toast queue one at a time: slides down, buzzes
// (per tone), auto-hides, and can be swiped up or sideways to dismiss.
// Mounted once in App.tsx inside NavigationContainer (buttons navigate).
export function NotificationToast() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const toastId = useNotificationStore((s) => s.toastId);
  const notification = useNotificationStore((s) => s.notifications.find((n) => n._id === s.toastId));
  const dismissToast = useNotificationStore((s) => s.dismissToast);

  // Holds the last shown notification through the exit animation, after
  // the store has already moved on.
  const [shown, setShown] = useState<AppNotification | null>(null);
  const translateY = useRef(new Animated.Value(OFFSCREEN_Y)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  const scheduleHide = (n: AppNotification) => {
    clearHideTimer();
    hideTimer.current = setTimeout(dismissToast, n.actions.length > 0 ? AUTO_HIDE_WITH_ACTIONS_MS : AUTO_HIDE_MS);
  };

  useEffect(() => {
    if (notification) {
      setShown(notification);
      translateX.setValue(0);
      translateY.setValue(OFFSCREEN_Y);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 70 }).start();
      playNotificationHaptic(notification);
      scheduleHide(notification);
      return clearHideTimer;
    }
    Animated.timing(translateY, {
      toValue: OFFSCREEN_Y,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setShown(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastId]);

  // Swipe up or sideways to dismiss; a short drag snaps back and resumes
  // the auto-hide countdown.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 || g.dy < -8,
        onPanResponderGrant: clearHideTimer,
        onPanResponderMove: (_e, g) => {
          translateX.setValue(g.dx);
          translateY.setValue(Math.min(0, g.dy));
        },
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) > SWIPE_DISMISS_PX) {
            Animated.timing(translateX, { toValue: Math.sign(g.dx) * 500, duration: 180, useNativeDriver: true }).start(
              () => dismissToast()
            );
          } else if (g.dy < -SWIPE_DISMISS_PX / 2) {
            dismissToast();
          } else {
            Animated.parallel([
              Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
              Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
            ]).start();
            const current = useNotificationStore.getState().notifications.find(
              (n) => n._id === useNotificationStore.getState().toastId
            );
            if (current) scheduleHide(current);
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (!shown) return null;

  return (
    <View style={[styles.outer, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.toast, shadows.card, { transform: [{ translateY }, { translateX }] }]}
      >
        <View style={[styles.accent, { backgroundColor: TONE_ACCENT[shown.tone] }]} />
        <View style={styles.content}>
          <Pressable
            style={styles.body}
            onPress={() => openNotification(navigation, shown)}
            accessibilityRole="button"
            accessibilityLabel={`${shown.title}. ${shown.body}`}
          >
            <NotificationAvatar sender={shown.sender} size={40} />
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={2}>
                {shown.title}
              </Text>
              <Text style={styles.message} numberOfLines={2}>
                {shown.body}
              </Text>
            </View>
          </Pressable>
          <NotificationActions
            actions={shown.actions}
            compact
            onAction={(action) => runNotificationAction(navigation, shown, action)}
          />
        </View>
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
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  accent: {
    width: 4,
  },
  content: {
    flex: 1,
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 12,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  message: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  close: {
    width: 36,
    alignItems: 'center',
    paddingTop: 12,
  },
});
