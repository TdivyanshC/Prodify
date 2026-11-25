// Derives the live color/gradient/shadow tokens from whichever palette is
// active (see activeTheme.ts / palettes.ts). Every component imports
// `colors` / `gradients` / `shadows` from here (via ./index) exactly as
// before — this file is the only place that resolves which palette wins,
// so switching the active theme never requires touching a component.
import { ACTIVE_THEME } from './activeTheme';
import { palettes } from './palettes';

const activePalette = palettes[ACTIVE_THEME];

export const colors = activePalette.colors;
// `wash` fades to fully transparent (same hue, alpha 0) instead of to a second solid colour, so a
// card's decorative top wash melts into the card rather than ending in a hard horizontal seam.
function fadeOut(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
}
const base = activePalette.gradients;
export const gradients = { ...base, wash: [base.wash[0], fadeOut(base.wash[0])] as readonly [string, string] };
export const shadows = activePalette.shadows;
