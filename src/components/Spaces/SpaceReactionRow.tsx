import * as Haptics from 'expo-haptics';
import { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReactionStore } from '../../store/useReactionStore';
import type { Reaction } from '../../types/models';
import { colors, fonts } from '../../theme';
import { REACTION_META, type ReactionType } from '../SessionRoom/ReactionBar';

interface SpaceReactionRowProps {
  sessionId: string;
  toUserId: string;
  toFirstName: string;
}

// Cheer a friend's space on without joining it — same fixed reaction set
// as the room's ReactionBar, sized down to fit on a card.
export function SpaceReactionRow({ sessionId, toUserId, toFirstName }: SpaceReactionRowProps) {
  // Select the raw list and derive here — a selector that builds a new
  // array every call makes zustand v5 re-render in a loop.
  const reactions = useReactionStore((s) => s.reactions);
  const sent = useMemo(
    () => reactions.filter((r) => r.contextId === sessionId && r.toUserId === toUserId).map((r) => r.type),
    [reactions, sessionId, toUserId]
  );
  const toggleReaction = useReactionStore((s) => s.toggleReaction);

  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>
        {sent.length > 0 ? `${toFirstName} will see your cheer` : `Cheer ${toFirstName} on`}
      </Text>
      <View style={styles.buttons}>
        {(Object.keys(REACTION_META) as ReactionType[]).map((type) => (
          <ReactionToggle
            key={type}
            type={type}
            active={sent.includes(type)}
            onPress={() => toggleReaction(sessionId, toUserId, type as Reaction['type'])}
          />
        ))}
      </View>
    </View>
  );
}

function ReactionToggle({ type, active, onPress }: { type: ReactionType; active: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const meta = REACTION_META[type];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scale, { toValue: active ? 0.85 : 1.25, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${meta.label}${active ? ' (sent)' : ''}`}
    >
      <Animated.View style={[styles.bubble, active && styles.bubbleActive, { transform: [{ scale }] }]}>
        <Text style={styles.emoji}>{meta.emoji}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  bubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  emoji: {
    fontSize: 16,
  },
});
