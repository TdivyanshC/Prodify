import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { col } from '../../db/mongo';
import type { SessionDoc } from '../../db/schemas';
import { emit } from '../../events/bus';
import { badRequest, conflict, notFound, parseId } from '../../lib/errors';
import { me } from '../../middleware/auth';
import { validate } from '../../middleware/common';
import { closeOpenSession, sessionDTO } from '../spaces/service';
import { getCategories } from '../views';
import { closeSession } from './close';

// Solo sessions + personal history (backend doc §7.1). Space sessions are
// opened/closed by the spaces join/leave handlers instead.
export const sessionRoutes = Router();

sessionRoutes.post(
  '/',
  validate(z.object({ categoryId: z.string().startsWith('cat_'), targetDurationMin: z.number().int().min(5).max(600) })),
  async (req, res) => {
    const user = me(req);
    if (!(await getCategories()).some((c) => c._id === req.body.categoryId)) throw badRequest('UNKNOWN_CATEGORY', 'Pick one of the themes');
    const switchedFrom = await closeOpenSession(user._id);
    const now = new Date();
    const session: SessionDoc = {
      _id: new ObjectId(),
      userId: user._id,
      categoryId: req.body.categoryId,
      spaceId: null,
      type: 'solo',
      startTime: now,
      endTime: null,
      durationMin: 0,
      targetDurationMin: req.body.targetDurationMin,
      status: 'active',
      closedReason: null,
      completed: false,
      targetHit: false,
      xpEarned: 0,
      createdAt: now,
    };
    await col('sessions').insertOne(session);
    emit('session.opened', { session });
    res.status(201).json({ session: sessionDTO(session), switchedFrom });
  }
);

sessionRoutes.get('/open', async (req, res) => {
  const open = await col('sessions').findOne({ userId: me(req)._id, status: 'active' });
  res.json({ session: open ? sessionDTO(open) : null });
});

sessionRoutes.post('/:id/complete', async (req, res) => {
  const id = parseId(req.params.id, 'session id');
  const session = await col('sessions').findOne({ _id: id, userId: me(req)._id });
  if (!session) throw notFound('Session');
  if (session.spaceId) throw badRequest('SPACE_SESSION', 'Leave the space to end a space session');
  const outcome = await closeSession(id, 'left');
  if (!outcome) throw conflict('ALREADY_CLOSED', 'That session already ended');
  emit('session.closed', outcome);
  res.json(outcome.result);
});

sessionRoutes.get(
  '/',
  validate(z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }), 'query'),
  async (req, res) => {
    const { cursor, limit } = req.query as unknown as { cursor?: string; limit: number };
    const filter: Record<string, unknown> = { userId: me(req)._id };
    if (cursor) filter.startTime = { $lt: new Date(Buffer.from(cursor, 'base64url').toString()) };
    const docs = await col('sessions').find(filter).sort({ startTime: -1 }).limit(limit + 1).toArray();
    const page = docs.slice(0, limit);
    const spaceIds = page.filter((d) => d.spaceId).map((d) => d.spaceId!);
    const spaces = spaceIds.length ? await col('spaces').find({ _id: { $in: spaceIds } }, { projection: { name: 1 } }).toArray() : [];
    const names = new Map(spaces.map((sp) => [sp._id.toHexString(), sp.name]));
    res.json({
      items: page.map((d) => ({ ...sessionDTO(d), spaceName: d.spaceId ? (names.get(d.spaceId.toHexString()) ?? null) : null })),
      nextCursor: docs.length > limit ? Buffer.from(page[page.length - 1].startTime.toISOString()).toString('base64url') : null,
    });
  }
);
