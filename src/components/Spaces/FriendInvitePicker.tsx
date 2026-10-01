import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FriendProfile } from '../../types/social';
import { colors, fonts, radii } from '../../theme';

interface FriendInvitePickerProps {
  friends: FriendProfile[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
}

// Multi-select list of accepted friends for inviting into a space. Online
// friends sort first — they're the ones who can actually join right now.
export function FriendInvitePicker({ friends, selectedIds, onToggle }: FriendInvitePickerProps) {
  const ordered = [...friends].sort((a, b) => Number(b.isOnline) - Number(a.isOnline));

  if (ordered.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          No friends to invite yet. Add some from the Friends tab — you can still start this space on your own.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {ordered.map((friend) => {
        const selected = selectedIds.includes(friend._id);
        return (
          <Pressable
            key={friend._id}
            onPress={() => onToggle(friend._id)}
            style={[styles.row, selected && styles.rowSelected]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`Invite ${friend.displayName}`}
          >
            <View style={[styles.avatarRing, friend.isOnline && styles.avatarRingOnline]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{friend.avatarInitial}</Text>
              </View>
            </View>
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {friend.displayName}
              </Text>
              <Text style={[styles.status, friend.isOnline && styles.statusOnline]}>
                {friend.isOnline ? 'Online now' : 'Offline — will see it later'}
              </Text>
            </View>
            <View style={[styles.check, selected && styles.checkSelected]}>
              {selected ? <Feather name="check" size={14} color={colors.textPrimary} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  avatarRing: {
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingOnline: {
    borderColor: colors.success,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  status: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusOnline: {
    color: colors.success,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  empty: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: radii.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
