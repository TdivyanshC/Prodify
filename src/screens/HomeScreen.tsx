import { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { Mascot } from '../components/Mascot/Mascot';
import { StreakIndicator } from '../components/StreakIndicator/StreakIndicator';
import { useUserStore } from '../store/useUserStore';

export function HomeScreen() {
  const { user, isLoading, refresh } = useUserStore();

  useEffect(() => {
    if (!user) {
      refresh();
    }
  }, [user, refresh]);

  return (
    <SafeAreaView style={styles.container}>
      <Mascot />
      {user ? <StreakIndicator streak={user.streak} /> : isLoading ? <ActivityIndicator /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdf6ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
