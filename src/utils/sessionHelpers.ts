import type { Session } from '../types/models';

export function getRemainingMinutes(session: Session): number {
  const elapsedMs = Date.now() - new Date(session.startTime).getTime();
  const elapsedMin = Math.floor(elapsedMs / 60000);
  return Math.max(0, session.durationTargetMin - elapsedMin);
}

export function isUserInSession(session: Session, userId: string): boolean {
  return session.participants.some((p) => p.userId === userId && !p.leftAt);
}
