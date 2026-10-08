import { create } from 'zustand';
import { getNextMascotMessage, markMascotEventDelivered, type MascotMessage } from '../services/mascotService';

interface MascotStoreState {
  message: MascotMessage | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

// Spark's card message — the server picks which queued event wins (CLAUDE.md
// §4 priority order); once shown, it's marked delivered so it isn't repeated.
export const useMascotStore = create<MascotStoreState>((set) => ({
  message: null,
  isLoading: false,
  refresh: async () => {
    set({ isLoading: true });
    try {
      const message = await getNextMascotMessage();
      set({ message });
      if (message.event) void markMascotEventDelivered(message.event._id).catch(() => undefined);
    } finally {
      set({ isLoading: false });
    }
  },
}));
