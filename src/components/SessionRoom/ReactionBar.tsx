import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../theme';

export type ReactionType = 'clap' | 'fire' | 'fist_bump';

export const REACTION_META: Record<ReactionType, { emoji: string; label: string }> = {
  clap: { emoji: '👏', label: 'Clap' },
  fire: { emoji: '🔥', label: 'Fire' },
  fist_bump: { emoji: '🤜', label: 'Bump' },
};

interface ReactionBarProps {
  counts: Record<ReactionType, number>;
  onReact: (type: ReactionType) => void;
}

// Architecture §4: the fixed reaction set — clap / fire / fist-bump — is
// the entire social vocabulary in a session. No chat input, ever.
export function ReactionBar({ counts, onReact }: ReactionBarProps) {
  return (
    <View style={styles.row}>
      {(Object.keys(REACTION_META) as ReactionType[]).map((type) => (
        <ReactionButton key={type} type={type} count={counts[type]} onPress={() => onReact(type)} />
      ))}
    </View>
  );
}

function ReactionButton({
  type,
  count,
  onPress,
}: {
  type: ReactionType;
  count: number;
  onPress: () => void;
}) {
  const meta = REACTION_META[type];
  const scale = useRef(new Animated.Value(1)).current;
  const [pops, setPops] = useState<number[]>([]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();

    const popId = Date.now();
    setPops((prev) => [...prev, popId]);
    setTimeout(() => setPops((prev) => prev.filter((id) => id !== popId)), 650);

    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.button} accessibilityLabel={meta.label}>
      <Animated.View style={[styles.bubble, { transform: [{ scale }] }]}>
        <Text style={styles.emoji}>{meta.emoji}</Text>
      </Animated.View>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.label}>{meta.label}</Text>
      {pops.map((id) => (
        <ReactionPop key={id} emoji={meta.emoji} />
      ))}
    </Pressable>
  );
}

function ReactionPop({ emoji }: { emoji: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const opacity = anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });

  return (
    <Animated.Text pointerEvents="none" style={[styles.pop, { opacity, transform: [{ translateY }] }]}>
      {emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    alignItems: 'center',
    gap: 3,
  },
  bubble: {
    width: 52,
    height: 52,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
  },
  count: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 2,
  },
  label: {
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
    color: colors.textSecondary,
  },
  pop: {
    position: 'absolute',
    top: -4,
    fontSize: 18,
  },
});
