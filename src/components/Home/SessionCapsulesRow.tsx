import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { SessionCapsule } from './SessionCapsule';

export interface SessionCapsuleEntry {
  id: string;
  icon: string;
  title: string;
  meta: string;
  isLive?: boolean;
  accentColor: string;
  actionLabel: string;
  onAction: () => void;
}

interface SessionCapsulesRowProps {
  entries: SessionCapsuleEntry[];
}

// Wireframe §5: 1-3 compact capsules — "YOUR SESSIONS" — not a discovery
// feed. Deliberately capped by the caller, not by this component, so the
// cap stays visible where the entries are built.
export function SessionCapsulesRow({ entries }: SessionCapsulesRowProps) {
  if (entries.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>YOUR SESSIONS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {entries.map((entry) => (
          <SessionCapsule
            key={entry.id}
            icon={entry.icon}
            title={entry.title}
            meta={entry.meta}
            isLive={entry.isLive}
            accentColor={entry.accentColor}
            actionLabel={entry.actionLabel}
            onAction={entry.onAction}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  row: {
    gap: 12,
    paddingRight: 4,
  },
});
