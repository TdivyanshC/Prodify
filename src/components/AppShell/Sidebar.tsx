import Feather from '@expo/vector-icons/Feather';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../theme';
import { NAV_ITEMS, SIDEBAR_FOOTER_ITEMS, type AppRouteName, type NavItem } from '../../navigation/routes';

// Desktop sidebar (architecture §2 §1/§2): fixed-width column, logo at top,
// primary nav in the middle, Settings/Profile pinned to the bottom. Only
// rendered at/above DESKTOP_BREAKPOINT — mobile uses bottom tabs instead.
export function Sidebar() {
  const navigation = useNavigation();
  const activeRoute = useNavigationState((state) => state?.routes[state.index]?.name as AppRouteName | undefined);

  const navigate = (name: AppRouteName) => navigation.navigate(name as never);

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>P</Text>
        </View>
        <Text style={styles.logoText}>Prodify</Text>
      </View>

      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => (
          <SidebarRow
            key={item.name}
            item={item}
            active={item.name === activeRoute}
            onPress={() => navigate(item.name)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        {SIDEBAR_FOOTER_ITEMS.map((item) => (
          <SidebarRow
            key={item.name}
            item={item}
            active={item.name === activeRoute}
            onPress={() => navigate(item.name)}
          />
        ))}
      </View>
    </View>
  );
}

function SidebarRow({
  item,
  active,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.navRow, active && styles.navRowActive]}
      accessibilityLabel={item.label}
    >
      <Feather
        name={item.icon}
        size={18}
        color={active ? colors.textPrimary : colors.textSecondary}
      />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 220,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 28,
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    fontFamily: fonts.headingBold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  logoText: {
    fontFamily: fonts.headingBold,
    color: colors.textPrimary,
    fontSize: 18,
  },
  navList: {
    gap: 4,
  },
  footer: {
    marginTop: 'auto',
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radii.button,
  },
  navRowActive: {
    backgroundColor: colors.surfaceElevated,
  },
  navLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  navLabelActive: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
  },
});
