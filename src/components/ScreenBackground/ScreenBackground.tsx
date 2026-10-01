import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { ChatWallpaper } from '../ChatWallpaper/ChatWallpaper';
import { ACTIVE_THEME, colors, palettes } from '../../theme';

// Shared full-screen backdrop, extracted from what was originally
// Home-only: the wallpaper texture (opt-in per palette via hasWallpaper)
// plus a top-down gradient wash. Every screen renders this as the first
// child inside its SafeAreaView so the whole app shares one background
// instead of only Home having it.
export function ScreenBackground() {
  return (
    <>
      {palettes[ACTIVE_THEME].hasWallpaper ? <ChatWallpaper /> : null}
      <LinearGradient
        colors={[colors.primaryDeep + '2E', colors.background]}
        style={styles.backdrop}
        pointerEvents="none"
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
});
