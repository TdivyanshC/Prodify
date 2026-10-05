import { useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../theme';
import type { AppNotification, NotificationAction } from '../../types/social';
import { NotificationActions } from './NotificationActions';
import { NotificationAvatar } from './NotificationAvatar';
import { TONE_ACCENT } from './notificationTone';

interface NotificationRowProps {
  notification: AppNotification;
  onPress: () => void;
  onAction: (action: NotificationAction) => void;
  onDismiss: () => void;
}

const SWIPE_DELETE_PX = 110;

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

// One inbox entry: sender avatar, copy, time, unread dot, and its action
// buttons (only while unread-and-actionable — handled actions clear them).
// Swipe left past the threshold to dismiss it from the inbox.
export function NotificationRow({ notification: n, onPress, onAction, onDismiss }: NotificationRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_e, g) => translateX.setValue(Math.min(0, g.dx)),
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -SWIPE_DELETE_PX) {
            Animated.timing(translateX, { toValue: -600, duration: 180, useNativeDriver: true }).start(onDismiss);
          } else {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [translateX, onDismiss]
  );

  return (
    <View style={styles.swipeTrack}>
      <View style={styles.deleteHint}>
        <Text style={styles.deleteHintLabel}>Dismiss</Text>
      </View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        <View style={[styles.row, !n.openedAt && styles.rowUnread]}>
          {!n.openedAt ? <View style={[styles.accent, { backgroundColor: TONE_ACCENT[n.tone] }]} /> : null}
          <Pressable
            onPress={onPress}
            style={styles.main}
            accessibilityRole="button"
            accessibilityLabel={`${n.openedAt ? '' : 'Unread. '}${n.title}. ${n.body}`}
            accessibilityHint="Swipe left to dismiss"
          >
            <NotificationAvatar sender={n.sender} size={40} />
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={2}>
                {n.title}
              </Text>
              <Text style={styles.body} numberOfLines={3}>
                {n.body}
              </Text>
              <Text style={styles.time}>{timeAgo(n.sentAt)}</Text>
            </View>
            {!n.openedAt ? <View style={styles.unreadDot} /> : null}
          </Pressable>
          {n.actions.length > 0 ? (
            <View style={styles.actions}>
              <NotificationActions actions={n.actions} compact onAction={onAction} />
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeTrack: {
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  deleteHint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 20,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.card,
  },
  deleteHintLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  row: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  rowUnread: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  },
  accent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
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
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  time: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  actions: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingLeft: 66,
  },
});
