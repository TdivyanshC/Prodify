import type { AnimationObject } from 'lottie-react-native';
import { create } from 'zustand';

export interface PopupAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

export interface PopupOptions {
  title?: string;
  message: string;
  lottieSource?: AnimationObject | { uri: string };
  actions?: PopupAction[];
}

interface PopupStoreState extends PopupOptions {
  visible: boolean;
  showPopup: (options: PopupOptions) => void;
  hidePopup: () => void;
}

// Global trigger for the shared Popup, mirroring useSparkOverlayStore —
// Popup itself is mounted once at the app root (App.tsx) so it always
// covers the full screen (including the floating tab bar) instead of
// being boxed into whichever screen happened to render it.
export const usePopupStore = create<PopupStoreState>((set) => ({
  visible: false,
  title: undefined,
  message: '',
  lottieSource: undefined,
  actions: undefined,
  // Reset every optional field before applying the new options — otherwise
  // a call that omits e.g. `title` would silently keep whatever the
  // previous popup left in state instead of clearing it.
  showPopup: (options) =>
    set({ title: undefined, lottieSource: undefined, actions: undefined, visible: true, ...options }),
  hidePopup: () => set({ visible: false }),
}));
