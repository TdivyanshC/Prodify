import { assemble, type SeedData } from './assemble';
import { generateActivity } from './generate';
import { replay } from './replay';

// generate (raw activity) → replay (progress rules) → assemble (collections).
// `now` anchors every relative timestamp, so pass a fixed date for
// reproducible output in tests.
export function buildSeed(now: Date = new Date()): SeedData {
  const activity = generateActivity(now);
  return assemble(activity, replay(activity));
}
