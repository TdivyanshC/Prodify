import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SessionParticipant } from '../../types/models';
import { colors, fonts, radii } from '../../theme';

interface ParticipantListProps {
  participants: SessionParticipant[];
  currentUserId: string;
  // Whoever started the space — listed first and tagged, when present.
  hostId?: string | null;
  // Friends invited but not here yet — shown dimmed after everyone present.
  invited?: { userId: string; displayName: string; avatarInitial: string }[];
  // Renders a "+ Invite" control next to the heading when provided.
  onInvite?: () => void;
}

// Architecture §4: presence shown via avatars + a status pulse, no camera,
// no video tiles. The pulse just means "here and focused" — there's no
// richer presence signal to show yet in Phase 1.
export function ParticipantList({
  participants,
  currentUserId,
  hostId,
  invited = [],
  onInvite,
}: ParticipantListProps) {
  const ordered = [
    ...participants.filter((p) => p.userId === hostId),
    ...participants.filter((p) => p.userId !== hostId),
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>IN THIS SESSION · {participants.length}</Text>
        {onInvite ? (
          <Pressable onPress={onInvite} hitSlop={8} style={styles.inviteButton} accessibilityLabel="Invite friends">
            <Feather name="user-plus" size={13} color={colors.primaryLight} />
            <Text style={styles.inviteLabel}>Invite</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.grid}>
        {ordered.map((p) => (
          <ParticipantChip
            key={p.userId}
            participant={p}
            isSelf={p.userId === currentUserId}
            isHost={p.userId === hostId}
          />
        ))}
        {invited.map((p) => (
          <View key={p.userId} style={[styles.chip, styles.chipInvited]}>
            <View style={[styles.avatarCircle, styles.avatarCircleInvited]}>
              <Text style={styles.avatarInitial}>{p.avatarInitial}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {p.displayName.split(' ')[0]}
            </Text>
            <Text style={styles.invitedTag}>INVITED</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ParticipantChip({
  participant,
  isSelf,
  isHost,
}: {
  participant: SessionParticipant;
  isSelf: boolean;
  isHost: boolean;
}) {
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
        {isSelf ? 'You' : participant.displayName.split(' ')[0]}
      </Text>
      {isHost ? <Text style={styles.hostTag}>HOST</Text> : null}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.button,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inviteLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primaryLight,
  },
  chipInvited: {
    opacity: 0.55,
  },
  avatarCircleInvited: {
    backgroundColor: colors.surface,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  invitedTag: {
    marginTop: -3,
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  hostTag: {
    marginTop: -3,
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.primaryLight,
  },
});
