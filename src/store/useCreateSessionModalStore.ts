import { create } from 'zustand';

// Optional starting values for the Create sheet — e.g. "Start one like
// this" on a recently ended space copies its theme, name, and length.
export interface CreateSessionPreset {
  categoryId?: string;
  name?: string;
  durationMin?: number;
}

interface CreateSessionModalState {
  visible: boolean;
  preset: CreateSessionPreset | null;
  open: (preset?: CreateSessionPreset | null) => void;
  close: () => void;
}

// Global visibility so the mobile "Create" tab (architecture §1 §10 — a
// prominent action, not a navigable screen) can open the same modal that
// Home's "+ Create a Session" CTA uses, from anywhere in the tab bar.
export const useCreateSessionModalStore = create<CreateSessionModalState>((set) => ({
  visible: false,
  preset: null,
  open: (preset = null) => set({ visible: true, preset }),
  close: () => set({ visible: false, preset: null }),
}));
