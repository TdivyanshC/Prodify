import { mockBadges } from '../../../mocks/badges.mock';
import { NOTIFICATION_COPY } from '../../../mocks/notificationCopy';
import { mockUser } from '../../../mocks/user.mock';
import { useFriendsStore } from '../../../store/useFriendsStore';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUserStore } from '../../../store/useUserStore';
import type { User } from '../../../types/models';
import { getAcceptedFriendIds, getFriendProfile } from '../../friendHelpers';
import { getLevel } from '../../levels';
import { getTodayProgress, getWeeklyRecap, roundUpTo5 } from '../../progressStats';
import { localDayKey } from '../../togetherStreak';
import { firstName, pickCopy } from '../copy';
import { deliver } from '../deliver';

const STREAK_RISK_FROM_HOUR = 19;
const GOAL_CLOSE_FROM_HOUR = 17;
const GOAL_CLOSE_WITHIN_MIN = 20;
const WELCOME_BACK_AFTER_DAYS = 3;

// Time-of-day progress nudges + recaps. Every event id carries the date
// (or week), so each fires at most once per day (or week).
export function runProgressTriggers(now: number, runnerStartedAt: number) {
  const user = useUserStore.getState().user;
  if (!user) return;
  const date = new Date(now);
  const hour = date.getHours();
  const day = localDayKey(date);
  const { minutes, target } = getTodayProgress();

  // Streak at risk — claude.md §4: a day counts once it reaches 50% of
  // the target, so "at risk" means below that, in the evening. Amber
  // nudge tone, Spark's voice, never "you'll lose it".
  const countsAt = Math.ceil(target * 0.5);
  if (user.streak.current > 0 && hour >= STREAK_RISK_FROM_HOUR && minutes < countsAt) {
    const needed = roundUpTo5(countsAt - minutes);
    const copy = pickCopy(NOTIFICATION_COPY.streak_at_risk, { streak: user.streak.current, needed });
    if (copy) {
      deliver({
        eventId: `risk_${day}`,
        type: 'streak_at_risk',
        copy,
        sender: { kind: 'spark' },
        tone: 'nudge',
        actions: [
          { kind: 'quick_start', label: `Start ${needed} min` },
          { kind: 'snooze', label: 'Snooze 10 min' },
        ],
        payload: { durationMin: needed },
      });
    }
  }

  // Close to today's full goal.
  const remaining = target - minutes;
  if (hour >= GOAL_CLOSE_FROM_HOUR && remaining > 0 && remaining <= GOAL_CLOSE_WITHIN_MIN) {
    const copy = pickCopy(NOTIFICATION_COPY.goal_close, { remaining });
    if (copy) {
      deliver({
        eventId: `goalclose_${day}`,
        type: 'goal_close',
        copy,
        sender: { kind: 'spark' },
        actions: [{ kind: 'quick_start', label: `Start ${roundUpTo5(remaining)} min` }],
        payload: { durationMin: roundUpTo5(remaining) },
      });
    }
  }

  // Weekly recap — Sunday evening, with a Monday-morning catch-up for
  // anyone who wasn't around Sunday night. Keyed to that Sunday's date.
  const weekday = date.getDay();
  if ((weekday === 0 && hour >= 18) || (weekday === 1 && hour < 12)) {
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - weekday);
    const recap = getWeeklyRecap();
    const copy = pickCopy(NOTIFICATION_COPY.weekly_recap, { hours: recap.totalLabel, bestDay: recap.bestDay.day });
    if (copy) {
      deliver({
        eventId: `recap_${localDayKey(sunday)}`,
        type: 'weekly_recap',
        copy,
        sender: { kind: 'system', emoji: '📊' },
        actions: [{ kind: 'open_recap', label: 'See my week' }],
      });
    }
  }

  // Welcome back — only on the first pass after launch, and only after a
  // real gap. Mentions a live friend when there is one.
  if (now - runnerStartedAt < 15000) {
    const daysAway = (now - new Date(user.lastActiveAt).getTime()) / 86400000;
    if (daysAway >= WELCOME_BACK_AFTER_DAYS) {
      const liveFriend = findLiveFriend();
      const copy = pickCopy(NOTIFICATION_COPY.welcome_back, {
        friend: liveFriend ? firstName(getFriendProfile(liveFriend.userId)?.displayName) : undefined,
      });
      if (copy) {
        deliver({
          eventId: `welcome_${day}`,
          type: 'welcome_back',
          copy,
          sender: { kind: 'spark' },
          actions: liveFriend
            ? [{ kind: 'join_space', label: 'Join them' }]
            : [{ kind: 'open_spaces', label: 'Browse spaces' }],
          payload: { spaceId: liveFriend?.spaceId },
        });
      }
    }
  }
}

// Rewards are event-driven, not time-driven: called with every user-store
// change and diffed against the previous state.
export function observeUserTransitions(next: User | null, prev: User | null) {
  if (!next) return;

  // First load — the only thing that can have changed "before" we were
  // watching is a freeze the load-time check just spent. The fixture is
  // what the server had before that ran.
  const baselineFreezesUsed = prev?.streak.freezesUsed ?? mockUser.streak.freezesUsed;
  if (next.streak.freezesUsed > baselineFreezesUsed) {
    const copy = pickCopy(NOTIFICATION_COPY.streak_freeze_used, { streak: next.streak.current });
    if (copy) {
      deliver({
        eventId: `freezeused_${next.streak.freezesUsed}`,
        type: 'streak_freeze_used',
        copy,
        sender: { kind: 'spark' },
        priority: 'high',
      });
    }
  }
  if (!prev) return;

  if (next.streak.freezesAvailable > prev.streak.freezesAvailable) {
    const copy = pickCopy(NOTIFICATION_COPY.streak_freeze_earned, {
      streak: next.streak.current,
      count: next.streak.freezesAvailable,
    });
    if (copy) {
      deliver({
        eventId: `freezeearned_${next.streak.current}`,
        type: 'streak_freeze_earned',
        copy,
        sender: { kind: 'system', emoji: '❄️' },
        tone: 'reward',
        priority: 'high',
      });
    }
  }

  for (const badgeId of next.badgeIds.filter((id) => !prev.badgeIds.includes(id))) {
    const badge = mockBadges.find((b) => b._id === badgeId);
    if (!badge) continue;
    const copy = pickCopy(NOTIFICATION_COPY.badge_earned, {
      badge: badge.name,
      icon: badge.icon ?? '🏅',
      description: badge.description,
    });
    if (copy) {
      deliver({
        eventId: `badge_${badgeId}`,
        type: 'badge_earned',
        copy,
        sender: { kind: 'system', emoji: badge.icon ?? '🏅' },
        tone: 'reward',
        priority: 'high',
        actions: [{ kind: 'celebrate', label: 'Celebrate 🎉' }],
        payload: { badgeId },
      });
    }
  }

  const levelBefore = getLevel(prev.points);
  const levelAfter = getLevel(next.points);
  if (levelAfter > levelBefore) {
    const copy = pickCopy(NOTIFICATION_COPY.level_up, { level: levelAfter });
    if (copy) {
      deliver({
        eventId: `level_${levelAfter}`,
        type: 'level_up',
        copy,
        sender: { kind: 'spark' },
        tone: 'reward',
        priority: 'high',
        actions: [{ kind: 'celebrate', label: 'Celebrate ✨' }],
        payload: { level: levelAfter },
      });
    }
  }
}

// Live spaces the user isn't already sitting in.
function joinableLiveSpaces() {
  const userId = useUserStore.getState().user?._id;
  return useSessionStore
    .getState()
    .sessions.filter(
      (s) => s.status === 'active' && !(userId && s.participants.some((p) => p.userId === userId && !p.leftAt))
    );
}

// A friend currently sitting in a live space (that the user isn't in).
export function findLiveFriend(): { userId: string; spaceId: string; spaceName: string; joinedAt: string } | null {
  const friendIds = getAcceptedFriendIds(useFriendsStore.getState().friendships);
  for (const space of joinableLiveSpaces()) {
    const friend = space.participants.find((p) => !p.leftAt && friendIds.has(p.userId));
    if (friend) return { userId: friend.userId, spaceId: space._id, spaceName: space.name, joinedAt: friend.joinedAt };
  }
  return null;
}

// Where a specific friend is focusing right now, if anywhere joinable.
export function findLiveSpotFor(friendId: string): { spaceId: string; spaceName: string } | null {
  const space = joinableLiveSpaces().find((s) => s.participants.some((p) => p.userId === friendId && !p.leftAt));
  return space ? { spaceId: space._id, spaceName: space.name } : null;
}
