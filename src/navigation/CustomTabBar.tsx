import Feather from '@expo/vector-icons/Feather';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FeatherIconName } from '../components/icons/FeatherIconName';
import { colors, fonts, gradients, radii, shadows } from '../theme';

const TAB_META: Record<string, { icon: FeatherIconName; label: string }> = {
  Home: { icon: 'home', label: 'Home' },
  Sessions: { icon: 'compass', label: 'Sessions' },
  Friends: { icon: 'users', label: 'Friends' },
  Profile: { icon: 'user', label: 'Profile' },
};

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// The "Create" tab is a levitating action button, not a flat icon in the
// row — it should read as *the* thing you'd reach for, floating above the
// bar rather than sitting inside it (product brief: "center tab shuld be
// hover tab leviating from the tab bar that looks and stands out").
function CenterTabButton({ focused, onPress }: { focused: boolean; onPress: () => void }) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.04] });

  return (
    <View style={styles.centerSlot} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Create a session"
        hitSlop={10}
        style={styles.centerButtonWrap}
      >
        <AnimatedLinearGradient
          colors={gradients.primary}
          style={[styles.centerGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.centerButton, focused && styles.centerButtonFocused]}
        >
          <Feather name="plus" size={26} color={colors.textPrimary} />
        </LinearGradient>
      </Pressable>
      <Text style={styles.centerLabel}>Create</Text>
    </View>
  );
}

function TabItem({
  onPress,
  isFocused,
  label,
  icon,
  iconColor,
}: {
  onPress: () => void;
  isFocused: boolean;
  label: string;
  icon: FeatherIconName | undefined;
  iconColor: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, friction: 8, tension: 260 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 200 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
      style={styles.tabItem}
    >
      <Animated.View style={[styles.iconChip, isFocused && styles.iconChipFocused, { transform: [{ scale }] }]}>
        {icon ? <Feather name={icon} size={19} color={iconColor} /> : null}
      </Animated.View>
      <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// Custom tab bar (architecture §1/§10, §3a): a floating pill rather than an
// edge-to-edge bar, so it reads as a deliberate piece of UI rather than a
// default nav chrome — with the Create tab elevated above it as the one
// element that's allowed to break the grid.
export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (route.name === 'CreateAction') {
            return <CenterTabButton key={route.key} focused={isFocused} onPress={onPress} />;
          }

          const meta = TAB_META[route.name];
          const label = typeof options.title === 'string' ? options.title : meta?.label ?? route.name;
          const iconColor = isFocused ? colors.primaryLight : colors.textSecondary;

          return (
            <TabItem
              key={route.key}
              onPress={onPress}
              isFocused={isFocused}
              label={label}
              icon={meta?.icon}
              iconColor={iconColor}
            />
          );
        })}
      </View>
    </View>
  );
}

const BAR_HEIGHT = 66;
const CENTER_SIZE = 58;

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    backgroundColor: colors.background,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    borderRadius: radii.card + 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconChip: {
    width: 34,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipFocused: {
    backgroundColor: colors.primarySoft,
  },
  tabLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  tabLabelFocused: {
    fontFamily: fonts.bodySemiBold,
    color: colors.primaryLight,
  },
  centerSlot: {
    width: 72,
    alignItems: 'center',
  },
  centerButtonWrap: {
    marginTop: -(CENTER_SIZE / 2 + 12),
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerGlow: {
    position: 'absolute',
    width: CENTER_SIZE + 18,
    height: CENTER_SIZE + 18,
    borderRadius: (CENTER_SIZE + 18) / 2,
  },
  centerButton: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.background,
    shadowColor: colors.primaryDeep,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  centerButtonFocused: {
    borderColor: colors.background,
  },
  centerLabel: {
    marginTop: 2,
    fontFamily: fonts.bodySemiBold,
    fontSize: 10.5,
    color: colors.primaryLight,
  },
});
