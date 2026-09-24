import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors } from '../../theme';

// WhatsApp-style tiled "doodle" wallpaper: a dense, varied scatter of
// low-opacity glyphs behind screen content — matching WhatsApp's actual
// wallpaper (many distinct whimsical doodles, not a handful of UI icons
// repeating in an obvious grid). Purely a texture layer — pointerEvents
// disabled, rendered behind the screen's real content, opts in per-palette
// via `hasWallpaper` (see palettes.ts) rather than being global.
type IconEntry = { Icon: typeof Ionicons; name: keyof typeof Ionicons.glyphMap } | {
  Icon: typeof MaterialCommunityIcons;
  name: keyof typeof MaterialCommunityIcons.glyphMap;
};

const ICONS: IconEntry[] = [
  { Icon: Ionicons, name: 'chatbubble-outline' },
  { Icon: Ionicons, name: 'call-outline' },
  { Icon: Ionicons, name: 'videocam-outline' },
  { Icon: Ionicons, name: 'mic-outline' },
  { Icon: Ionicons, name: 'paper-plane-outline' },
  { Icon: Ionicons, name: 'happy-outline' },
  { Icon: MaterialCommunityIcons, name: 'camera-outline' },
  { Icon: MaterialCommunityIcons, name: 'flower-outline' },
  { Icon: MaterialCommunityIcons, name: 'guitar-acoustic' },
  { Icon: MaterialCommunityIcons, name: 'glass-cocktail' },
  { Icon: MaterialCommunityIcons, name: 'dice-5' },
  { Icon: MaterialCommunityIcons, name: 'gift-outline' },
  { Icon: MaterialCommunityIcons, name: 'palm-tree' },
  { Icon: MaterialCommunityIcons, name: 'anchor' },
  { Icon: MaterialCommunityIcons, name: 'basketball' },
  { Icon: MaterialCommunityIcons, name: 'bicycle' },
  { Icon: MaterialCommunityIcons, name: 'candle' },
  { Icon: MaterialCommunityIcons, name: 'balloon' },
  { Icon: MaterialCommunityIcons, name: 'umbrella-outline' },
  { Icon: MaterialCommunityIcons, name: 'star-four-points-outline' },
  { Icon: MaterialCommunityIcons, name: 'cupcake' },
  { Icon: MaterialCommunityIcons, name: 'weather-sunny' },
  { Icon: MaterialCommunityIcons, name: 'leaf' },
  { Icon: MaterialCommunityIcons, name: 'headphones' },
  { Icon: MaterialCommunityIcons, name: 'music-note-outline' },
  { Icon: MaterialCommunityIcons, name: 'airplane' },
  { Icon: MaterialCommunityIcons, name: 'coffee-outline' },
  { Icon: MaterialCommunityIcons, name: 'ice-cream' },
  { Icon: MaterialCommunityIcons, name: 'compass-outline' },
  { Icon: MaterialCommunityIcons, name: 'heart-outline' },
];

const CELL = 56;
const BASE_SIZE = 20;
const OPACITY = 0.09;

// Deterministic "shuffle" so neighboring cells don't cycle in an obvious
// repeating diagonal — real wallpaper tiles read as scattered, not gridded.
function pseudoRandom(row: number, col: number, mod: number) {
  return (row * 31 + col * 17 + row * col * 7) % mod;
}

export function ChatWallpaper() {
  const { width, height } = useWindowDimensions();
  const cols = Math.ceil(width / CELL) + 1;
  const rows = Math.ceil(height / CELL) + 1;

  const cells = [];
  for (let row = 0; row < rows; row++) {
    const rowOffset = row % 2 === 0 ? 0 : CELL / 2;
    for (let col = 0; col < cols; col++) {
      const entry = ICONS[pseudoRandom(row, col, ICONS.length)];
      const size = BASE_SIZE + pseudoRandom(row, col, 3) * 3;
      const { Icon, name } = entry;
      cells.push(
        <Icon
          key={`${row}-${col}`}
          // @ts-expect-error name is narrowed per-entry above, union confuses inference here
          name={name}
          size={size}
          color={colors.textPrimary}
          style={{
            position: 'absolute',
            left: col * CELL + rowOffset,
            top: row * CELL,
            opacity: OPACITY,
          }}
        />
      );
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cells}
    </View>
  );
}
