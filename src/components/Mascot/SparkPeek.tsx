import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

// Reverted to the static image — see Mascot.tsx for why (real-time 3D
// caused a repeated, confirmed ANR/freeze on-device).
const mascotImage = require('../../assets/mascot/spark.png');
const MASCOT_ASPECT_RATIO = 647 / 660;
const PEEK_WIDTH = 56;

interface SparkPeekProps {
  onPress: () => void;
}

// At-rest Spark: the whole character resting just above the tab bar, gently bobbing, with a small
// "Tap Spark" pill beside it. (The earlier version clipped her head at a hard line in mid-air, which
// read as a rendering bug.) SparkOverlay handles the full rise-up pop-up.
export function SparkPeek({ onPress }: SparkPeekProps) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const imageHeight = PEEK_WIDTH / MASCOT_ASPECT_RATIO;

  return (
    <Pressable onPress={onPress} style={styles.container} accessibilityLabel="Spark">
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Image source={mascotImage} resizeMode="contain" style={{ width: PEEK_WIDTH, height: imageHeight }} />
      </Animated.View>
      <View style={styles.pill}>
        <Text style={styles.hint}>Tap Spark</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
