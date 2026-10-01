import type { Session } from '../types/models';

export function getRemainingMinutes(session: Session): number {
  const elapsedMs = Date.now() - new Date(session.startTime).getTime();
  const elapsedMin = Math.floor(elapsedMs / 60000);
  return Math.max(0, session.durationTargetMin - elapsedMin);
}

export function getElapsedSeconds(session: Session, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(session.startTime).getTime()) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Combined focused minutes of everyone present in a space. `participants`
// is only a preview for big rooms (see Session.participantCount), so the
// unlisted people are estimated at the listed average rather than dropped.
export function getGroupFocusedMinutes(session: Session, now: number = Date.now()): number {
  const present = session.participants.filter((p) => !p.leftAt);
  if (present.length === 0) return 0;
  const listedMinutes = present.map((p) => Math.max(0, (now - new Date(p.joinedAt).getTime()) / 60000));
  const listedTotal = listedMinutes.reduce((sum, m) => sum + m, 0);
  const unlisted = Math.max(0, session.participantCount - present.length);
  return listedTotal + unlisted * (listedTotal / present.length);
}

// A "friend space" is one started by an accepted friend — the Spaces tab's
// headline list. `friendIds` comes from the caller's accepted friendships.
export function isFriendSpace(session: Session, friendIds: Set<string>): boolean {
  return session.hostId !== null && friendIds.has(session.hostId);
}

// Distinct friends currently sitting in any live space — hosts and guests
// alike, each counted once even if the data ever lists them twice.
export function getFocusingFriendIds(sessions: Session[], friendIds: Set<string>): string[] {
  const ids = new Set<string>();
  for (const session of sessions) {
    if (session.status !== 'active') continue;
    for (const p of session.participants) {
      if (!p.leftAt && friendIds.has(p.userId)) ids.add(p.userId);
    }
  }
  return [...ids];
}

export function isUserInSession(session: Session, userId: string): boolean {
  return session.participants.some((p) => p.userId === userId && !p.leftAt);
}
