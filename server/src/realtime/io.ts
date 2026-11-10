import type { Server as HttpServer } from 'node:http';
import { ObjectId } from 'mongodb';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env';
import { col } from '../db/mongo';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { resolveUserFromToken } from '../middleware/auth';
import { presence } from './presence';

// Socket.IO (backend doc §9). REST is the write path; sockets push results.
// Rooms:
//   user:{id}        every socket of one user — notifications, progress, friendship changes
//   space:{id}       joined on `space:enter` after a successful REST join — presence, reactions
//   friends-of:{id}  each socket joins one per accepted friend — friend presence + friend spaces
//   lobby            everyone — public space changes for the "Open to everyone" grid

let io: Server | null = null;

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()) },
    pingInterval: 20_000,
    pingTimeout: 25_000,
  });

  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: string })?.token;
      const user = await resolveUserFromToken(token);
      socket.data.userId = user._id.toHexString();
      next();
    } catch (err) {
      // `data` reaches the client as connect_error.data, so the app can tell a
      // dead token (sign out) from a flaky network (keep retrying).
      const rejected = new Error((err as Error).message) as Error & { data?: { status: number } };
      rejected.data = { status: err instanceof AppError ? err.status : 500 };
      next(rejected);
    }
  });

  io.on('connection', (socket) => void onConnection(socket));
  return io;
}

async function onConnection(socket: Socket) {
  const userId = socket.data.userId as string;
  const uid = new ObjectId(userId);
  await socket.join([`user:${userId}`, 'lobby']);
  const friendIds = await acceptedFriendIds(uid);
  await socket.join(friendIds.map((id) => `friends-of:${id}`));

  if (presence.connect(userId, socket.id)) {
    emitToFriendsOf(userId, 'presence:friends', { userId, online: true });
    await col('users').updateOne({ _id: uid }, { $set: { lastActiveAt: new Date() } });
  }

  socket.on('presence:heartbeat', () => {
    // Keeps the connection warm; the in-process store needs nothing else.
  });

  socket.on('space:enter', async ({ spaceId }: { spaceId?: string }, ack?: (ok: boolean) => void) => {
    if (!spaceId || !ObjectId.isValid(spaceId)) return ack?.(false);
    const open = await col('sessions').findOne({ userId: uid, spaceId: new ObjectId(spaceId), status: 'active' });
    if (!open) return ack?.(false);
    await socket.join(`space:${spaceId}`);
    presence.enterSpace(spaceId, userId);
    emitToSpace(spaceId, 'presence:update', { spaceId, userId, away: false });
    ack?.(true);
  });

  socket.on('space:exit', async ({ spaceId }: { spaceId?: string }) => {
    if (!spaceId) return;
    await socket.leave(`space:${spaceId}`);
    presence.exitSpace(spaceId, userId);
    emitToSpace(spaceId, 'presence:update', { spaceId, userId, away: true });
  });

  socket.on('disconnect', () => {
    if (presence.disconnect(userId, socket.id)) {
      emitToFriendsOf(userId, 'presence:friends', { userId, online: false });
      logger.debug({ userId }, 'user went offline');
    }
  });
}

export async function acceptedFriendIds(userId: ObjectId): Promise<string[]> {
  const rows = await col('friendships')
    .find({ status: 'accepted', $or: [{ userIdA: userId }, { userIdB: userId }] }, { projection: { userIdA: 1, userIdB: 1 } })
    .toArray();
  return rows.map((f) => (f.userIdA.equals(userId) ? f.userIdB : f.userIdA).toHexString());
}

// Re-sync a user's friends-of rooms after a friendship change.
export async function refreshFriendRooms(userId: ObjectId) {
  if (!io) return;
  const ids = await acceptedFriendIds(userId);
  for (const socket of await io.in(`user:${userId.toHexString()}`).fetchSockets()) {
    for (const room of socket.rooms) if (room.startsWith('friends-of:')) socket.leave(room);
    socket.join(ids.map((id) => `friends-of:${id}`));
  }
}

export function emitToUser(userId: string | ObjectId, event: string, payload: unknown) {
  io?.to(`user:${String(userId)}`).emit(event, payload);
}
export function emitToSpace(spaceId: string | ObjectId, event: string, payload: unknown) {
  io?.to(`space:${String(spaceId)}`).emit(event, payload);
}
export function emitToFriendsOf(userId: string | ObjectId, event: string, payload: unknown) {
  io?.to(`friends-of:${String(userId)}`).emit(event, payload);
}
export function emitToLobby(event: string, payload: unknown) {
  io?.to('lobby').emit(event, payload);
}

export async function closeRealtime() {
  await io?.close();
  io = null;
}
