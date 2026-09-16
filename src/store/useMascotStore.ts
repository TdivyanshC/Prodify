import { create } from 'zustand';
import { getNextMascotMessage, MascotMessage } from '../services/mascotService';

interface MascotStoreState {
  message: MascotMessage | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export const useMascotStore = create<MascotStoreState>((set) => ({
  message: null,
  isLoading: false,
  refresh: async () => {
    set({ isLoading: true });
    const message = await getNextMascotMessage();
    set({ message, isLoading: false });
  },
}));
