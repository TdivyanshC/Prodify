import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, gradients } from '../../theme';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// Branded loading/splash state — shown while fonts load at app start, and
// reusable anywhere else a full-screen loading moment is needed. Same
// mark as the desktop sidebar's logo badge, with a slow breathing glow so
// the app feels alive even before any real content has mounted.
export function LoadingScreen() {
  const breathe = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  // A sleeping free-tier server can take up to a minute to wake; say so
  // instead of leaving the user staring at dots.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();

    const dotLoop = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 420, useNativeDriver: true }),
          Animated.delay(840 - delay),
        ])
      );
    const l1 = dotLoop(dot1, 0);
    const l2 = dotLoop(dot2, 160);
    const l3 = dotLoop(dot3, 320);
    l1.start();
    l2.start();
    l3.start();

    return () => {
      loop.stop();
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [breathe, dot1, dot2, dot3]);

  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.55] });
  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] });

  return (
    <View style={styles.container}>
      <View style={styles.markWrap}>
        <AnimatedLinearGradient
          colors={gradients.primary}
          style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
        />
        <LinearGradient colors={gradients.primary} style={styles.mark}>
          <Text style={styles.markText}>P</Text>
        </LinearGradient>
      </View>

      <Text style={styles.wordmark}>Prodify</Text>

      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { opacity: dot3 }]} />
      </View>
      {slow ? <Text style={styles.slow}>Waking things up… the first start can take up to a minute.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  markWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  glow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    color: colors.textPrimary,
  },
  wordmark: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 6,
  },
  slow: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryLight,
  },
});
