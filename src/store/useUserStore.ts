import { create } from 'zustand';
import { getUserProfile } from '../services/userService';
import type { User } from '../types/models';

interface UserStoreState {
  user: User | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export const useUserStore = create<UserStoreState>((set) => ({
  user: null,
  isLoading: false,
  refresh: async () => {
    set({ isLoading: true });
    const user = await getUserProfile();
    set({ user, isLoading: false });
  },
}));
