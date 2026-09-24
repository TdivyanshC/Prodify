import type { ThemeId } from './palettes';

// `deepFocus` is the locked brand palette (claude.md §3a v3) after a
// side-by-side comparison against three violet-family alternatives —
// see palettes.ts for all four and the v3 revision note in claude.md for why
// this one won.
//
// This is still the single switch point if the brand hue is ever revisited:
// React Native bakes colors into `StyleSheet.create` at module-load time
// (not per-render), so there is no zero-cost way to flip themes live without
// rewriting every component's styling — the practical way to preview a
// different palette is to change this one line and reload (Fast Refresh
// reloads automatically since this is a plain-data module, not a component).
export const ACTIVE_THEME: ThemeId = 'whatsappChat';
