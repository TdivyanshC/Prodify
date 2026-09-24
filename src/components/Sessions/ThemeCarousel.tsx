import { useRef } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SessionCategory } from '../../types/models';
import { colors, fonts, radii, shadows } from '../../theme';

interface ThemeCarouselProps {
  categories: SessionCategory[];
  selectedCategoryId: string | null;
  liveCounts: Record<string, number>;
  onSelect: (categoryId: string | null) => void;
}

const CARD_WIDTH = 136;

// Horizontal, swipeable theme picker — replaces the old wrapping pill
// grid. Bigger cards carry more: icon, name, and how many sessions are
// live right now in that theme, so picking a theme also previews activity
// instead of being a bare filter control.
export function ThemeCarousel({ categories, selectedCategoryId, liveCounts, onSelect }: ThemeCarouselProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>BROWSE BY THEME</Text>
      <FlatList
        data={categories}
        keyExtractor={(item) => item._id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 10}
        decelerationRate="fast"
        contentContainerStyle={styles.row}
        ListHeaderComponent={
          <ThemeCard
            icon="✨"
            name="All"
            count={Object.values(liveCounts).reduce((a, b) => a + b, 0)}
            active={selectedCategoryId === null}
            onPress={() => onSelect(null)}
          />
        }
        renderItem={({ item }) => (
          <ThemeCard
            icon={item.icon}
            name={item.name}
            count={liveCounts[item._id] ?? 0}
            active={item._id === selectedCategoryId}
            onPress={() => onSelect(item._id === selectedCategoryId ? null : item._id)}
          />
        )}
      />
    </View>
  );
}

function ThemeCard({
  icon,
  name,
  count,
  active,
  onPress,
}: {
  icon: string;
  name: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, friction: 8, tension: 220 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 160 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.card,
          active ? shadows.glow : shadows.card,
          active && styles.cardActive,
          { transform: [{ scale }] },
        ]}
      >
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
          {name}
        </Text>
        {count > 0 ? (
          <View style={styles.countRow}>
            <View style={styles.liveDot} />
            <Text style={styles.countText}>{count} live</Text>
          </View>
        ) : (
          <Text style={styles.countTextMuted}>quiet</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  row: {
    gap: 10,
    paddingRight: 4,
  },
  card: {
    width: CARD_WIDTH,
    height: 108,
    borderRadius: radii.cardSmall,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    justifyContent: 'space-between',
  },
  cardActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
  },
  icon: {
    fontSize: 24,
  },
  name: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  nameActive: {
    color: colors.textPrimary,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.error,
  },
  countText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  countTextMuted: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    color: colors.textMuted,
  },
});
