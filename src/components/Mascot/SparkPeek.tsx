import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

// Reverted to the static image — see Mascot.tsx for why (real-time 3D
// caused a repeated, confirmed ANR/freeze on-device).
const mascotImage = require('../../assets/mascot/spark.png');
const MASCOT_ASPECT_RATIO = 647 / 660;
const PEEK_WIDTH = 68;
const PEEK_VISIBLE_HEIGHT = 32;

interface SparkPeekProps {
  onPress: () => void;
}

// Wireframe §6: Spark lives partially below the visible screen — only a
// small peek shows normally, on purpose ("should NOT look like a
// permanently visible floating button"). This is the at-rest state;
// SparkOverlay handles the full rise-up pop-up.
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
      <View style={styles.clip}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          <Image
            source={mascotImage}
            resizeMode="contain"
            style={{ width: PEEK_WIDTH, height: imageHeight }}
          />
        </Animated.View>
      </View>
      <Text style={styles.hint}>Tap Spark</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  clip: {
    width: PEEK_WIDTH,
    height: PEEK_VISIBLE_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  hint: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
});
