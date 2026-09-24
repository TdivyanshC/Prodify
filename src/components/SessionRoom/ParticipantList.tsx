import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { SessionParticipant } from '../../types/models';
import { colors, fonts } from '../../theme';

interface ParticipantListProps {
  participants: SessionParticipant[];
  currentUserId: string;
}

// Architecture §4: presence shown via avatars + a status pulse, no camera,
// no video tiles. The pulse just means "here and focused" — there's no
// richer presence signal to show yet in Phase 1.
export function ParticipantList({ participants, currentUserId }: ParticipantListProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>IN THIS SESSION · {participants.length}</Text>
      <View style={styles.grid}>
        {participants.map((p) => (
          <ParticipantChip key={p.userId} participant={p} isSelf={p.userId === currentUserId} />
        ))}
      </View>
    </View>
  );
}

function ParticipantChip({ participant, isSelf }: { participant: SessionParticipant; isSelf: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={styles.chip}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{participant.avatarInitial}</Text>
        </View>
        <View style={styles.pulseDotWrap}>
          <Animated.View
            style={[styles.pulseRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
          />
          <View style={styles.pulseDot} />
        </View>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {isSelf ? 'You' : participant.displayName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  chip: {
    alignItems: 'center',
    width: 56,
    gap: 6,
  },
  avatarWrap: {
    width: 48,
    height: 48,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryDeep,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  pulseDotWrap: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
  },
  name: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
