import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

interface SuccessBadgeProps {
  emoji: string;
  // 'celebrate' = a bouncy overshoot pop-in for hitting the target.
  // 'grow' = a slower, gentle sprout-in for the supportive missed-target
  // case — motion should feel calm, not triumphant, per claude.md §4.
  variant: 'celebrate' | 'grow';
}

const CONFETTI_COLORS = [colors.accentGold, colors.primaryLight, colors.success, colors.primary];

// No Lottie available in Expo Go (confirmed — it needs a custom dev client
// to render at all), so this is a hand-built RN Animated equivalent: a
// real entrance animation, not a static emoji glyph.
export function SuccessBadge({ emoji, variant }: SuccessBadgeProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (variant === 'celebrate') {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 90 }),
      ]).start();
    } else {
      Animated.timing(scale, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        Animated.sequence([
          Animated.timing(rotate, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(rotate, { toValue: -1, duration: 260, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 0, duration: 200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]).start();
      });
    }
  }, [variant, scale, rotate]);

  const rotateDeg = rotate.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] });

  return (
    <View style={styles.wrap}>
      {variant === 'celebrate' ? <ConfettiBurst /> : null}
      <Animated.Text
        style={[
          styles.emoji,
          { transform: [{ scale }, { rotate: variant === 'grow' ? rotateDeg : '0deg' }] },
        ]}
      >
        {emoji}
      </Animated.Text>
    </View>
  );
}

// Same pattern as Mascot's ConfettiBurst — a handful of colored dots flung
// outward and fading, kept local here since this fires on a different
// screen and doesn't need the mascot's mood plumbing.
function ConfettiBurst() {
  const pieces = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      anim: new Animated.Value(0),
      angle: (i / 12) * Math.PI * 2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }))
  ).current;

  useEffect(() => {
    Animated.stagger(
      18,
      pieces.map((p) =>
        Animated.timing(p.anim, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      )
    ).start();
  }, [pieces]);

  return (
    <View pointerEvents="none" style={styles.confettiWrap}>
      {pieces.map((p, i) => {
        const distance = 60;
        const translateX = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * distance] });
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.angle) * distance] });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.confettiDot,
              { backgroundColor: p.color, opacity, transform: [{ translateX }, { translateY }] },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 48,
  },
  confettiWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
