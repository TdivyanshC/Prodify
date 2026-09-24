// Derives the live color/gradient/shadow tokens from whichever palette is
// active (see activeTheme.ts / palettes.ts). Every component imports
// `colors` / `gradients` / `shadows` from here (via ./index) exactly as
// before — this file is the only place that resolves which palette wins,
// so switching the active theme never requires touching a component.
import { ACTIVE_THEME } from './activeTheme';
import { palettes } from './palettes';

const activePalette = palettes[ACTIVE_THEME];

export const colors = activePalette.colors;
export const gradients = activePalette.gradients;
export const shadows = activePalette.shadows;
