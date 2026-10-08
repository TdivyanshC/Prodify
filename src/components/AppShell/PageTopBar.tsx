import Feather from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { Header } from './Header';

interface PageTopBarProps {
  title: string;
  // Pushed on the root stack (mobile, from Profile) → back arrow. A
  // sidebar route (desktop) → the shared Header like every other tab.
  stacked: boolean;
  avatarInitial?: string;
}

// Same back-bar treatment as Friend Profile, so drill-down pages read as
// one family on mobile while staying regular sidebar pages on desktop.
export function PageTopBar({ title, stacked, avatarInitial }: PageTopBarProps) {
  const navigation = useNavigation();
  if (!stacked) return <Header title={title} avatarInitial={avatarInitial} />;
  return (
    <View style={styles.topBar}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backButton} accessibilityLabel="Back">
        <Feather name="arrow-left" size={19} color={colors.textSecondary} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.backButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
