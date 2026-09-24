import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, gradients, radii, shadows } from '../../theme';

interface CreateSessionCTAProps {
  onPress: () => void;
}

// Wireframe §4: the strongest CTA on the screen — a broad theme, then a
// user-defined session name/duration, is chosen inside the modal this
// opens. Rendered in the brand gradient with a raised, tactile "3D
// button" treatment (top gloss + glow + press-depth) so it unmistakably
// reads as *the* action on Home, not one card among several.
export function CreateSessionCTA({ onPress }: CreateSessionCTAProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8, tension: 220 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 160 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.wrap, shadows.glow, { transform: [{ scale }] }]}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
          <LinearGradient
            colors={[colors.sheen, 'transparent']}
            style={styles.sheen}
            pointerEvents="none"
          />
          <View style={styles.iconBadge}>
            <Feather name="plus" size={20} color={colors.textPrimary} />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.title}>Create & start a session</Text>
            <Text style={styles.subtitle}>Pick a theme and get going in seconds.</Text>
          </View>
          <Feather name="arrow-right" size={18} color={colors.textPrimary} style={styles.chevron} />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.card,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: radii.card,
    gap: 14,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 34,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: 'rgba(245,243,255,0.85)',
  },
  chevron: {
    opacity: 0.85,
  },
});
