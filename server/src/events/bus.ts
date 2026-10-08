import { EventEmitter } from 'node:events';
import type { ObjectId } from 'mongodb';
import type { FriendshipDoc, ReactionDoc, SessionDoc, SpaceDoc } from '../db/schemas';
import { logger } from '../lib/logger';
import type { SessionCloseOutcome } from '../modules/sessions/close';

// In-process domain events (backend doc §5.3). Modules emit AFTER their
// transaction commits; notification/mascot/socket side effects subscribe.
// A failing subscriber is logged, never surfaced to the request.
export interface DomainEvents {
  'session.opened': { session: SessionDoc };
  'session.closed': SessionCloseOutcome;
  'space.created': { space: SpaceDoc; inviteeIds: ObjectId[]; by: ObjectId };
  'space.invited': { space: SpaceDoc; inviteeIds: ObjectId[]; by: ObjectId };
  'space.started': { space: SpaceDoc };
  'space.updated': { space: SpaceDoc };
  'space.member_joined': { space: SpaceDoc; userId: ObjectId };
  'friendship.requested': { friendship: FriendshipDoc };
  'friendship.accepted': { friendship: FriendshipDoc };
  'friendship.removed': { friendship: FriendshipDoc; by: ObjectId };
  'reaction.toggled': { reaction: ReactionDoc; on: boolean };
  'user.updated': { userId: ObjectId };
}

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export function emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]) {
  emitter.emit(event, payload);
}

export function on<K extends keyof DomainEvents>(event: K, handler: (payload: DomainEvents[K]) => Promise<void> | void) {
  emitter.on(event, (payload: DomainEvents[K]) => {
    Promise.resolve()
      .then(() => handler(payload))
      .catch((err) => logger.error({ err, event }, 'domain event handler failed'));
  });
}
