import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useMascotStore } from '../../store/useMascotStore';
import { colors, fonts, gradients, radii, shadows } from '../../theme';
import { useReducedMotion } from '../../utils/useReducedMotion';

// Reverted to the static image after real-time 3D (Mascot3D.tsx) proved
// unstable on-device — repeated ANR/freeze-and-kill even after fixing five
// distinct real bugs in that pipeline (background-canvas leak, stale asset
// cache, oversized texture, React 19 incompatibility, a three.js crash).
// The 3D code is kept in place, just not wired in here, so it can be
// revisited later with a lighter model and a real profiler.
const mascotImage = require('../../assets/mascot/spark.png');
// Bust crop (legs excluded) of the source render — 647x660, near-square.
const MASCOT_ASPECT_RATIO = 647 / 660;

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// Architecture §1 §11: a reusable mood system rather than distinct art per
// state (we have one static render, not a full sprite set) — mood changes
// the breathing animation's speed/amplitude, and 'celebrating' adds a
// confetti burst. Distinguishing states this way, honestly, until real
// per-state art exists.
export type MascotMood = 'idle' | 'excited' | 'proud' | 'sleepy' | 'celebrating';

const BREATH_PROFILES: Record<MascotMood, { duration: number; scaleRange: [number, number] }> = {
  idle: { duration: 1800, scaleRange: [0.96, 1.05] },
  excited: { duration: 700, scaleRange: [0.94, 1.1] },
  proud: { duration: 1100, scaleRange: [0.97, 1.08] },
  sleepy: { duration: 2600, scaleRange: [0.98, 1.02] },
  celebrating: { duration: 650, scaleRange: [0.93, 1.12] },
};

interface MascotProps {
  // 'full' = big centered presence (bubble below), used on the original
  // mascot-first screen. 'compact' = small companion alongside other
  // content (bubble beside it) — per architecture §2 §5: "Spark should not
  // take over the entire screen... feel like a companion rather than a
  // decoration."
  variant?: 'full' | 'compact';
  // Overrides the message text while still deriving the warning border
  // from the real mascot-priority state — lets callers (Home's greeting,
  // session empty states, etc.) show contextual copy without duplicating
  // the streak-at-risk priority logic.
  messageOverride?: string;
  mood?: MascotMood;
}

// Mascot presence: static rendered mascot image + a message, either the
// mock priority logic's current pick (mascotService, claude.md §4) or a
// caller-supplied override. The image is an offline render of the real 3D
// mascot asset (not yet a Lottie/animated asset) — swap for a proper
// idle-loop animation once one exists.
//
// Animations use core RN Animated, not Reanimated: react-native-reanimated
// v4's react-native-worklets native module isn't wired up in stock Expo Go
// for this SDK (crashes with "NativeWorklets ... Cannot read property
// 'code' of undefined"), and this project is staying on plain Expo Go
// rather than a custom dev client for now.
export function Mascot({ variant = 'full', messageOverride, mood = 'idle' }: MascotProps) {
  const message = useMascotStore((state) => state.message);
  const isLoading = useMascotStore((state) => state.isLoading);
  const refresh = useMascotStore((state) => state.refresh);

  useEffect(() => {
    if (!message) {
      refresh();
    }
  }, [message, refresh]);

  const isStreakAtRisk = useMemo(() => message?.eventType === 'streak_at_risk', [
    message?.eventType,
  ]);
  const displayText = messageOverride ?? message?.quote;

  // Idle breathing loop: a slow, gentle scale + glow-opacity oscillation
  // rather than a flat pulse — stand-in motion until the real Lottie idle
  // loop from prodify_mascot_prompts.md §3.10 lands. Skipped entirely when
  // the OS reduce-motion setting is on (§4 §20).
  const reducedMotion = useReducedMotion();
  const breathe = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      return;
    }

    Animated.timing(entrance, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const { duration } = BREATH_PROFILES[mood];
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, entrance, reducedMotion, mood]);

  const [scaleMin, scaleMax] = BREATH_PROFILES[mood].scaleRange;
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [scaleMin, scaleMax] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });
  const entranceOpacity = entrance;
  const entranceTranslateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  const mascotWidth = variant === 'compact' ? 64 : 190;
  const glowSize = mascotWidth * 0.85;

  const mascotVisual = (
    <Animated.View
      style={[
        { width: mascotWidth, aspectRatio: MASCOT_ASPECT_RATIO },
        styles.mascotWrap,
        { transform: [{ scale }] },
      ]}
    >
      <AnimatedLinearGradient
        colors={gradients.primary}
        style={[
          styles.glow,
          { width: glowSize, height: glowSize, borderRadius: glowSize / 2, opacity: glowOpacity },
        ]}
      />
      <Animated.Image source={mascotImage} resizeMode="contain" style={styles.mascotImage} />
    </Animated.View>
  );

  // Only render the bubble when there's actually something to say — a
  // mascot without a pending message shows as icon-only (product brief:
  // "only if the mascot has a message to display" does the box appear).
  const hasMessage = isLoading || Boolean(displayText);

  const bubble = !hasMessage ? null : (
    <View
      style={[
        styles.bubbleWrap,
        variant === 'compact' && styles.bubbleWrapCompact,
        isStreakAtRisk && styles.bubbleWrapWarning,
        shadows.card,
      ]}
    >
      <BlurView
        intensity={40}
        tint="dark"
        blurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bubbleOverlay} />
      <View style={[styles.bubbleContent, variant === 'compact' && styles.bubbleContentCompact]}>
        {isLoading && !message && !messageOverride ? (
          <MascotMessageSkeleton compact={variant === 'compact'} />
        ) : (
          <Text
            style={[styles.message, variant === 'compact' && styles.messageCompact]}
            numberOfLines={variant === 'compact' ? 2 : undefined}
          >
            {displayText}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <Animated.View
      style={[
        variant === 'compact' ? styles.containerCompact : styles.container,
        { opacity: entranceOpacity, transform: [{ translateY: entranceTranslateY }] },
      ]}
    >
      {mascotVisual}
      {mood === 'celebrating' && !reducedMotion ? <ConfettiBurst /> : null}
      {bubble}
    </Animated.View>
  );
}

// Minimal confetti burst for celebrating moments (§1 §16) — a handful of
// colored dots flung outward and fading, not a full particle library.
const CONFETTI_COLORS = [colors.accentGold, colors.primaryLight, colors.success, colors.primary];
function ConfettiBurst() {
  const pieces = useRef(
    Array.from({ length: 10 }, (_, i) => ({
      anim: new Animated.Value(0),
      angle: (i / 10) * Math.PI * 2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }))
  ).current;

  useEffect(() => {
    Animated.stagger(
      20,
      pieces.map((p) =>
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, [pieces]);

  return (
    <View pointerEvents="none" style={styles.confettiWrap}>
      {pieces.map((p, i) => {
        const distance = 46;
        const translateX = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(p.angle) * distance],
        });
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * distance],
        });
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

// Lightweight shimmer standing in for the message text while it resolves.
// Mock data resolves instantly today, but Phase 2 replaces mascotService
// with a real network call, so this path needs to already be correct.
function MascotMessageSkeleton({ compact }: { compact: boolean }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <View style={styles.skeletonContainer}>
      <Animated.View
        style={[
          styles.skeletonLine,
          compact ? styles.skeletonLineCompact : styles.skeletonLineWide,
          { opacity },
        ]}
      />
      {!compact && (
        <Animated.View style={[styles.skeletonLine, styles.skeletonLineNarrow, { opacity }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  containerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mascotWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  confettiWrap: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mascotImage: {
    width: '100%',
    height: '100%',
  },
  bubbleWrap: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
    maxWidth: 300,
    overflow: 'hidden',
  },
  bubbleWrapCompact: {
    marginTop: 0,
    marginLeft: 10,
    maxWidth: 220,
    flexShrink: 1,
    borderRadius: radii.cardSmall,
  },
  bubbleWrapWarning: {
    borderColor: colors.warning,
  },
  bubbleOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.glassTint,
  },
  bubbleContent: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  bubbleContentCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  message: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  messageCompact: {
    fontSize: 13,
    textAlign: 'left',
  },
  skeletonContainer: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  skeletonLineWide: {
    width: 220,
  },
  skeletonLineCompact: {
    width: 130,
    height: 10,
  },
  skeletonLineNarrow: {
    width: 150,
  },
});
