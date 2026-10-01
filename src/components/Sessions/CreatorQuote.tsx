import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../theme';

const DEFAULT_QUOTE =
  "Consistency isn't glamorous. It's just showing up — one focused session at a time.";

interface CreatorQuoteProps {
  quote?: string;
}

export function CreatorQuote({ quote = DEFAULT_QUOTE }: CreatorQuoteProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.mark}>"</Text>
      <Text style={styles.quote}>{quote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  mark: {
    fontFamily: fonts.headingBold,
    fontSize: 32,
    lineHeight: 32,
    color: colors.accentGold,
    marginBottom: 2,
  },
  quote: {
    fontFamily: fonts.bodyMedium,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
