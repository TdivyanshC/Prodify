import type { FeatherIconName } from '../components/icons/FeatherIconName';

export type AppRouteName = 'Home' | 'Sessions' | 'Friends' | 'Progress' | 'Achievements' | 'Profile';

export interface NavItem {
  name: AppRouteName;
  label: string;
  icon: FeatherIconName;
}

// Desktop sidebar (architecture §1 §10): Home / Sessions / Friends /
// Progress / Achievements / Profile. No "Tasks" item — Prodify is a
// live-session-discovery product, not a task manager.
export const NAV_ITEMS: NavItem[] = [
  { name: 'Home', label: 'Home', icon: 'home' },
  { name: 'Sessions', label: 'Sessions', icon: 'compass' },
  { name: 'Friends', label: 'Friends', icon: 'users' },
  { name: 'Progress', label: 'Progress', icon: 'bar-chart-2' },
  { name: 'Achievements', label: 'Achievements', icon: 'award' },
];

export const SIDEBAR_FOOTER_ITEMS: NavItem[] = [
  { name: 'Profile', label: 'Profile', icon: 'user' },
];

// Mobile bottom nav (later architecture-doc pass, §1 §13): Home / Sessions
// / Create / Friends / Profile — same "Sessions" label as desktop now
// (an earlier pass called this tab "Explore" on mobile; superseded). The
// real "Create" tab is a special case registered directly in
// MobileTabs.tsx (it intercepts tabPress to open the Create Session modal
// instead of navigating to a screen), so it isn't listed here — this
// array is only the 4 real routes.
export const MOBILE_TAB_ITEMS: NavItem[] = [
  { name: 'Home', label: 'Home', icon: 'home' },
  { name: 'Sessions', label: 'Sessions', icon: 'compass' },
  { name: 'Friends', label: 'Friends', icon: 'users' },
  { name: 'Profile', label: 'Profile', icon: 'user' },
];

export function getScreenTitle(routeName: AppRouteName): string {
  const item = NAV_ITEMS.find((i) => i.name === routeName) ?? SIDEBAR_FOOTER_ITEMS.find((i) => i.name === routeName);
  return item?.label ?? routeName;
}

// Breakpoint from architecture doc §1 §1/§12 — below this, use mobile
// bottom nav; at/above it, use the desktop sidebar layout.
export const DESKTOP_BREAKPOINT = 768;

// Root-level stack (RootStack.tsx), one level above the tab/sidebar routes
// above — Session Room and Post-Session are full-screen destinations that
// intentionally cover the tab bar, not another tab.
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  SessionRoom: { sessionId: string };
  // Session Room already calls completeSession/recordSessionResult before
  // navigating here, so Post-Session just displays the outcome it's
  // handed rather than re-deriving (or re-awarding) it.
  PostSession: {
    sessionId: string;
    targetHit: boolean;
    minutesLogged: number;
    pointsEarned: number;
    streakBefore: number;
    streakAfter: number;
  };
  // A drill-down from a Friends list row, not a CTA launch like SessionRoom/
  // PostSession — pushed as a normal (swipe-back-able) screen rather than a
  // full-screen modal. userId + friendshipId both travel along so the
  // screen never has to re-derive "which friendship is this" from scratch.
  FriendProfile: { friendshipId: string; userId: string };
};
