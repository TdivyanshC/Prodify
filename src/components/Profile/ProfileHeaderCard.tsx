import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import type { User } from '../../types/models';
import { colors, fonts, gradients } from '../../theme';

interface ProfileHeaderCardProps {
  user: User;
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Profile's hero card — avatar, name, and a mascot-stage pill tying the
// gamification layer (mascotStage evolves with level, claude.md §5) into
// the one place a user actually looks at their own identity.
export function ProfileHeaderCard({ user }: ProfileHeaderCardProps) {
  return (
    <View style={styles.card}>
      <LinearGradient colors={gradients.wash} style={styles.wash} pointerEvents="none" />

      <View style={styles.avatarRing}>
        <LinearGradient colors={gradients.primary} style={styles.avatarGradient}>
          <Text style={styles.avatarInitial}>{user.displayName[0]}</Text>
        </LinearGradient>
      </View>

      <Text style={styles.name}>{user.displayName}</Text>
      <Text style={styles.memberSince}>Member since {formatMemberSince(user.createdAt)}</Text>

      <View style={styles.mascotPill}>
        <Text style={styles.mascotEmoji}>🔥</Text>
        <Text style={styles.mascotLabel}>Spark · Stage {user.mascotStage}</Text>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 76;

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  avatarRing: {
    width: AVATAR_SIZE + 8,
    height: AVATAR_SIZE + 8,
    borderRadius: (AVATAR_SIZE + 8) / 2,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGradient: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.headingBold,
    fontSize: 30,
    color: colors.textPrimary,
  },
  name: {
    fontFamily: fonts.headingBold,
    fontSize: 21,
    color: colors.textPrimary,
    marginTop: 14,
  },
  memberSince: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mascotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  mascotEmoji: {
    fontSize: 13,
  },
  mascotLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryLight,
  },
});
