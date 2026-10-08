import { Router } from 'express';
import { z } from 'zod';
import { parseId } from '../../lib/errors';
import { me } from '../../middleware/auth';
import { rateLimit, validate } from '../../middleware/common';
import * as spaces from './service';

const objectIdStr = z.string().regex(/^[a-f0-9]{24}$/);

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  categoryId: z.string().startsWith('cat_'),
  durationTargetMin: z.number().int().min(5).max(600),
  description: z.string().trim().max(140).nullish(),
  isPublic: z.boolean(),
  invitedUserIds: z.array(objectIdStr).max(50).optional(),
  startTime: z.iso.datetime({ offset: true }).optional(),
  maxParticipants: z.number().int().min(2).max(100).nullish(),
});

const browseSchema = z.object({
  categoryId: z.string().startsWith('cat_').optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const spaceRoutes = Router();

spaceRoutes.get('/feed', async (req, res) => {
  res.json(await spaces.getFeed(me(req)));
});

spaceRoutes.get('/', validate(browseSchema, 'query'), async (req, res) => {
  res.json(await spaces.browsePublic(me(req), req.query as unknown as z.infer<typeof browseSchema>));
});

spaceRoutes.post('/', rateLimit('space_create', 20, 24 * 3600_000), validate(createSchema), async (req, res) => {
  res.status(201).json(await spaces.createSpace(me(req), req.body));
});

spaceRoutes.get('/:id', async (req, res) => {
  res.json(await spaces.getSpace(me(req), parseId(req.params.id, 'space id')));
});

spaceRoutes.post('/:id/start', async (req, res) => {
  res.json(await spaces.startScheduled(me(req), parseId(req.params.id, 'space id')));
});

spaceRoutes.post('/:id/cancel', async (req, res) => {
  res.json(await spaces.cancelScheduled(me(req), parseId(req.params.id, 'space id')));
});

spaceRoutes.post('/:id/join', rateLimit('space_join', 60, 3600_000), async (req, res) => {
  res.json(await spaces.joinSpace(me(req), parseId(req.params.id, 'space id')));
});

spaceRoutes.post('/:id/leave', async (req, res) => {
  res.json(await spaces.leaveSpace(me(req), parseId(req.params.id, 'space id')));
});

spaceRoutes.post('/:id/invites', rateLimit('invites', 50, 3600_000), validate(z.object({ userIds: z.array(objectIdStr).min(1).max(20) })), async (req, res) => {
  res.json(await spaces.inviteToSpace(me(req), parseId(req.params.id, 'space id'), req.body.userIds));
});

spaceRoutes.post('/:id/invites/decline', async (req, res) => {
  res.json(await spaces.declineInvite(me(req), parseId(req.params.id, 'space id')));
});
