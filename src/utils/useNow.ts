import { useEffect, useState } from 'react';

// Re-renders the caller every `intervalMs` with the current timestamp —
// for live clocks. `enabled: false` stops the interval entirely (tab
// screens stay mounted while unfocused, so an unpaused clock would keep
// ticking behind the tab the user is actually looking at).
export function useNow(intervalMs: number = 1000, enabled: boolean = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs, enabled]);

  return now;
}
