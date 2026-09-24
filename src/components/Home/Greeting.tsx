import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

interface GreetingProps {
  name: string;
}

function getGreetingWord(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Wireframe §2: personal but compact — no large hero section.
export function Greeting({ name }: GreetingProps) {
  const hour = new Date().getHours();
  return (
    <View style={styles.block}>
      <Text style={styles.greeting}>
        {getGreetingWord(hour)}, {name} 👋
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 2,
  },
  greeting: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
});
