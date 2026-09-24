import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, shadows } from '../../theme';
import { useCountUp } from '../../utils/useCountUp';

interface StatTileProps {
  emoji: string;
  value: number;
  label: string;
  // Gold is reserved for streak/XP/achievements (claude.md §3a discipline
  // rule) — tiles for those metrics pass accent=true, everything else
  // stays neutral so gold doesn't dilute across the whole grid.
  accent?: boolean;
  suffix?: string;
}

export function StatTile({ emoji, value, label, accent, suffix }: StatTileProps) {
  const counted = useCountUp(value);

  return (
    <View style={[styles.tile, shadows.card]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.value, accent && styles.valueAccent]}>
        {counted}
        {suffix ?? ''}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '47%',
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 2,
  },
  emoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  value: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    color: colors.textPrimary,
  },
  valueAccent: {
    color: colors.accentGold,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
});
