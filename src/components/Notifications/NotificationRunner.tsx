import { useEffect } from 'react';
import { runNotificationSimulations } from '../../mocks/notificationSimulations';
import { useFriendsStore } from '../../store/useFriendsStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useSessionStore } from '../../store/useSessionStore';
import { useSpaceAlertsStore } from '../../store/useSpaceAlertsStore';
import { useSpaceInviteStore } from '../../store/useSpaceInviteStore';
import { useUserStore } from '../../store/useUserStore';
import { redeliverSnoozed } from '../../utils/notifications/deliver';
import { observeFriendshipTransitions, runFriendTriggers } from '../../utils/notifications/triggers/friends';
import { runNudgeTriggers } from '../../utils/notifications/triggers/nudges';
import { observeUserTransitions, runProgressTriggers } from '../../utils/notifications/triggers/progress';
import { runSpaceTriggers } from '../../utils/notifications/triggers/spaces';

const TICK_MS = 10_000;

// Headless — mounted once in App.tsx. The Phase 1 stand-in for Phase 2's
// server jobs + socket events: loads the stores the triggers read, then
// runs every trigger on an interval and right after anything relevant
// changes. All triggers are idempotent (deterministic event ids), so
// running them often is safe. Event-driven rewards (badges, level-ups,
// freezes, accepted requests) are diffed straight off store transitions.
export function NotificationRunner() {
  useEffect(() => {
    const startedAt = Date.now();
    if (!useUserStore.getState().user) useUserStore.getState().refresh();
    if (useSessionStore.getState().sessions.length === 0) useSessionStore.getState().refresh();
    if (!useFriendsStore.getState().hasLoaded) useFriendsStore.getState().refresh();
    if (!useSpaceInviteStore.getState().hasLoaded) useSpaceInviteStore.getState().refresh();

    const tick = () => {
      const now = Date.now();
      runSpaceTriggers(now);
      runFriendTriggers(now);
      runProgressTriggers(now, startedAt);
      runNudgeTriggers(now, startedAt);
      runNotificationSimulations(now, startedAt);
      useNotificationStore
        .getState()
        .takeDueSnoozes(now)
        .forEach((n) => redeliverSnoozed(n, now));
    };

    tick();
    const interval = setInterval(tick, TICK_MS);
    const unsubscribers = [
      useSessionStore.subscribe(tick),
      useSpaceAlertsStore.subscribe(tick),
      useSpaceInviteStore.subscribe(tick),
      useFriendsStore.subscribe((state, prev) => {
        observeFriendshipTransitions(state.friendships, prev.friendships);
        tick();
      }),
      useUserStore.subscribe((state, prev) => {
        if (state.user !== prev.user) observeUserTransitions(state.user, prev.user);
      }),
    ];
    // The user may already be loaded (Home loads it too) — diff the first
    // snapshot against "nothing" so a load-time freeze still reports.
    observeUserTransitions(useUserStore.getState().user, null);

    return () => {
      clearInterval(interval);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return null;
}
