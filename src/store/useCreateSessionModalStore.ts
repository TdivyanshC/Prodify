import { create } from 'zustand';

interface CreateSessionModalState {
  visible: boolean;
  presetCategoryId: string | null;
  open: (presetCategoryId?: string | null) => void;
  close: () => void;
}

// Global visibility so the mobile "Create" tab (architecture §1 §10 — a
// prominent action, not a navigable screen) can open the same modal that
// Home's "+ Create a Session" CTA uses, from anywhere in the tab bar.
export const useCreateSessionModalStore = create<CreateSessionModalState>((set) => ({
  visible: false,
  presetCategoryId: null,
  open: (presetCategoryId = null) => set({ visible: true, presetCategoryId }),
  close: () => set({ visible: false, presetCategoryId: null }),
}));
