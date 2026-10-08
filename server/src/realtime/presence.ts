// Presence (backend doc §9.2). In-process maps behind a small interface —
// the Redis version swaps `online:{id}` / `space:{id}:connected` keys in
// without changing callers. Presence is display-only: it never decides
// clocked time (§7.2).

const sockets = new Map<string, Set<string>>(); // userId → socket ids
const connectedAt = new Map<string, number>(); // userId → first socket connect
const lastToastAt = new Map<string, number>(); // userId → last in-app toast (join_nudge idle rule)
const spaceConnected = new Map<string, Set<string>>(); // spaceId → userIds with a live socket in the room

export const presence = {
  connect(userId: string, socketId: string): boolean {
    const set = sockets.get(userId) ?? new Set();
    const cameOnline = set.size === 0;
    set.add(socketId);
    sockets.set(userId, set);
    if (cameOnline) connectedAt.set(userId, Date.now());
    return cameOnline;
  },
  disconnect(userId: string, socketId: string): boolean {
    const set = sockets.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size > 0) return false;
    sockets.delete(userId);
    connectedAt.delete(userId);
    for (const members of spaceConnected.values()) members.delete(userId);
    return true;
  },
  isOnline: (userId: string) => (sockets.get(userId)?.size ?? 0) > 0,
  onlineUserIds: () => [...sockets.keys()],
  onlineSince: (userId: string) => connectedAt.get(userId) ?? null,
  enterSpace(spaceId: string, userId: string) {
    const set = spaceConnected.get(spaceId) ?? new Set();
    set.add(userId);
    spaceConnected.set(spaceId, set);
  },
  exitSpace(spaceId: string, userId: string) {
    spaceConnected.get(spaceId)?.delete(userId);
  },
  isInSpaceRoom: (spaceId: string, userId: string) => spaceConnected.get(spaceId)?.has(userId) ?? false,
  noteToast: (userId: string) => lastToastAt.set(userId, Date.now()),
  lastToast: (userId: string) => lastToastAt.get(userId) ?? null,
  reset() {
    sockets.clear();
    connectedAt.clear();
    lastToastAt.clear();
    spaceConnected.clear();
  },
};
