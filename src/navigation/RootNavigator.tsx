import { useWindowDimensions } from 'react-native';
import { DesktopShell } from './DesktopShell';
import { MobileTabs } from './MobileTabs';
import { DESKTOP_BREAKPOINT } from './routes';

// Responsive switch (architecture §2 §1/§13): sidebar+stack at/above the
// desktop breakpoint, bottom tabs below it.
export function RootNavigator() {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT ? <DesktopShell /> : <MobileTabs />;
}
