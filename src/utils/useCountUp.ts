import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

// Animates a number counting up to `target` on mount/change — used for the
// Daily Gamification card's productive-hours/XP figures (architecture §1
// §3/§16: "numbers should feel rewarding... XP can count upward").
export function useCountUp(target: number, durationMs = 800): number {
  const [display, setDisplay] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const listenerId = anim.addListener(({ value }) => {
      setDisplay(Math.round(value * target));
    });
    Animated.timing(anim, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(listenerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}
