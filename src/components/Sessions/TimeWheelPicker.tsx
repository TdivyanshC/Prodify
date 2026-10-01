import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { colors, fonts, radii } from '../../theme';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

interface TimeWheelPickerProps {
  minMinutes: number;
  maxMinutes: number;
  stepMinutes: number;
  value: number;
  onChange: (minutes: number) => void;
}

// A real "spin to pick" wheel (iOS UIPickerView-style), not a row of preset
// chips — snaps to `stepMinutes` increments and taps a light selection
// haptic every time the centered value changes, so scrolling has physical
// feedback instead of feeling like plain text scrolling past. Built on RN's
// own Animated API (already used throughout the app) rather than pulling in
// react-native-reanimated for one component.
export function TimeWheelPicker({ minMinutes, maxMinutes, stepMinutes, value, onChange }: TimeWheelPickerProps) {
  const values = useMemo(() => {
    const list: number[] = [];
    for (let m = minMinutes; m <= maxMinutes; m += stepMinutes) list.push(m);
    return list;
  }, [minMinutes, maxMinutes, stepMinutes]);

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const initialIndex = Math.max(0, Math.round((value - minMinutes) / stepMinutes));
  const lastHapticIndex = useRef(initialIndex);

  // `contentOffset` alone isn't reliably honored by every ScrollView
  // implementation (notably react-native-web, where the wheel would
  // otherwise silently start at the first item regardless of `value`) — an
  // imperative scroll after mount guarantees the wheel actually lands on
  // the passed-in value everywhere.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: initialIndex * ITEM_HEIGHT, animated: false });
    });
    return () => cancelAnimationFrame(raf);
    // Deliberately mount-only — re-running on every `value` change would
    // fight the user's own scroll gesture (this component drives `value`
    // changes right back up via onChange).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, index));
      if (clamped !== lastHapticIndex.current) {
        lastHapticIndex.current = clamped;
        Haptics.selectionAsync();
        onChange(values[clamped]);
      }
    },
    [values, onChange]
  );

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, index));
      scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
      onChange(values[clamped]);
    },
    [values, onChange]
  );

  const onScrollEvent = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: handleScroll,
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.centerIndicator} pointerEvents="none" />

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={onScrollEvent}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: PAD }}
        contentOffset={{ x: 0, y: initialIndex * ITEM_HEIGHT }}
      >
        {values.map((minutes, index) => (
          <WheelItem key={minutes} minutes={minutes} index={index} scrollY={scrollY} />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

function WheelItem({ minutes, index, scrollY }: { minutes: number; index: number; scrollY: Animated.Value }) {
  const center = index * ITEM_HEIGHT;
  const scale = scrollY.interpolate({
    inputRange: [center - 2 * ITEM_HEIGHT, center, center + 2 * ITEM_HEIGHT],
    outputRange: [0.72, 1, 0.72],
    extrapolate: 'clamp',
  });
  const opacity = scrollY.interpolate({
    inputRange: [center - 2 * ITEM_HEIGHT, center - ITEM_HEIGHT, center, center + ITEM_HEIGHT, center + 2 * ITEM_HEIGHT],
    outputRange: [0.25, 0.55, 1, 0.55, 0.25],
    extrapolate: 'clamp',
  });

  const label = minutes >= 60 ? formatHours(minutes) : `${minutes} min`;

  return (
    <View style={styles.item}>
      <Animated.Text style={[styles.itemLabel, { transform: [{ scale }], opacity }]}>{label}</Animated.Text>
    </View>
  );
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hr`;
  return `${h}h ${m}m`;
}

const styles = StyleSheet.create({
  wrap: {
    height: WHEEL_HEIGHT,
    justifyContent: 'center',
  },
  centerIndicator: {
    position: 'absolute',
    top: PAD,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: radii.button,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
});
