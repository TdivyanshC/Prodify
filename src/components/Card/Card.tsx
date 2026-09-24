import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows } from '../../theme';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// Shared card chrome (design system discipline, claude.md §3b): rounded
// surface, subtle border, directional shadow, and a thin top gloss
// highlight — the "raised, tactile" premium treatment rather than a flat
// tinted rectangle. Pressable cards squish slightly on press for a real
// 3D-button feel instead of just an opacity change.
export function Card({ children, onPress, style }: CardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const content = (
    <View style={[styles.card, shadows.card, style]}>
      <LinearGradient
        colors={[colors.sheen, 'transparent']}
        style={styles.sheen}
        pointerEvents="none"
      />
      {children}
    </View>
  );

  if (!onPress) return content;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, friction: 8, tension: 200 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 160 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={{ transform: [{ scale }] }}>{content}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
  },
});
