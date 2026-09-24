// Palette architecture — used to audition full color themes against the same
// layout/typography/components before locking one in claude.md §3a.
// `deepFocus` is the winner (see activeTheme.ts + claude.md §3a v3 note);
// the other three are kept here, not deleted, in case the brand hue is ever
// revisited. Each palette is a complete, self-contained token set of
// identical shape; swapping the active one (see activeTheme.ts) is a
// one-line change because every component already reads from `colors` /
// `gradients` / `shadows`, never hardcoded hex values.
//
// Deliberately held constant across all palettes so the comparison isolates
// the "brand hue" decision rather than confounding it with semantics:
// - accentGold (claude.md §3a discipline rule: reserved for premium moments)
// - success / warning / error (semantic meaning must stay consistent)
// - sheen, shadows.card (the "3D" treatment itself, not the color axis)

export interface PaletteColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  primary: string;
  primaryDeep: string;
  primaryLight: string;
  primarySoft: string;
  accentGold: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  sheen: string;
  success: string;
  warning: string;
  error: string;
  scrim: string;
  glassTint: string;
}

export interface PaletteGradients {
  primary: readonly [string, string];
  wash: readonly [string, string];
}

export interface PaletteShadows {
  card: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
  glow: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
}

export interface Palette {
  label: string;
  description: string;
  colors: PaletteColors;
  gradients: PaletteGradients;
  shadows: PaletteShadows;
  // Opts into the tiled low-opacity icon "doodle" wallpaper (ChatWallpaper
  // component) behind screen content — a texture, not just a color axis.
  hasWallpaper?: boolean;
}

export type ThemeId =
  | 'midnightViolet'
  | 'royalIndigo'
  | 'emberPlum'
  | 'deepFocus'
  | 'oceanBlue'
  | 'sageForest'
  | 'slateMinimal'
  | 'whatsappChat';

const SHARED = {
  accentGold: '#F2B705',
  success: '#34D399',
  warning: '#F59E0B',
  error: '#F87171',
  sheen: 'rgba(255, 255, 255, 0.10)',
};

const SHARED_CARD_SHADOW = {
  shadowColor: '#000000',
  shadowOpacity: 0.35,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
};

export const palettes: Record<ThemeId, Palette> = {
  // Option A — the palette already built (claude.md §3a v2). Cool, neutral
  // near-black with a violet brand color. Baseline / current default.
  midnightViolet: {
    label: 'Midnight Violet',
    description: 'Cool near-black with a classic violet brand color — the current baseline.',
    colors: {
      background: '#0D0A18',
      surface: '#161222',
      surfaceElevated: '#1D1830',
      surfaceMuted: '#1A1626',
      primary: '#7C5CFC',
      primaryDeep: '#5B32D6',
      primaryLight: '#B9A6FF',
      primarySoft: 'rgba(124, 92, 252, 0.14)',
      textPrimary: '#F5F3FF',
      textSecondary: '#9990B4',
      textMuted: '#615A78',
      border: '#28223C',
      borderStrong: '#382C5C',
      scrim: 'rgba(9, 7, 16, 0.72)',
      glassTint: 'rgba(29, 24, 48, 0.6)',
      ...SHARED,
    },
    gradients: {
      primary: ['#5B32D6', '#9D7BFF'],
      wash: ['#241C3D', '#161222'],
    },
    shadows: {
      card: SHARED_CARD_SHADOW,
      glow: {
        shadowColor: '#5B32D6',
        shadowOpacity: 0.4,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      },
    },
  },

  // Option B — shifts the brand hue cooler/bluer (indigo instead of violet).
  // Reads more "focused tech tool" — closer to Linear/Arc-style premium SaaS.
  // Backgrounds are pushed to a visibly saturated navy (not just a
  // technically-different near-black) and primary is brightened so the
  // theme reads as distinct at a glance, not just "a different shade."
  royalIndigo: {
    label: 'Royal Indigo',
    description: 'Vivid navy-indigo, cooler and more electric — a "focus tool" feel.',
    colors: {
      background: '#0A0F2E',
      surface: '#121A3E',
      surfaceElevated: '#1B2450',
      surfaceMuted: '#141C42',
      primary: '#818CF8',
      primaryDeep: '#4338CA',
      primaryLight: '#C7D2FE',
      primarySoft: 'rgba(129, 140, 248, 0.18)',
      textPrimary: '#F0F1FF',
      textSecondary: '#9AA3D9',
      textMuted: '#5A63A0',
      border: '#2A3568',
      borderStrong: '#3C4890',
      scrim: 'rgba(5, 7, 24, 0.75)',
      glassTint: 'rgba(22, 29, 66, 0.65)',
      ...SHARED,
    },
    gradients: {
      primary: ['#4338CA', '#A5B4FC'],
      wash: ['#1B2557', '#121A3E'],
    },
    shadows: {
      card: SHARED_CARD_SHADOW,
      glow: {
        shadowColor: '#4338CA',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      },
    },
  },

  // Option C — shifts the brand hue warmer (magenta/fuchsia). Reads more
  // energetic/social — leans into the gamification side of the product.
  // Same treatment as Royal Indigo: a visibly-colored dark background, not
  // just a whisper of tint, plus a brighter, more saturated primary.
  emberPlum: {
    label: 'Ember Plum',
    description: 'Vivid magenta-fuchsia plum — bold and energetic, leans into the game layer.',
    colors: {
      background: '#210A2C',
      surface: '#301040',
      surfaceElevated: '#3D1450',
      surfaceMuted: '#341246',
      primary: '#D946EF',
      primaryDeep: '#A21CAF',
      primaryLight: '#F5D0FE',
      primarySoft: 'rgba(217, 70, 239, 0.18)',
      textPrimary: '#FDF4FF',
      textSecondary: '#C29AD6',
      textMuted: '#7A5C8C',
      border: '#48225C',
      borderStrong: '#66308A',
      scrim: 'rgba(18, 7, 24, 0.75)',
      glassTint: 'rgba(56, 20, 72, 0.65)',
      ...SHARED,
    },
    gradients: {
      primary: ['#A21CAF', '#F0ABFC'],
      wash: ['#42195A', '#301040'],
    },
    shadows: {
      card: SHARED_CARD_SHADOW,
      glow: {
        shadowColor: '#A21CAF',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      },
    },
  },

  // Option D — leaves the violet/magenta family entirely for a teal-emerald
  // brand color: the classic "calm focus/productivity" hue (Notion, Todoist,
  // Forest, RescueTime all lean this direction) rather than the more
  // social/gamified read of purple. Reserves gold for premium moments same
  // as the others, but the everyday brand color itself now signals "focus
  // tool" rather than "game."
  deepFocus: {
    label: 'Deep Focus',
    description: 'Teal-emerald brand color on a cool dark background — reads as calm/focus rather than game-like.',
    colors: {
      background: '#071716',
      surface: '#0F211F',
      surfaceElevated: '#15302C',
      surfaceMuted: '#122622',
      primary: '#14B8A6',
      primaryDeep: '#0F766E',
      primaryLight: '#5EEAD4',
      primarySoft: 'rgba(20, 184, 166, 0.18)',
      textPrimary: '#F0FBFA',
      textSecondary: '#93B4AF',
      textMuted: '#547873',
      border: '#1C3733',
      borderStrong: '#2A4F49',
      scrim: 'rgba(4, 12, 11, 0.75)',
      glassTint: 'rgba(15, 38, 35, 0.65)',
      ...SHARED,
    },
    gradients: {
      primary: ['#0F766E', '#5EEAD4'],
      wash: ['#12302B', '#0F211F'],
    },
    shadows: {
      card: SHARED_CARD_SHADOW,
      glow: {
        shadowColor: '#0F766E',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      },
    },
  },

  // Option E — classic "productivity blue": the hue most associated with
  // trust/focus/professional tools (Todoist, Trello, LinkedIn). Cooler and
  // more universally "safe" than teal; less distinctive as a brand color but
  // very legible as "this is a work tool."
  oceanBlue: {
    label: 'Ocean Blue',
    description: 'Classic trust/productivity blue — the most universally "focus tool" hue.',
    colors: {
      background: '#071527',
      surface: '#0E2038',
      surfaceElevated: '#152C4A',
      surfaceMuted: '#11253E',
      primary: '#3B82F6',
      primaryDeep: '#1D4ED8',
      primaryLight: '#93C5FD',
      primarySoft: 'rgba(59, 130, 246, 0.18)',
      textPrimary: '#F0F6FF',
      textSecondary: '#93AACB',
      textMuted: '#56698C',
      border: '#1D3459',
      borderStrong: '#2C4B7C',
      scrim: 'rgba(4, 10, 20, 0.75)',
      glassTint: 'rgba(15, 32, 56, 0.65)',
      ...SHARED,
    },
    gradients: {
      primary: ['#1D4ED8', '#93C5FD'],
      wash: ['#15294A', '#0E2038'],
    },
    shadows: {
      card: SHARED_CARD_SHADOW,
      glow: {
        shadowColor: '#1D4ED8',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      },
    },
  },

  // Option F — grounded green, "growth/progress" rather than teal's more
  // clinical read. Primary is a true grass-green (Tailwind green-500/700),
  // deliberately a different hue from the shared `success` token (an
  // emerald/mint) so the two don't collapse into each other on screen.
  sageForest: {
    label: 'Sage Forest',
    description: 'Grounded grass-green brand color — reads as "growth/progress" rather than clinical.',
    colors: {
      background: '#0B1710',
      surface: '#13221A',
      surfaceElevated: '#1B2F23',
      surfaceMuted: '#152A1E',
      primary: '#22C55E',
      primaryDeep: '#15803D',
      primaryLight: '#86EFAC',
      primarySoft: 'rgba(34, 197, 94, 0.18)',
      textPrimary: '#F1FBF3',
      textSecondary: '#9DBFA7',
      textMuted: '#5F8268',
      border: '#1F3826',
      borderStrong: '#2E5136',
      scrim: 'rgba(6, 14, 9, 0.75)',
      glassTint: 'rgba(19, 38, 25, 0.65)',
      ...SHARED,
    },
    gradients: {
      primary: ['#15803D', '#86EFAC'],
      wash: ['#1B3322', '#13221A'],
    },
    shadows: {
      card: SHARED_CARD_SHADOW,
      glow: {
        shadowColor: '#15803D',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      },
    },
  },

  // Option G — a different axis entirely: instead of a colored background,
  // near-monochrome graphite with one crisp icy-blue accent. No ambient hue
  // wash competing for attention anywhere — the "zero visual noise, pure
  // focus" minimalist read (Things 3 / Craft), vs. the other options' fuller
  // colored-dark-mode treatment.
  slateMinimal: {
    label: 'Slate Minimal',
    description: 'Near-monochrome graphite with one crisp accent — minimalist "no distractions" read.',
    colors: {
      background: '#0B0D10',
      surface: '#131619',
      surfaceElevated: '#1A1E22',
      surfaceMuted: '#16191C',
      primary: '#38BDF8',
      primaryDeep: '#0284C7',
      primaryLight: '#BAE6FD',
      primarySoft: 'rgba(56, 189, 248, 0.16)',
      textPrimary: '#F5F6F7',
      textSecondary: '#9AA0A6',
      textMuted: '#5C6166',
      border: '#22262A',
      borderStrong: '#33383D',
      scrim: 'rgba(5, 6, 8, 0.75)',
      glassTint: 'rgba(22, 25, 28, 0.65)',
      ...SHARED,
    },
    gradients: {
      primary: ['#0284C7', '#7DD3FC'],
      wash: ['#1A1E22', '#131619'],
    },
    shadows: {
      card: SHARED_CARD_SHADOW,
      glow: {
        shadowColor: '#0284C7',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      },
    },
  },

  // Option H — not a hue experiment but a texture one: WhatsApp's actual
  // dark-mode chat colors (background/bubble/text values match WhatsApp's
  // real palette, not an approximation) plus its iconic tiled doodle
  // wallpaper behind content (hasWallpaper — see ChatWallpaper component).
  // Pulls the brand color from the classic bright WhatsApp green rather than
  // anything in the violet or teal family tried so far.
  whatsappChat: {
    label: 'WhatsApp Chat',
    description: "WhatsApp's real dark chat colors + its tiled doodle wallpaper texture behind content.",
    hasWallpaper: true,
    colors: {
      background: '#0B141A',
      surface: '#202C33',
      surfaceElevated: '#2A3942',
      surfaceMuted: '#182229',
      primary: '#00A884',
      primaryDeep: '#005C4B',
      primaryLight: '#25D366',
      primarySoft: 'rgba(0, 168, 132, 0.18)',
      textPrimary: '#E9EDEF',
      textSecondary: '#8696A0',
      textMuted: '#667781',
      border: '#233138',
      borderStrong: '#2A3942',
      scrim: 'rgba(6, 10, 13, 0.75)',
      glassTint: 'rgba(32, 44, 51, 0.65)',
      ...SHARED,
    },
    gradients: {
      primary: ['#005C4B', '#00A884'],
      wash: ['#182229', '#0B141A'],
    },
    shadows: {
      card: SHARED_CARD_SHADOW,
      glow: {
        shadowColor: '#00A884',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      },
    },
  },
};

export const THEME_IDS = Object.keys(palettes) as ThemeId[];
