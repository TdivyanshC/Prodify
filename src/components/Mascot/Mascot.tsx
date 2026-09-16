import LottieView from 'lottie-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMascotStore } from '../../store/useMascotStore';

const mascotPlaceholderLottie = require('../../assets/lottie/mascot-placeholder.json');

// Inline mascot presence for the Home screen: placeholder Lottie + whatever
// message the mock priority logic (mascotService, claude.md §4) currently
// returns. Distinct from Popup — this renders in-flow, not as a modal.
export function Mascot() {
  const { message, isLoading, refresh } = useMascotStore();

  useEffect(() => {
    if (!message) {
      refresh();
    }
  }, [message, refresh]);

  return (
    <View style={styles.container}>
      <LottieView source={mascotPlaceholderLottie} autoPlay loop style={styles.lottie} />
      <View style={styles.bubble}>
        {isLoading && !message ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.message}>{message?.quote}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  lottie: {
    width: 200,
    height: 200,
  },
  bubble: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 8,
    maxWidth: 300,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1c1c1e',
    textAlign: 'center',
  },
});
