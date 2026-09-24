import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { mascotQuotes } from '../../mocks/mascotQuotes';
import { SPARK_EVENT_MOOD, SPARK_EVENT_QUOTE_CATEGORY, useSparkOverlayStore } from '../../store/useSparkOverlayStore';
import { colors, fonts } from '../../theme';
import { fillVars } from '../../utils/resolveMascotQuote';
import { Mascot } from './Mascot';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SPARK_WRAP_SIDE_MARGIN = 20 + 24; // tapCatcher's paddingLeft + paddingRight

// Product brief: Spark appears bottom-left, icon + message box side by
// side (compact layout), tapping the screen advances through Spark's
// unread messages one at a time — once the last one's been read, Spark
// plays an exit animation and disappears (rather than looping forever).
// Mounted once at the app root (App.tsx) so `showSpark(...)` works from
// any screen.
export function SparkOverlay() {
  const visible = useSparkOverlayStore((s) => s.visible);
  const eventKey = useSparkOverlayStore((s) => s.eventKey);
  const vars = useSparkOverlayStore((s) => s.vars);
  const hide = useSparkOverlayStore((s) => s.hide);

  const [messageIndex, setMessageIndex] = useState(0);
  // Tracks whether Spark's Modal/Canvas should be mounted at all — critical
  // now that the mascot is a live WebGL render, not a static image: Modal's
  // own `visible` prop only hides the native window, it does NOT unmount
  // children. Without this, `if (!eventKey) return null` (eventKey is set
  // once by the first showSpark() call and never cleared) left the 3D
  // Canvas permanently mounted and its rotation render loop permanently
  // running in the background after the very first time Spark appeared —
  // invisible, but still burning GPU/JS-thread cycles forever, which is
  // what was causing the app-wide lag.
  const [mounted, setMounted] = useState(false);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMessageIndex(0);
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 7,
          tension: 55,
        }),
      ]).start();
    }
  }, [visible, backdropOpacity, translateY]);

  const runExit = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMounted(false);
      hide();
    });
  };

  const category = eventKey ? SPARK_EVENT_QUOTE_CATEGORY[eventKey] : 'idle';
  const mood = eventKey ? SPARK_EVENT_MOOD[eventKey] : 'idle';

  // Spark's unread queue for this appearance — every quote in the
  // triggered category, filled with this event's vars, shown one per tap.
  const queue = useMemo(
    () => mascotQuotes[category].map((quote) => fillVars(quote, vars)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, visible]
  );

  const currentMessage = queue[messageIndex];
  const hasMoreAfterThis = messageIndex < queue.length - 1;

  const handleTap = () => {
    if (hasMoreAfterThis) {
      setMessageIndex((i) => i + 1);
      return;
    }
    runExit();
  };

  if (!eventKey || !mounted) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={runExit}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <BlurView
          intensity={50}
          tint="dark"
          blurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Pressable style={styles.tapCatcher} onPress={handleTap}>
        <Animated.View style={[styles.sparkWrap, { transform: [{ translateY }] }]}>
          <Mascot variant="compact" messageOverride={currentMessage} mood={mood} />
          <Text style={styles.hint}>{hasMoreAfterThis ? 'Tap for next' : 'Tap to close'}</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  tapCatcher: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingLeft: 20,
    paddingRight: 24,
    paddingBottom: 40,
  },
  sparkWrap: {
    alignItems: 'flex-start',
    gap: 8,
    maxWidth: SCREEN_WIDTH - SPARK_WRAP_SIDE_MARGIN,
  },
  hint: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 4,
  },
});
