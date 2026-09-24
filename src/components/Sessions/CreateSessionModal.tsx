import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mockSessionCategories } from '../../mocks/sessionCategories.mock';
import type { RootStackParamList } from '../../navigation/routes';
import { useCreateSessionModalStore } from '../../store/useCreateSessionModalStore';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, shadows } from '../../theme';

const DURATION_PRESETS = [25, 45, 60, 90];
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Architecture §1 §6: theme, name, duration, optional description,
// public/private, Create Session — reused by Home's "+ Create a Session"
// CTA, the Sessions page, and the mobile "Create" tab (all trigger the
// same shared modal via useCreateSessionModalStore).
//
// Built as a real bottom sheet, not RN's <Modal> — a spring bounce-in from
// off-screen and a quick ease-out slide-down on close, consistent with
// dropping <Modal> from Popup.tsx (same Android-rendering class of issue,
// same fix).
export function CreateSessionModal() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const visible = useCreateSessionModalStore((s) => s.visible);
  const presetCategoryId = useCreateSessionModalStore((s) => s.presetCategoryId);
  const close = useCreateSessionModalStore((s) => s.close);
  const createSession = useSessionStore((s) => s.createSession);
  const insets = useSafeAreaInsets();

  const [categoryId, setCategoryId] = useState(mockSessionCategories[0]._id);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMin, setDurationMin] = useState(45);
  const [isPublic, setIsPublic] = useState(true);

  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setCategoryId(presetCategoryId ?? mockSessionCategories[0]._id);
      setName('');
      setDescription('');
      setDurationMin(45);
      setIsPublic(true);
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

  const canSubmit = name.trim().length > 0;

  const handleCreate = () => {
    if (!canSubmit) return;
    const session = createSession({
      name: name.trim(),
      categoryId,
      durationMin,
      description: description.trim() || null,
      isPublic,
    });
    close();
    navigation.navigate('SessionRoom', { sessionId: session._id });
  };

  if (!mounted) return null;

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
            { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] },
          ]}
        >
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>Create a Session</Text>
            <Text style={styles.subheading}>Set the theme, name, duration and invite others.</Text>

            <Text style={styles.fieldLabel}>Theme</Text>
            <View style={styles.chipRow}>
              {mockSessionCategories.map((category) => (
                <Pressable
                  key={category._id}
                  onPress={() => setCategoryId(category._id)}
                  style={[styles.chip, categoryId === category._id && styles.chipActive]}
                >
                  <Text style={styles.chipEmoji}>{category.icon}</Text>
                  <Text
                    style={[styles.chipLabel, categoryId === category._id && styles.chipLabelActive]}
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
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Duration</Text>
            <View style={styles.chipRow}>
              {DURATION_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => setDurationMin(preset)}
                  style={[styles.chip, durationMin === preset && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, durationMin === preset && styles.chipLabelActive]}>
                    {preset} min
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Visibility</Text>
            <View style={styles.chipRow}>
              <Pressable onPress={() => setIsPublic(true)} style={[styles.chip, isPublic && styles.chipActive]}>
                <Text style={[styles.chipLabel, isPublic && styles.chipLabelActive]}>Public</Text>
              </Pressable>
              <Pressable
                onPress={() => setIsPublic(false)}
                style={[styles.chip, !isPublic && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, !isPublic && styles.chipLabelActive]}>Private</Text>
              </Pressable>
            </View>

            <View style={styles.actionsRow}>
              <Pressable onPress={close} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreate}
                disabled={!canSubmit}
                style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
              >
                <Text style={styles.primaryButtonLabel}>Create Session</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
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
  },
  sheet: {
    width: '100%',
    maxHeight: '86%',
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
  sheetContent: {
    width: '100%',
    padding: 20,
    paddingTop: 8,
    gap: 10,
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
    marginBottom: 6,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipEmoji: {
    fontSize: 13,
  },
  chipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipLabelActive: {
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
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
