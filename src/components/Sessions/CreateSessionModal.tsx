import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCatalogStore } from '../../store/useCatalogStore';
import type { RootStackParamList } from '../../navigation/routes';
import { useCreateSessionModalStore } from '../../store/useCreateSessionModalStore';
import { useFriendsStore } from '../../store/useFriendsStore';
import { usePopupStore } from '../../store/usePopupStore';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, gradients, radii, shadows } from '../../theme';
import type { FriendProfile } from '../../types/social';
import { getFriendProfile, getOtherUserId } from '../../utils/friendHelpers';
import { FriendInvitePicker } from '../Spaces/FriendInvitePicker';
import { TimeWheelPicker } from './TimeWheelPicker';

const STEP_COUNT = 4;
const STEP_PANEL_HEIGHT = 430;
const THEME_GRID_GAP = 10;
// Above this, the sheet stops stretching edge-to-edge and floats as a
// centered card instead — claude.md §3b: desktop adapts the layout, it
// doesn't just stretch the mobile design.
const SHEET_MAX_WIDTH = 480;

// Spaces visibility (claude.md §4 / phase2 `spaces.isPublic`): friends-only
// spaces show up only on friends' Spaces tabs; public ones also land in
// everyone's "Open to everyone" browse list.
const VISIBILITY_OPTIONS = [
  { isPublic: false, emoji: '🔒', label: 'Friends only', hint: 'Only your friends can see and join' },
  { isPublic: true, emoji: '🌍', label: 'Public', hint: 'Anyone can find it and join' },
];

// Architecture §1 §6: theme, name, icon, duration, visibility, Create
// Session — reused by Home's "+ Create a Session" CTA, the Sessions page's
// top-corner "+", and the mobile "Create" tab (all trigger the same shared
// modal via useCreateSessionModalStore).
//
// A 4-step wizard rather than one long form: name + icon avatar, then a
// scroll-wheel duration picker with haptic ticks, then an optional
// invite-friends step, then a review + create step (when, who can join) —
// each screen asks for one thing at a time instead of a scrolling wall of
// fields. Picking a later start time schedules the space instead of
// dropping the user straight into its room.
//
// Built as a real bottom sheet, not RN's <Modal> — a spring bounce-in from
// off-screen and a quick ease-out slide-down on close, consistent with
// dropping <Modal> from Popup.tsx (same Android-rendering class of issue,
// same fix).
export function CreateSessionModal() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const visible = useCreateSessionModalStore((s) => s.visible);
  const preset = useCreateSessionModalStore((s) => s.preset);
  const close = useCreateSessionModalStore((s) => s.close);
  const createSession = useSessionStore((s) => s.createSession);
  const categories = useCatalogStore((s) => s.categories);
  const defaultCategoryId = categories[0]?._id ?? 'cat_study';
  const [creating, setCreating] = useState(false);
  const friendships = useFriendsStore((s) => s.friendships);
  const refreshFriends = useFriendsStore((s) => s.refresh);
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const sheetWidth = Math.min(windowWidth, SHEET_MAX_WIDTH);
  // Two equal-width columns spanning the full step-content area (padding
  // 20 each side, THEME_GRID_GAP between columns) — computed rather than
  // percentage-based so the pair sits flush with both edges exactly.
  const themeCardWidth = (sheetWidth - 40 - THEME_GRID_GAP) / 2;

  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [name, setName] = useState('');
  const [durationMin, setDurationMin] = useState(45);
  const [isPublic, setIsPublic] = useState(true);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  // null = start right now; otherwise an ISO time from startSlots.
  const [startSlot, setStartSlot] = useState<string | null>(null);
  const [startSlots, setStartSlots] = useState<string[]>([]);

  // Only accepted friends can be invited (claude.md §4: mutual accept).
  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => getFriendProfile(getOtherUserId(f)))
    .filter((p): p is FriendProfile => Boolean(p));
  const invitedFriends = friends.filter((f) => invitedIds.includes(f._id));

  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const stepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep(0);
      setCategoryId(preset?.categoryId ?? defaultCategoryId);
      setName(preset?.name ?? '');
      setDurationMin(preset?.durationMin ?? 45);
      setIsPublic(true);
      setInvitedIds([]);
      setStartSlot(null);
      setStartSlots(getUpcomingStartSlots());
      setMounted(true);
      if (friendships.length === 0) void refreshFriends().catch(() => undefined);

      stepAnim.setValue(0);
      translateY.setValue(windowHeight);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 65 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: windowHeight,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const canSubmitStep1 = name.trim().length > 0;

  const goToStep = (next: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(next);
    Animated.spring(stepAnim, { toValue: next, useNativeDriver: true, friction: 11, tension: 90 }).start();
  };

  // Invitees go up with the create call — the server sends the invites.
  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    let session;
    try {
      session = await createSession({
        name: name.trim(),
        categoryId,
        durationMin,
        description: null,
        isPublic,
        invitedUserIds: invitedIds,
        startTime: startSlot ?? undefined,
      });
    } catch (err) {
      const { showPopup, hidePopup } = usePopupStore.getState();
      showPopup({ title: 'Couldn’t create the space', message: (err as Error).message, actions: [{ label: 'OK', onPress: hidePopup }] });
      return;
    } finally {
      setCreating(false);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();

    if (session.status === 'scheduled') {
      const { showPopup, hidePopup } = usePopupStore.getState();
      showPopup({
        title: 'Space scheduled 🗓️',
        message: `“${session.name}” is set for ${formatClockTime(session.startTime)}. It's under Coming up in Spaces, and we'll nudge you when it's time.${
          invitedIds.length > 0 ? ' Your invited friends can see it too.' : ''
        }`,
        actions: [{ label: 'Got it', onPress: hidePopup }],
      });
      return;
    }
    navigation.navigate('SessionRoom', { sessionId: session._id });
  };

  if (!mounted) return null;

  const selectedCategory = categories.find((c) => c._id === categoryId);
  const endTimeLabel = formatEndTime(durationMin);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetOuter}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            shadows.card,
            { width: sheetWidth, paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            {step > 0 ? (
              <Pressable
                onPress={() => goToStep(step - 1)}
                hitSlop={10}
                style={styles.headerIconButton}
                accessibilityLabel="Back"
              >
                <Feather name="chevron-left" size={18} color={colors.textSecondary} />
              </Pressable>
            ) : (
              <View style={styles.headerIconButton} />
            )}

            <View style={styles.dotsRow}>
              {Array.from({ length: STEP_COUNT }).map((_, i) => (
                <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
              ))}
            </View>

            <Pressable onPress={close} hitSlop={10} style={styles.headerIconButton} accessibilityLabel="Close">
              <Feather name="x" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.viewport}>
            <Animated.View
              style={[
                styles.stepsRow,
                {
                  width: sheetWidth * STEP_COUNT,
                  transform: [
                    {
                      translateX: stepAnim.interpolate({
                        inputRange: [0, 1, 2, 3],
                        outputRange: [0, -sheetWidth, -sheetWidth * 2, -sheetWidth * 3],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* Step 1 — name + icon avatar + theme */}
              <View style={{ width: sheetWidth }}>
                <ScrollView
                  style={styles.stepScroll}
                  contentContainerStyle={styles.stepContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.heading}>Choose your session</Text>
                  <Text style={styles.subheading}>Pick a theme, then give it a name.</Text>

                  <Text style={styles.fieldLabel}>Sessions</Text>
                  <View style={styles.themeGrid}>
                    {categories.map((category) => (
                      <Pressable
                        key={category._id}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setCategoryId(category._id);
                        }}
                        style={[
                          styles.themeCard,
                          { width: themeCardWidth },
                          categoryId === category._id && styles.themeCardActive,
                        ]}
                      >
                        <Text style={styles.themeCardEmoji}>{category.icon}</Text>
                        <Text
                          style={[styles.themeCardLabel, categoryId === category._id && styles.themeCardLabelActive]}
                          numberOfLines={2}
                        >
                          {category.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Session name, e.g. Silent Study"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />
                </ScrollView>
              </View>

              {/* Step 2 — duration wheel */}
              <View style={{ width: sheetWidth }}>
                <ScrollView
                  style={styles.stepScroll}
                  contentContainerStyle={styles.stepContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.heading}>How long?</Text>
                  <Text style={styles.subheading}>Scroll to set your session length, in 5-minute steps.</Text>

                  <View style={styles.durationDisplay}>
                    <Text style={styles.durationValue}>
                      {durationMin >= 60
                        ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}m` : ''}`
                        : `${durationMin} min`}
                    </Text>
                    <Text style={styles.durationSub}>Ends around {endTimeLabel}</Text>
                  </View>

                  <TimeWheelPicker
                    minMinutes={5}
                    maxMinutes={180}
                    stepMinutes={5}
                    value={durationMin}
                    onChange={setDurationMin}
                  />
                </ScrollView>
              </View>

              {/* Step 3 — invite friends (optional) */}
              <View style={{ width: sheetWidth }}>
                <ScrollView
                  style={styles.stepScroll}
                  contentContainerStyle={styles.stepContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.heading}>Bring friends along</Text>
                  <Text style={styles.subheading}>
                    They'll get an invite the moment you start. You can skip this and go solo.
                  </Text>

                  <FriendInvitePicker
                    friends={friends}
                    selectedIds={invitedIds}
                    onToggle={(userId) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setInvitedIds((prev) =>
                        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
                      );
                    }}
                  />
                </ScrollView>
              </View>

              {/* Step 4 — review + create */}
              <View style={{ width: sheetWidth }}>
                <ScrollView
                  style={styles.stepScroll}
                  contentContainerStyle={styles.stepContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.heading}>Ready to go</Text>
                  <Text style={styles.subheading}>Double-check the details, then create your session.</Text>

                  <View style={styles.reviewCard}>
                    <View style={styles.reviewIconCircle}>
                      <Text style={styles.reviewIconEmoji}>{selectedCategory?.icon}</Text>
                    </View>
                    <Text style={styles.reviewName} numberOfLines={2}>
                      {name.trim() || 'Untitled session'}
                    </Text>
                    <View style={styles.reviewMetaRow}>
                      <View style={styles.reviewMetaChip}>
                        <Text style={styles.reviewMetaText}>
                          {selectedCategory?.icon} {selectedCategory?.name}
                        </Text>
                      </View>
                      <View style={styles.reviewMetaChip}>
                        <Text style={styles.reviewMetaText}>⏱ {durationMin} min</Text>
                      </View>
                    </View>
                    {invitedFriends.length > 0 ? (
                      <Text style={styles.reviewInvited} numberOfLines={2}>
                        Inviting {invitedFriends.map((f) => f.displayName.split(' ')[0]).join(', ')}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={styles.fieldLabel}>When?</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotRow}>
                    {[null, ...startSlots].map((slot) => {
                      const active = slot === startSlot;
                      return (
                        <Pressable
                          key={slot ?? 'now'}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setStartSlot(slot);
                          }}
                          style={[styles.slotChip, active && styles.slotChipActive]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={[styles.slotLabel, active && styles.slotLabelActive]}>
                            {slot ? formatClockTime(slot) : 'Now'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Text style={styles.fieldLabel}>Who can join?</Text>
                  <View style={styles.visibilityRow}>
                    {VISIBILITY_OPTIONS.map((option) => {
                      const active = option.isPublic === isPublic;
                      return (
                        <Pressable
                          key={option.label}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setIsPublic(option.isPublic);
                          }}
                          style={[styles.visibilityOption, active && styles.visibilityOptionActive]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={styles.visibilityEmoji}>{option.emoji}</Text>
                          <Text style={[styles.visibilityLabel, active && styles.visibilityLabelActive]}>
                            {option.label}
                          </Text>
                          <Text style={styles.visibilityHint}>{option.hint}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </Animated.View>
          </View>

          <View style={styles.footer}>
            {step === 0 ? (
              <Pressable
                onPress={() => canSubmitStep1 && goToStep(1)}
                disabled={!canSubmitStep1}
                style={[styles.primaryButtonWrap, !canSubmitStep1 && styles.primaryButtonDisabled]}
              >
                <LinearGradient colors={gradients.primary} style={styles.primaryButton}>
                  <LinearGradient colors={[colors.sheen, 'transparent']} style={styles.primaryButtonSheen} pointerEvents="none" />
                  <Text style={styles.primaryButtonLabel}>Continue</Text>
                </LinearGradient>
              </Pressable>
            ) : step === 1 || step === 2 ? (
              <Pressable onPress={() => goToStep(step + 1)} style={styles.primaryButtonWrap}>
                <LinearGradient colors={gradients.primary} style={styles.primaryButton}>
                  <LinearGradient colors={[colors.sheen, 'transparent']} style={styles.primaryButtonSheen} pointerEvents="none" />
                  <Text style={styles.primaryButtonLabel}>
                    {step === 1
                      ? 'Continue'
                      : invitedIds.length === 0
                        ? 'Skip for now'
                        : `Invite ${invitedIds.length} ${invitedIds.length === 1 ? 'friend' : 'friends'}`}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable onPress={handleCreate} style={styles.primaryButtonWrap}>
                <LinearGradient colors={gradients.primary} style={styles.primaryButton}>
                  <LinearGradient colors={[colors.sheen, 'transparent']} style={styles.primaryButtonSheen} pointerEvents="none" />
                  <Text style={styles.primaryButtonLabel}>
                    {startSlot ? `Schedule for ${formatClockTime(startSlot)}` : 'Create Session'}
                  </Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const SLOT_COUNT = 8;
const SLOT_MIN_LEAD_MIN = 10;

// The next few half-hour marks, skipping any closer than 10 minutes (too
// soon to be worth scheduling — that's "Now").
function getUpcomingStartSlots(): string[] {
  const slot = new Date(Date.now() + SLOT_MIN_LEAD_MIN * 60000);
  slot.setSeconds(0, 0);
  slot.setMinutes(slot.getMinutes() <= 30 ? 30 : 60);
  return Array.from({ length: SLOT_COUNT }, (_, i) => new Date(slot.getTime() + i * 30 * 60000).toISOString());
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatEndTime(durationMin: number): string {
  const end = new Date(Date.now() + durationMin * 60000);
  return end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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
    maxHeight: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.primary,
  },
  viewport: {
    width: '100%',
    height: STEP_PANEL_HEIGHT,
    overflow: 'hidden',
  },
  stepsRow: {
    flexDirection: 'row',
    height: STEP_PANEL_HEIGHT,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    padding: 20,
    paddingTop: 12,
    gap: 12,
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
    marginBottom: 4,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME_GRID_GAP,
  },
  themeCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: radii.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  themeCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themeCardEmoji: {
    fontSize: 20,
  },
  themeCardLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  themeCardLabelActive: {
    color: colors.textPrimary,
  },
  input: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  durationDisplay: {
    alignItems: 'center',
    gap: 2,
    marginBottom: 2,
  },
  durationValue: {
    fontFamily: fonts.headingBold,
    fontSize: 32,
    color: colors.textPrimary,
  },
  durationSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  reviewCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  reviewIconEmoji: {
    fontSize: 30,
  },
  reviewName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  reviewMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  reviewMetaChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  slotRow: {
    gap: 8,
  },
  slotChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  slotChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  slotLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  slotLabelActive: {
    color: colors.textPrimary,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  visibilityOption: {
    flex: 1,
    gap: 3,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  visibilityOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  visibilityEmoji: {
    fontSize: 18,
  },
  visibilityLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  visibilityLabelActive: {
    color: colors.textPrimary,
  },
  visibilityHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  reviewInvited: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.primaryLight,
    textAlign: 'center',
  },
  reviewMetaText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  footer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  primaryButtonWrap: {
    borderRadius: radii.card,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: radii.card,
    alignItems: 'center',
    overflow: 'hidden',
  },
  primaryButtonSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
  },
  primaryButtonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
