import { create } from 'zustand';

interface FocusModeState {
  // The space the user is sitting in right now, if any.
  activeSessionId: string | null;
  enteredAt: number | null;
  // Notifications that arrived while focusing — the server holds them
  // (delivery "held") and returns them with the session-close result.
  heldIds: string[];
  // The held list from the most recent session, for Post-Session to show.
  lastHeldIds: string[];
  enter: (sessionId: string) => void;
  exit: () => void;
  hold: (notificationId: string) => void;
  setLastHeld: (ids: string[]) => void;
}

// Focus mode: nothing interrupts a session in progress (claude.md §3b
// "focus first"). Session Room enters on mount and exits on finish/leave;
// the server enforces the same rule for every notification it sends.
export const useFocusModeStore = create<FocusModeState>((set) => ({
  activeSessionId: null,
  enteredAt: null,
  heldIds: [],
  lastHeldIds: [],
  enter: (sessionId) =>
    set((state) =>
      state.activeSessionId === sessionId ? state : { activeSessionId: sessionId, enteredAt: Date.now(), heldIds: [] }
    ),
  exit: () =>
    set((state) =>
      state.activeSessionId === null ? state : { activeSessionId: null, enteredAt: null, lastHeldIds: state.heldIds, heldIds: [] }
    ),
  hold: (notificationId) =>
    set((state) => (state.heldIds.includes(notificationId) ? state : { heldIds: [...state.heldIds, notificationId] })),
  setLastHeld: (ids) => set({ lastHeldIds: ids }),
}));
