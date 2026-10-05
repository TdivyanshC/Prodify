import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusModeStore } from '../../store/useFocusModeStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { colors, fonts, radii } from '../../theme';
import { NotificationAvatar } from '../Notifications/NotificationAvatar';

const MAX_ROWS = 4;

interface WhileYouFocusedProps {
  onSeeAll: () => void;
}

// Everything that arrived during the session, held back by focus mode so
// nothing interrupted it — shown once, calmly, after. Renders nothing if
// the session was quiet.
export function WhileYouFocused({ onSeeAll }: WhileYouFocusedProps) {
  const heldIds = useFocusModeStore((s) => s.lastHeldIds);
  const notifications = useNotificationStore((s) => s.notifications);
  const held = notifications.filter((n) => heldIds.includes(n._id));
  if (held.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>WHILE YOU FOCUSED</Text>
      {held.slice(0, MAX_ROWS).map((n) => (
        <View key={n._id} style={styles.row}>
          <NotificationAvatar sender={n.sender} size={28} />
          <Text style={styles.title} numberOfLines={2}>
            {n.title}
          </Text>
        </View>
      ))}
      <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
        <Text style={styles.seeAll}>
          {held.length > MAX_ROWS ? `See all ${held.length}` : 'Open notifications'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 360,
    gap: 10,
    marginTop: 14,
    padding: 14,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  seeAll: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryLight,
  },
});
