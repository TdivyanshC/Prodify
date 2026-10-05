import type { CopyVariant } from '../../mocks/notificationCopy';

export type CopyVars = Record<string, string | number | undefined>;

const TOKEN = /\{(\w+)\}/g;

function fill(template: string, vars: CopyVars): string {
  return template.replace(TOKEN, (_m, key) => String(vars[key]));
}

function hasAllTokens(variant: CopyVariant, vars: CopyVars): boolean {
  const tokens = [...`${variant.title} ${variant.body}`.matchAll(TOKEN)].map((m) => m[1]);
  return tokens.every((t) => vars[t] !== undefined && vars[t] !== '');
}

// Picks a random variant whose tokens can all be filled and returns the
// filled copy plus its id (→ AppNotification.copyVariantId). Returns null
// only if no variant fits, which callers treat as "don't send".
export function pickCopy(
  variants: CopyVariant[],
  vars: CopyVars
): { title: string; body: string; copyVariantId: string } | null {
  const usable = variants.filter((v) => hasAllTokens(v, vars));
  if (usable.length === 0) return null;
  const variant = usable[Math.floor(Math.random() * usable.length)];
  return { title: fill(variant.title, vars), body: fill(variant.body, vars), copyVariantId: variant.id };
}

export const firstName = (displayName: string | undefined) => displayName?.split(' ')[0] ?? 'A friend';

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
