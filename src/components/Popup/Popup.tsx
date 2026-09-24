import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePopupStore } from '../../store/usePopupStore';
import { colors, fonts, gradients, radii, shadows } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Generic reusable popup: Lottie animation + title/message + optional
// action buttons. Backs the mascot popup, badge-earned popup,
// friend-request popup, and confirmation dialogs (claude.md §2) so each
// one is a different set of props on this same component, not a one-off
// screen.
//
// Mounted once at the app root (App.tsx), driven by usePopupStore — same
// pattern as SparkOverlay — so it always covers the full screen including
// the floating tab bar, instead of being boxed into whichever screen's
// own layout happened to render it (that was the previous bug: a popup
// rendered inside a tab screen can only fill that screen's content area,
// which stops above the tab bar, so it never reached the true bottom).
//
// A classic bottom sheet — springs up from off-screen with a visible
// bounce, slides back down with a quicker ease-out on close. Deliberately
// NOT built on RN's <Modal>: Modal renders in a separate native window on
// Android, and LottieView doesn't bridge into that window correctly there
// — it mounts but never paints.
export function Popup() {
  const visible = usePopupStore((s) => s.visible);
  const title = usePopupStore((s) => s.title);
  const message = usePopupStore((s) => s.message);
  const lottieSource = usePopupStore((s) => s.lottieSource);
  const actions = usePopupStore((s) => s.actions);
  const hidePopup = usePopupStore((s) => s.hidePopup);

  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 65 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={hidePopup} />
      </Animated.View>

      <View style={styles.sheetOuter} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            shadows.card,
            { paddingBottom: Math.max(insets.bottom, 20), transform: [{ translateY }] },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.cardContent}>
            {lottieSource ? (
              <LottieView source={lottieSource} autoPlay loop style={styles.lottie} />
            ) : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <Text style={[styles.message, title && styles.messageSubtitle]}>{message}</Text>
            {actions && actions.length > 0 ? (
              <View style={styles.actionsRow}>
                {actions.map((action) =>
                  action.variant === 'secondary' ? (
                    <Pressable
                      key={action.label}
                      onPress={action.onPress}
                      style={styles.actionButtonSecondary}
                    >
                      <Text style={styles.actionLabelSecondary}>{action.label}</Text>
                    </Pressable>
                  ) : (
                    <Pressable key={action.label} onPress={action.onPress}>
                      <LinearGradient colors={gradients.primary} style={styles.actionButton}>
                        <Text style={styles.actionLabel}>{action.label}</Text>
                      </LinearGradient>
                    </Pressable>
                  )
                )}
              </View>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  sheetOuter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
  },
  cardContent: {
    width: '100%',
    padding: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  lottie: {
    width: 120,
    height: 120,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 14,
    color: colors.textPrimary,
  },
  message: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    color: colors.textPrimary,
  },
  messageSubtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    marginTop: 4,
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radii.button,
  },
  actionButtonSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radii.button,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionLabel: {
    fontFamily: fonts.bodySemiBold,
    color: colors.textPrimary,
  },
  actionLabelSecondary: {
    fontFamily: fonts.bodySemiBold,
    color: colors.textSecondary,
  },
});
