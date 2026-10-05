import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, gradients, radii } from '../../theme';
import type { NotificationAction } from '../../types/social';

interface NotificationActionsProps {
  actions: NotificationAction[];
  onAction: (action: NotificationAction) => void;
  compact?: boolean;
}

// A notification's buttons. The first is the main ask (teal gradient);
// the rest are quiet secondary pills. At most three ever render.
export function NotificationActions({ actions, onAction, compact }: NotificationActionsProps) {
  if (actions.length === 0) return null;

  return (
    <View style={styles.row}>
      {actions.slice(0, 3).map((action, i) =>
        i === 0 ? (
          <Pressable key={action.kind} onPress={() => onAction(action)} accessibilityRole="button" style={styles.wrap}>
            <LinearGradient colors={gradients.primary} style={[styles.button, compact && styles.buttonCompact]}>
              <Text style={styles.primaryLabel}>{action.label}</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            key={action.kind}
            onPress={() => onAction(action)}
            accessibilityRole="button"
            style={[styles.button, styles.secondary, compact && styles.buttonCompact]}
          >
            <Text style={styles.secondaryLabel}>{action.label}</Text>
          </Pressable>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wrap: {
    borderRadius: radii.button,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.button,
  },
  buttonCompact: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  primaryLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textPrimary,
  },
  secondaryLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
});
