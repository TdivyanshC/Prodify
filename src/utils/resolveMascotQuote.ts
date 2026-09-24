import { mascotQuotes, type MascotQuoteCategory } from '../mocks/mascotQuotes';

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Fills any {token} placeholders (e.g. "{minutes}", "{name}") in a quote
// from `vars` — shared by resolveMascotQuote and by the overlay's unread
// queue, which needs the whole category filled, not just one pick.
export function fillVars(quote: string, vars: Record<string, string | number> = {}): string {
  return quote.replace(/\{(\w+)\}/g, (_match, key) => (key in vars ? String(vars[key]) : `{${key}}`));
}

// Picks a random quote from a category and fills any {token} placeholders
// from `vars`.
export function resolveMascotQuote(
  category: MascotQuoteCategory,
  vars: Record<string, string | number> = {}
): string {
  return fillVars(pickRandom(mascotQuotes[category]), vars);
}
