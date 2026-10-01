import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DailyActivityEntry } from '../../mocks/dailyActivity.mock';
import { colors, fonts, radii, shadows } from '../../theme';
import { getDayStatus, type DayStatus } from '../../utils/activityHelpers';

interface ActivityHeatmapProps {
  data: DailyActivityEntry[];
  targetMinutes: number;
}

const CELL = 13;
const CELL_GAP = 4;
const DAY_LABEL_WIDTH = 22;
// GitHub-style sparse labeling — only every other row so the column
// doesn't get crowded at this cell size.
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function statusColor(status: DayStatus): string {
  switch (status) {
    case 'complete':
      return colors.success;
    case 'partial':
      // A tint of the same success token, not a second green — keeps the
      // "success = on-track" semantic (claude.md §3b) intact at low intensity.
      return colors.success + '45';
    case 'none':
    default:
      return colors.surfaceMuted;
  }
}

// GitHub/LeetCode-style consistency grid for Profile — one continuous
// strip (per the reference screenshot), not split into separate blocks
// per month. Weeks run in columns, days vertical within each column
// (Sun top, Sat bottom), oldest week on the left. Month names sit on one
// shared line below the grid, each appearing once at the column where
// that month starts, matching the reference exactly. Horizontally
// scrollable and auto-scrolled to today on mount, since the reference's
// full-year strip doesn't fit on a phone at readable cell size.
export function ActivityHeatmap({ data, targetMinutes }: ActivityHeatmapProps) {
  const scrollRef = useRef<ScrollView>(null);

  if (data.length === 0) return null;

  // Pad the front so the grid always starts on a Sunday column, regardless
  // of what weekday the fixture's/API's first entry happens to land on.
  const firstDate = new Date(`${data[0].date}T00:00:00`);
  const leadingBlanks = firstDate.getDay(); // 0 = Sunday
  const padded: (DailyActivityEntry | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...data,
  ];

  const weeks: (DailyActivityEntry | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  // A month's label sits under the first week-column it appears in — not
  // repeated on every column it spans.
  let lastMonth = -1;
  const monthLabels = weeks.map((week) => {
    const firstDay = week.find((d): d is DailyActivityEntry => d !== null);
    if (!firstDay) return '';
    const month = new Date(`${firstDay.date}T00:00:00`).getMonth();
    if (month === lastMonth) return '';
    lastMonth = month;
    return MONTH_LABELS[month];
  });

  const activeDays = data.filter((d) => d.totalMinutes > 0).length;

  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>CONSISTENCY</Text>
        <Text style={styles.total}>{activeDays} active days</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View>
          <View style={styles.gridRow}>
            <View style={styles.dayLabelColumn}>
              {DAY_LABELS.map((label, i) => (
                <Text key={i} style={styles.dayLabel}>
                  {label}
                </Text>
              ))}
            </View>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekColumn}>
                {week.map((day, di) => (
                  <View
                    key={di}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: day
                          ? statusColor(getDayStatus(day.totalMinutes, targetMinutes))
                          : 'transparent',
                      },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>

          <View style={styles.monthRow}>
            <View style={styles.dayLabelSpacer} />
            {monthLabels.map((label, wi) => (
              <Text key={wi} style={styles.monthLabel}>
                {label}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>Less</Text>
        <View style={[styles.legendSwatch, { backgroundColor: colors.surfaceMuted }]} />
        <View style={[styles.legendSwatch, { backgroundColor: colors.success + '45' }]} />
        <View style={[styles.legendSwatch, { backgroundColor: colors.success }]} />
        <Text style={styles.legendLabel}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  total: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  gridRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  dayLabelColumn: {
    width: DAY_LABEL_WIDTH,
    gap: CELL_GAP,
  },
  dayLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 9,
    color: colors.textMuted,
    height: CELL,
    lineHeight: CELL,
  },
  weekColumn: {
    gap: CELL_GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
  },
  monthRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
    marginTop: 4,
  },
  dayLabelSpacer: {
    width: DAY_LABEL_WIDTH,
  },
  monthLabel: {
    width: CELL,
    flexShrink: 0,
    fontFamily: fonts.bodyMedium,
    fontSize: 9.5,
    color: colors.textSecondary,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  legendLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
    color: colors.textMuted,
    marginHorizontal: 2,
  },
  legendSwatch: {
    width: CELL - 2,
    height: CELL - 2,
    borderRadius: 3,
  },
});
