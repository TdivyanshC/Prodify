import { sessionStartQuotes } from '../mocks/sessionStartQuotes';
import { spaceQuotes } from '../mocks/spaceQuotes';

export function pickRandomSpaceQuote(): string {
  return spaceQuotes[Math.floor(Math.random() * spaceQuotes.length)];
}

// Same "different one each time" pattern as pickRandomLottie.
export function pickRandomSessionQuote(): string {
  return sessionStartQuotes[Math.floor(Math.random() * sessionStartQuotes.length)];
}
