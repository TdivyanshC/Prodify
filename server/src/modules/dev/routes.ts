import { Router } from 'express';
import { z } from 'zod';
import { JOIN_NUDGE_COPY } from '../../shared/notificationCopy';
import type { AppNotificationType } from '../../shared/social';
import { col, getDb } from '../../db/mongo';
import { pendingJobIds, runJobNow, stopJobs } from '../../jobs/scheduler';
import { startJobs } from '../../jobs/index';
import { me } from '../../middleware/auth';
import { validate } from '../../middleware/common';
import { emitToLobby } from '../../realtime/io';
import { seedDatabase } from '../../seed/write';
import { CATEGORY_BY_TYPE, deliver } from '../notifications/deliver';
import { resetCatalogCache } from '../views';

// Development-only tools — mounted only when NODE_ENV !== 'production'.
export const devRoutes = Router();

// Seed accounts to sign in as (`Bearer dev:<firebaseUid>`). Unauthenticated
// on purpose so the app can offer an account switcher before sign-in.
devRoutes.get('/accounts', async (_req, res) => {
  const users = await col('users').find({ firebaseUid: /^seed-/ }, { projection: { displayName: 1, handle: 1, firebaseUid: 1 } }).toArray();
  res.json({ items: users.map((u) => ({ firebaseUid: u.firebaseUid, displayName: u.displayName, handle: u.handle })) });
});

// Wipe + reseed relative to now, and re-arm jobs from the fresh state.
devRoutes.post('/reset', async (_req, res) => {
  stopJobs();
  await seedDatabase(getDb());
  resetCatalogCache();
  await startJobs();
  emitToLobby('dev:reset', { at: new Date().toISOString() });
  res.json({ ok: true });
});

devRoutes.get('/jobs', (_req, res) => {
  res.json({ pending: pendingJobIds() });
});

devRoutes.post('/jobs/:name/run', async (req, res) => {
  await runJobNow(String(req.params.name), req.body ?? {});
  res.json({ ok: true });
});

const SAMPLE_VARS = {
  friend: 'Riya',
  space: 'Graph Problems Sprint',
  theme: 'Coding & Tech',
  minutes: 5,
  time: '6:00 PM',
  milestone: 21,
  emoji: '🔥',
  days: 4,
  next: 5,
  streak: 8,
  needed: 20,
  remaining: 15,
  count: 1,
  badge: 'Rising Flame',
  icon: '🔥',
  description: 'Earned 1,000 XP.',
  level: 12,
  hours: '14h 20m',
  bestDay: 'Thu',
  others: '2 others',
};

const ACTIONS: Partial<Record<AppNotificationType, { kind: string; label: string }[]>> = {
  space_invite: [{ kind: 'join_space', label: 'Join' }],
  friend_started_space: [{ kind: 'join_space', label: 'Join Riya' }],
  own_space_due: [
    { kind: 'start_space_now', label: 'Start now' },
    { kind: 'snooze', label: 'Snooze 10 min' },
  ],
  friend_request: [
    { kind: 'accept_friend', label: 'Accept' },
    { kind: 'decline_friend', label: 'Decline' },
  ],
  friend_milestone: [{ kind: 'send_fire', label: 'Send 🔥' }],
  together_streak_risk: [{ kind: 'join_space', label: 'Join Riya' }],
  streak_at_risk: [
    { kind: 'quick_start', label: 'Start 20 min' },
    { kind: 'snooze', label: 'Snooze 10 min' },
  ],
  goal_close: [{ kind: 'quick_start', label: 'Start 15 min' }],
  badge_earned: [{ kind: 'celebrate', label: 'Celebrate 🎉' }],
  level_up: [{ kind: 'celebrate', label: 'Celebrate ✨' }],
  weekly_recap: [{ kind: 'open_recap', label: 'See my week' }],
  welcome_back: [{ kind: 'open_spaces', label: 'Browse spaces' }],
  join_nudge: [
    { kind: 'quick_start', label: 'Start a space' },
    { kind: 'snooze', label: 'Maybe later' },
  ],
};

// Sends any notification type through the REAL pipeline (forced past
// dedupe/mute/quiet hours) — backs the Notification settings Preview panel.
devRoutes.post(
  '/notifications/preview',
  validate(z.object({ type: z.enum(Object.keys(CATEGORY_BY_TYPE) as [AppNotificationType, ...AppNotificationType[]]) })),
  async (req, res) => {
    const user = me(req);
    const type = req.body.type as AppNotificationType;
    const riya = await col('users').findOne({ firebaseUid: 'seed-riya' });
    const fromFriend = ['space_invite', 'friend_started_space', 'space_reminder', 'space_joined', 'friend_request', 'friend_accepted', 'friend_milestone', 'reactions_received', 'together_streak_risk'].includes(type);
    const result = await deliver(
      {
        userId: user._id,
        type,
        eventId: `preview_${type}_${Date.now()}`,
        variants: type === 'join_nudge' ? JOIN_NUDGE_COPY.evening : undefined,
        vars: SAMPLE_VARS,
        sender: fromFriend && riya ? { kind: 'friend', userId: riya._id } : { kind: 'spark' },
        tone: ['badge_earned', 'level_up', 'streak_freeze_earned'].includes(type) ? 'reward' : type === 'streak_at_risk' ? 'nudge' : 'default',
        priority: 'high',
        actions: ACTIONS[type] ?? [],
        payload: riya ? { fromUserId: riya._id, fromUserIds: [riya._id], durationMin: 15, level: 12, badgeId: 'badge_xp_1000' } : {},
      },
      { force: true }
    );
    res.json({ result });
  }
);
