import { useEffect } from 'react';
import { useFriendsStore } from '../../store/useFriendsStore';
import { useSessionStore } from '../../store/useSessionStore';
import { useSpaceAlertsStore } from '../../store/useSpaceAlertsStore';
import { useSpaceInviteStore } from '../../store/useSpaceInviteStore';
import { runSpaceLifecycleTick } from '../../utils/spaceNotifications';

const TICK_MS = 10_000;

// Headless — mounted once in App.tsx. Makes sure the stores the lifecycle
// reads are loaded, then runs a tick on an interval and immediately after
// anything relevant changes (e.g. tapping "Remind me" 3 min before start
// shouldn't wait up to 10s to register).
export function SpaceLifecycleRunner() {
  useEffect(() => {
    if (useSessionStore.getState().sessions.length === 0) useSessionStore.getState().refresh();
    if (!useFriendsStore.getState().hasLoaded) useFriendsStore.getState().refresh();
    if (!useSpaceInviteStore.getState().hasLoaded) useSpaceInviteStore.getState().refresh();

    runSpaceLifecycleTick();
    const interval = setInterval(() => runSpaceLifecycleTick(), TICK_MS);
    // A tick can itself update the session store (a space going live);
    // the second pass it triggers finds nothing left to do and stops.
    const unsubscribers = [
      useSessionStore.subscribe(() => runSpaceLifecycleTick()),
      useSpaceAlertsStore.subscribe(() => runSpaceLifecycleTick()),
      useSpaceInviteStore.subscribe(() => runSpaceLifecycleTick()),
      useFriendsStore.subscribe(() => runSpaceLifecycleTick()),
    ];
    return () => {
      clearInterval(interval);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return null;
}
