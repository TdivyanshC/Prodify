import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, gradients, radii, shadows } from '../../theme';
import type { FriendProfile } from '../../types/social';
import { FriendInvitePicker } from '../Spaces/FriendInvitePicker';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface InviteFriendsSheetProps {
  visible: boolean;
  // Already filtered to friends who aren't here and weren't invited yet.
  friends: FriendProfile[];
  onClose: () => void;
  onSend: (userIds: string[]) => void;
}

// Bottom sheet for inviting more friends into a space that's already
// running. Same picker as the Create flow's invite step, same sheet
// motion as Popup/CreateSessionModal (spring up, ease-out down) — rendered
// inside Session Room, which is itself a full-screen modal route.
export function InviteFriendsSheet({ visible, friends, onClose, onSend }: InviteFriendsSheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedIds([]);
      setMounted(true);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 65 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const count = selectedIds.length;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>

      <View style={styles.sheetOuter} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            shadows.card,
            { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.heading}>Invite friends</Text>
          <Text style={styles.subheading}>They'll get an invite to join you right now.</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {friends.length === 0 ? (
              <Text style={styles.emptyText}>Every friend is already here or has an invite. Nice crew.</Text>
            ) : (
              <FriendInvitePicker
                friends={friends}
                selectedIds={selectedIds}
                onToggle={(id) =>
                  setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
              />
            )}
          </ScrollView>

          <Pressable
            onPress={() => count > 0 && onSend(selectedIds)}
            disabled={count === 0}
            style={[styles.sendWrap, count === 0 && styles.sendDisabled]}
          >
            <LinearGradient colors={gradients.primary} style={styles.sendButton}>
              <Text style={styles.sendLabel}>
                {count === 0 ? 'Pick friends to invite' : `Send ${count} ${count === 1 ? 'invite' : 'invites'}`}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  sheetOuter: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 20,
    gap: 6,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 8,
  },
  heading: {
    fontFamily: fonts.headingBold,
    fontSize: 19,
    color: colors.textPrimary,
  },
  subheading: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  list: {
    marginTop: 8,
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  sendWrap: {
    borderRadius: radii.card,
    marginTop: 8,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radii.card,
  },
  sendLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
