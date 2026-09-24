import type { AnimationObject } from 'lottie-react-native';

// Validated clean (no corrupted keyframe data — checked by scanning for
// empty bezier tangent arrays, which is what broke checkmark-success.json
// on Android's native Lottie parser even though it looked fine in JSON).
const clock = require('../assets/lottie/clock.json');
const yinyang = require('../assets/lottie/yinyang.json');
const running = require('../assets/lottie/running.json');
const progressHand = require('../assets/lottie/progress-hand.json');
const avatar = require('../assets/lottie/avatar.json');

const LOTTIE_POOL: AnimationObject[] = [clock, yinyang, running, progressHand, avatar];

// Picks a random animation from the pool — used so a popup shows a
// different Lottie each time it opens rather than always the same one.
export function pickRandomLottie(): AnimationObject {
  return LOTTIE_POOL[Math.floor(Math.random() * LOTTIE_POOL.length)];
}
