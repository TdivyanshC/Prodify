import { JOIN_NUDGE_COPY, type NudgeContext } from '../../../mocks/notificationCopy';
import { mockWeeklyRecapExtras } from '../../../mocks/weeklyRecap.mock';
import { mockSessionCategories } from '../../../mocks/sessionCategories.mock';
import { useFocusModeStore } from '../../../store/useFocusModeStore';
import { useNotificationStore } from '../../../store/useNotificationStore';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUserStore } from '../../../store/useUserStore';
import type { NotificationAction } from '../../../types/social';
import { getFriendProfile } from '../../friendHelpers';
import { getTodayProgress } from '../../progressStats';
import { isUserInSession } from '../../sessionHelpers';
import { localDayKey } from '../../togetherStreak';
import { firstName, pickCopy, type CopyVars } from '../copy';
import { deliver } from '../deliver';
import { findLiveFriend } from './progress';

// Windows in which one playful nudge may fire (local hours, [start, end)).
const SLOTS: { slot: string; from: number; to: number; context: NudgeContext }[] = [
  { slot: 'morning', from: 8, to: 11, context: 'morning' },
  { slot: 'afternoon', from: 13, to: 16, context: 'afternoon' },
  { slot: 'evening', from: 18, to: 21, context: 'evening' },
  { slot: 'late_night', from: 22, to: 24, context: 'late_night' },
];
// Give the user time to look around before nudging them anywhere.
const MIN_APP_OPEN_MS = 90 * 1000;
// Don't stack a nudge right on top of another notification.
const QUIET_AFTER_TOAST_MS = 3 * 60 * 1000;
const NUDGE_SESSION_MIN = 25;

// The Swiggy/Zomato-style "come focus" nudges. At most one per slot per
// day, only when the user is idle (not in a space, not mid-notification,
// not just opened the app). Context picks the line: a friend live right
// now beats a streak hook beats a theme/time-of-day joke.
export function runNudgeTriggers(now: number, runnerStartedAt: number, options: { force?: boolean } = {}) {
  const user = useUserStore.getState().user;
  if (!user) return;
  const date = new Date(now);
  const hour = date.getHours();
  const slot = SLOTS.find((s) => hour >= s.from && hour < s.to);

  if (!options.force) {
    if (!slot) return;
    if (now - runnerStartedAt < MIN_APP_OPEN_MS) return;
    if (useFocusModeStore.getState().activeSessionId) return;
    if (useSessionStore.getState().sessions.some((s) => s.status === 'active' && isUserInSession(s, user._id))) return;
    const { toastLog } = useNotificationStore.getState();
    const lastToast = toastLog[toastLog.length - 1];
    if (lastToast && now - lastToast < QUIET_AFTER_TOAST_MS) return;
  }

  const draft = buildNudge(slot?.context ?? timeOfDayContext(hour), user.streak.current);
  if (!draft) return;
  deliver(
    {
      eventId: slot && !options.force ? `nudge_${localDayKey(date)}_${slot.slot}` : `nudge_preview_${now}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'join_nudge',
      copy: draft.copy,
      sender: { kind: 'spark' },
      actions: draft.actions,
      payload: draft.payload,
    },
    { force: options.force }
  );
}

function timeOfDayContext(hour: number): NudgeContext {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'late_night';
}

function buildNudge(timeContext: NudgeContext, streak: number) {
  const snooze: NotificationAction = { kind: 'snooze', label: 'Maybe later' };

  const liveFriend = findLiveFriend();
  if (liveFriend) {
    const name = firstName(getFriendProfile(liveFriend.userId)?.displayName);
    const vars: CopyVars = {
      friend: name,
      space: liveFriend.spaceName,
      minutes: Math.max(1, Math.round((Date.now() - new Date(liveFriend.joinedAt).getTime()) / 60000)),
    };
    const copy = pickCopy(JOIN_NUDGE_COPY.friend_live, vars);
    if (copy) {
      return {
        copy,
        actions: [{ kind: 'join_space', label: `Join ${name}` } as NotificationAction, snooze],
        payload: { spaceId: liveFriend.spaceId, spaceName: liveFriend.spaceName, fromUserId: liveFriend.userId },
      };
    }
  }

  const start: NotificationAction = { kind: 'quick_start', label: 'Start a space' };
  const { minutes, target } = getTodayProgress();
  // Streak hooks only while today isn't done yet — no point hyping a
  // streak that's already safe for the day.
  const contexts: NudgeContext[] = streak > 0 && minutes < target ? ['streak', timeContext, 'theme'] : [timeContext, 'theme'];
  const context = contexts[Math.floor(Math.random() * contexts.length)];
  const theme = mockSessionCategories.find((c) => c._id === mockWeeklyRecapExtras.topCategoryId);
  const copy = pickCopy(JOIN_NUDGE_COPY[context], { streak, theme: theme?.name, icon: theme?.icon });
  if (!copy) return null;
  return {
    copy,
    actions: [start, snooze],
    payload: { durationMin: NUDGE_SESSION_MIN },
  };
}
