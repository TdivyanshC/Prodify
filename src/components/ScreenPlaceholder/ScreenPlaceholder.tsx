import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import type { FeatherIconName } from '../icons/FeatherIconName';
import { colors, fonts, radii } from '../../theme';

interface ScreenPlaceholderProps {
  title: string;
  description: string;
  icon: FeatherIconName;
}

// Consistent stand-in for screens not yet built section-by-section, so
// navigation is fully functional ahead of each screen's real content.
export function ScreenPlaceholder({ title, description, icon }: ScreenPlaceholderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Feather name={icon} size={28} color={colors.primaryLight} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  description: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
