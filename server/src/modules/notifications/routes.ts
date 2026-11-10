import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { mascotQuotes, type MascotQuoteCategory } from '../../shared/mascotQuotes';
import { col } from '../../db/mongo';
import { notFound, parseId } from '../../lib/errors';
import { MINUTE } from '../../lib/time';
import { me } from '../../middleware/auth';
import { validate } from '../../middleware/common';
import { scheduleJob } from '../../jobs/scheduler';
import { emitToUser } from '../../realtime/io';
import { plain } from './deliver';

export const notificationRoutes = Router();
export const mascotRoutes = Router();

const listSchema = z.object({
  category: z.enum(['spaces', 'friends', 'progress', 'nudges']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

notificationRoutes.get('/', validate(listSchema, 'query'), async (req, res) => {
  const { category, cursor, limit } = req.query as unknown as z.infer<typeof listSchema>;
  const filter: Record<string, unknown> = { userId: me(req)._id };
  if (category) filter.category = category;
  if (cursor) filter.sentAt = { $lt: new Date(Buffer.from(cursor, 'base64url').toString()) };
  const docs = await col('notifications').find(filter).sort({ sentAt: -1 }).limit(limit + 1).toArray();
  const page = docs.slice(0, limit);
  res.json({
    items: page.map(plain),
    nextCursor: docs.length > limit ? Buffer.from(page[page.length - 1].sentAt.toISOString()).toString('base64url') : null,
  });
});

notificationRoutes.get('/unread-count', async (req, res) => {
  res.json({ count: await col('notifications').countDocuments({ userId: me(req)._id, openedAt: null }) });
});

const patchSchema = z.object({
  opened: z.literal(true).optional(),
  actionTaken: z.string().max(40).optional(),
  // The inbox row's rewritten text after an in-place action ("Reminder set ✓").
  body: z.string().max(200).optional(),
});

notificationRoutes.patch('/:id', validate(patchSchema), async (req, res) => {
  const user = me(req);
  const body = req.body as z.infer<typeof patchSchema>;
  const $set: Record<string, unknown> = {};
  if (body.opened || body.actionTaken) $set.openedAt = new Date();
  if (body.actionTaken) $set.actionTaken = body.actionTaken;
  if (body.body) $set.body = body.body;
  if (body.actionTaken) $set.actions = [];
  const updated = await col('notifications').findOneAndUpdate(
    { _id: parseId(req.params.id, 'notification id'), userId: user._id },
    { $set },
    { returnDocument: 'after' }
  );
  if (!updated) throw notFound('Notification');
  // Other devices of the same user stay in sync.
  emitToUser(user._id, 'notification:updated', { id: updated._id.toHexString(), patch: plain($set) });
  res.json(plain(updated));
});

notificationRoutes.post('/read-all', async (req, res) => {
  const result = await col('notifications').updateMany({ userId: me(req)._id, openedAt: null }, { $set: { openedAt: new Date() } });
  res.json({ updated: result.modifiedCount });
});

notificationRoutes.post('/:id/snooze', validate(z.object({ minutes: z.number().int().min(1).max(240).default(10) })), async (req, res) => {
  const user = me(req);
  const id = parseId(req.params.id, 'notification id');
  const doc = await col('notifications').findOneAndUpdate({ _id: id, userId: user._id }, { $set: { openedAt: new Date(), actionTaken: 'snoozed' } }, { returnDocument: 'after' });
  if (!doc) throw notFound('Notification');
  const at = new Date(Date.now() + req.body.minutes * MINUTE);
  scheduleJob(`snooze:${id.toHexString()}:${at.getTime()}`, at, 'notification.redeliver', { notificationId: id.toHexString() });
  res.json({ ok: true, redeliverAt: at.toISOString() });
});

notificationRoutes.delete('/:id', async (req, res) => {
  await col('notifications').deleteOne({ _id: parseId(req.params.id, 'notification id'), userId: me(req)._id });
  res.json({ ok: true });
});

// ── Mascot (server decides which message wins — CLAUDE.md §4) ───────────
const QUOTE_CATEGORY: Record<string, MascotQuoteCategory> = {
  streak_at_risk: 'streakAtRisk',
  badge_earned: 'badgeEarned',
  level_up: 'levelUp',
  friend_achievement: 'friendUpdate',
  welcome_back: 'welcomeBack',
  generic_encouragement: 'celebration',
  idle: 'idle',
};

mascotRoutes.get('/next', async (req, res) => {
  const event = await col('mascotEvents').findOne({ userId: me(req)._id, deliveredAt: null }, { sort: { priority: 1, createdAt: -1 } });
  const eventType = event?.eventType ?? 'idle';
  const quotes = mascotQuotes[QUOTE_CATEGORY[eventType] ?? 'idle'];
  res.json({ event: event ? plain(event) : null, eventType, quote: quotes[Math.floor(Math.random() * quotes.length)] });
});

mascotRoutes.post('/events/:id/delivered', async (req, res) => {
  await col('mascotEvents').updateOne({ _id: new ObjectId(parseId(req.params.id).toHexString()), userId: me(req)._id }, { $set: { deliveredAt: new Date() } });
  res.json({ ok: true });
});
