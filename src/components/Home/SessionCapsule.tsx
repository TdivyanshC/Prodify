import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, gradients, radii } from '../../theme';

interface SessionCapsuleProps {
  icon: string;
  title: string;
  meta: string;
  isLive?: boolean;
  accentColor: string;
  actionLabel: string;
  onAction: () => void;
}

// Ground-up rebuild: a bigger, richer card than the old plain capsule —
// a category-tinted icon chip and a left accent stripe give it a color
// identity at a glance (matching the theme carousel's visual language),
// rather than every card reading as an identical gray rectangle.
export function SessionCapsule({ icon, title, meta, isLive, accentColor, actionLabel, onAction }: SessionCapsuleProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={styles.capsule}>
      <View style={[styles.accentStripe, { backgroundColor: accentColor }]} />
      <View style={styles.inner}>
        <View style={[styles.iconChip, { backgroundColor: accentColor + '26', borderColor: accentColor + '4D' }]}>
          <Text style={styles.iconGlyph}>{icon}</Text>
          {isLive ? (
            <View style={styles.liveDotWrap}>
              <Animated.View
                style={[styles.liveRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
              />
              <View style={styles.liveDot} />
            </View>
          ) : null}
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>

        <Pressable onPress={onAction} style={styles.buttonWrap}>
          <LinearGradient colors={gradients.primary} style={styles.button}>
            <Text style={styles.buttonLabel}>{actionLabel} →</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    width: 208,
    flexDirection: 'row',
    borderRadius: radii.cardSmall,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  accentStripe: {
    width: 4,
  },
  inner: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconGlyph: {
    fontSize: 17,
  },
  liveDotWrap: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveRing: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  buttonWrap: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: radii.button,
  },
  button: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.button,
  },
  buttonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textPrimary,
  },
});
