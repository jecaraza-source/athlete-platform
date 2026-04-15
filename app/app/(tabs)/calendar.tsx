import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { useState } from 'react';
import { Colors } from '@/constants/theme';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Build grid cells: leading empty + day numbers
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const monthLabel = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={[styles.navText, { color: colors.tint }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={[styles.navText, { color: colors.tint }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={styles.row}>
        {DAYS_OF_WEEK.map(d => (
          <View key={d} style={styles.cell}>
            <Text style={[styles.dayOfWeek, { color: colors.icon }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Date grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((day, ci) => {
            const isToday =
              day !== null &&
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();
            return (
              <View key={ci} style={styles.cell}>
                {day !== null && (
                  <View style={[
                    styles.dayCircle,
                    isToday && { backgroundColor: colors.tint },
                  ]}>
                    <Text style={[
                      styles.dayText,
                      { color: isToday ? '#fff' : colors.text },
                    ]}>
                      {day}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    padding: 8,
  },
  navText: {
    fontSize: 28,
    lineHeight: 32,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayOfWeek: {
    fontSize: 12,
    fontWeight: '500',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
  },
});
