import { create } from 'zustand';

interface AuthStoreState {
  isAuthenticated: boolean;
  signInWithGoogleMock: () => void;
  signOut: () => void;
}

// Phase 1 (claude.md §2): no real Google OAuth yet — this only flips local
// state so the Auth screen's "Continue" button can advance into the app
// and Profile's "Sign out" can send the user back to it. Phase 2 swaps the
// two actions' bodies for real Firebase/Passport Google auth; the shape
// callers use (isAuthenticated + these two actions) stays the same.
export const useAuthStore = create<AuthStoreState>((set) => ({
  isAuthenticated: false,
  signInWithGoogleMock: () => set({ isAuthenticated: true }),
  signOut: () => set({ isAuthenticated: false }),
}));
